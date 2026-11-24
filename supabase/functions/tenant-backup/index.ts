// ==============================================================================
// SUPABASE EDGE FUNCTION: tenant-backup
// Copies every tenant's ledger tables into one JSON file in the private
// "tenant-backups" Storage bucket of the master project, then applies the
// retention rule (30 daily + 12 monthly).
//
// Who may call it:
//   * the nightly GitHub Action, with header  x-backup-secret: <BACKUP_CRON_SECRET>
//   * a signed-in super-admin ("Back up now"), optionally for one tenantId
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: TS extension import in Deno
import { withCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
// @ts-ignore: TS extension import in Deno
import { getServiceClient, verifySuperAdmin } from '../_shared/auth.ts';
// @ts-ignore: TS extension import in Deno
import { getTenantDbAccess, getTenantDataClient } from '../_shared/tenant.ts';
// @ts-ignore: TS extension import in Deno
import {
  exportTenantTables,
  backupFileName,
  selectBackupsToDelete,
  BACKUP_BUCKET,
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
} from '../_shared/backup.ts';

declare const Deno: any;

function sameSecret(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

serve(withCors(async (req: Request) => {
  if (req.method !== 'POST') return errorResponse('Method not allowed. Use POST.', 405);

  // 1. Authorise: cron secret or super-admin
  let trigger: 'schedule' | 'manual' = 'schedule';
  const cronSecret = Deno.env.get('BACKUP_CRON_SECRET') || '';
  const given = req.headers.get('x-backup-secret') || '';
  if (!sameSecret(given, cronSecret)) {
    try {
      await verifySuperAdmin(req);
      trigger = 'manual';
    } catch {
      return errorResponse('Not allowed.', 401);
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const onlyTenant = body?.tenantId ? String(body.tenantId) : null;
    const serviceClient = getServiceClient();

    let query = serviceClient.from('master_tenants').select('id, email, client_name, business_name');
    if (onlyTenant) query = query.eq('id', onlyTenant);
    const { data: tenants, error: tErr } = await query;
    if (tErr) throw tErr;

    const results: Array<Record<string, unknown>> = [];
    for (const t of tenants || []) {
      const record = async (row: Record<string, unknown>) => {
        await serviceClient.from('master_backup_runs').insert([{ tenant_id: t.id, trigger, ...row }]);
        results.push({ tenantId: t.id, email: t.email, ...row });
      };

      try {
        const access = await getTenantDbAccess(serviceClient, t.id);
        if (!access) { await record({ status: 'skipped', error: 'No database configured' }); continue; }
        if (!access.secretKey) { await record({ status: 'skipped', error: 'No secret key saved for this tenant' }); continue; }

        const { tables, rowCounts, missing } = await exportTenantTables(getTenantDataClient(access));
        const now = new Date();
        const payload = JSON.stringify({
          format: BACKUP_FORMAT,
          formatVersion: BACKUP_FORMAT_VERSION,
          createdAt: now.toISOString(),
          tenant: { id: t.id, email: t.email, clientName: t.client_name, businessName: t.business_name, databaseUrl: access.url },
          rowCounts,
          missingTables: missing,
          tables,
        });

        const path = `${t.id}/${backupFileName(now)}`;
        const { error: upErr } = await serviceClient.storage
          .from(BACKUP_BUCKET)
          .upload(path, new Blob([payload], { type: 'application/json' }), { contentType: 'application/json', upsert: true });
        if (upErr) throw upErr;

        await record({ status: 'success', file_path: path, size_bytes: payload.length, row_counts: rowCounts });

        // Retention for this tenant's folder
        const { data: files } = await serviceClient.storage.from(BACKUP_BUCKET).list(t.id, { limit: 1000 });
        const toDelete = selectBackupsToDelete((files || []).map((f: { name: string }) => f.name), now);
        if (toDelete.length) {
          await serviceClient.storage.from(BACKUP_BUCKET).remove(toDelete.map(n => `${t.id}/${n}`));
        }
      } catch (e) {
        await record({ status: 'failed', error: String((e as Error)?.message || e).slice(0, 500) });
      }
    }

    const failed = results.filter(r => r.status === 'failed').length;
    return jsonResponse({
      success: failed === 0,
      message: `Backups: ${results.filter(r => r.status === 'success').length} saved, ${results.filter(r => r.status === 'skipped').length} skipped, ${failed} failed.`,
      // Per-tenant details (emails) only for a signed-in admin, never in CI logs
      ...(trigger === 'manual' ? { results } : {}),
    }, failed === 0 ? 200 : 500);
  } catch (err: unknown) {
    console.error('tenant-backup exception:', err);
    return errorResponse('Backup run failed.', 500);
  }
}));
