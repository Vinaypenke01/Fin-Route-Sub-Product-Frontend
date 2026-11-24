// ==============================================================================
// SUPABASE EDGE FUNCTION: admin-tenants
// Authenticated Administration Engine for Tenants, DB Configs & Admin Accounts
// Enforces caller role = 'superadmin' on EVERY request.
// Privileged keys (SUPABASE_SERVICE_ROLE_KEY) are stored only in server-side secrets.
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: TS extension import in Deno
import { withCors, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
// @ts-ignore: TS extension import in Deno
import { verifySuperAdmin } from '../_shared/auth.ts';
// @ts-ignore: TS extension import in Deno
import { getTenantDbAccess, getTenantDataClient, syncTenantAuthUser, pingTenantDatabase } from '../_shared/tenant.ts';

declare const Deno: any;

// Stores the tenant secret key in Vault and/or keeps the tenant Auth user in
// sync. Returns human-readable warnings instead of failing the whole request.
async function applyTenantAuthChanges(
  serviceClient: any,
  tenantId: string,
  opts: { secretKey?: string; email?: string; password?: string; active?: boolean }
): Promise<string[]> {
  const warnings: string[] = [];
  try {
    if (opts.secretKey) {
      const { error } = await serviceClient.rpc('admin_set_tenant_secret', {
        p_tenant_id: tenantId,
        p_secret: opts.secretKey,
      });
      if (error) {
        warnings.push(`Secret key not saved: ${error.message}`);
        return warnings;
      }
    }

    const access = await getTenantDbAccess(serviceClient, tenantId);
    if (!access?.secretKey) return warnings; // legacy tenant: nothing to sync

    const wantsSync = Boolean(opts.password) || opts.active !== undefined || Boolean(opts.secretKey) || Boolean(opts.email);
    if (!wantsSync) return warnings;

    if (!access.authUserId && !opts.password) {
      warnings.push('Tenant sign-in account will be created on the operator\'s next login (or set a new password now).');
      return warnings;
    }

    let email = opts.email;
    if (!email) {
      const { data: t } = await serviceClient.from('master_tenants').select('email').eq('id', tenantId).maybeSingle();
      email = t?.email;
    }
    if (!email) {
      warnings.push('Tenant email not found; tenant sign-in account not updated.');
      return warnings;
    }

    await syncTenantAuthUser(serviceClient, access, {
      email,
      password: opts.password || undefined,
      active: opts.active,
    });
  } catch (e) {
    warnings.push(`Tenant sign-in sync failed: ${(e as Error)?.message || e}`);
  }
  return warnings;
}

serve(withCors(async (req: Request) => {
  // 1. Handle CORS Preflight
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  // 2. Enforce Super-Admin Authentication & Role Verification on EVERY request
  let callerInfo;
  try {
    callerInfo = await verifySuperAdmin(req);
  } catch (authErr: unknown) {
    const msg = authErr instanceof Error ? authErr.message : 'Unauthorized';
    const status = msg.startsWith('403') ? 403 : msg.startsWith('401') ? 401 : 500;
    const cleanMsg = msg.replace(/^\d+:\s*/, '');
    return errorResponse(cleanMsg, status);
  }

  const { user: callerUser, serviceClient } = callerInfo;

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const payload = body?.payload || {};

    switch (action) {
      // ------------------------------------------------------------------------
      // 1. LIST TENANTS
      // ------------------------------------------------------------------------
      case 'list_tenants': {
        const { data: tenants, error: tErr } = await serviceClient
          .from('master_tenants')
          .select(`
            id,
            email,
            client_name,
            phone,
            business_name,
            status,
            created_at,
            updated_at,
            master_db_configs (
              tenant_supabase_url,
              tenant_anon_key,
              tenant_secret_id,
              tenant_auth_required,
              db_status,
              last_health_check
            ),
            master_credentials (
              last_login,
              expires_at
            ),
            master_active_sessions (
              device_label,
              started_at,
              last_seen_at
            )
          `)
          .order('created_at', { ascending: false });

        if (tErr) throw tErr;

        // Expose only whether a secret key is stored, never its Vault id.
        for (const t of (tenants || []) as any[]) {
          const cfgs = Array.isArray(t.master_db_configs) ? t.master_db_configs : (t.master_db_configs ? [t.master_db_configs] : []);
          for (const c of cfgs) {
            c.has_secret_key = Boolean(c.tenant_secret_id);
            delete c.tenant_secret_id;
          }
        }

        return jsonResponse({
          success: true,
          data: tenants || [],
          caller: { email: callerUser.email, role: 'superadmin' },
        });
      }

      // ------------------------------------------------------------------------
      // 2. CREATE TENANT WITH DEDICATED DB
      // ------------------------------------------------------------------------
      case 'create_tenant': {
        const email = String(payload.email || '').trim().toLowerCase();
        const clientName = String(payload.clientName || '').trim();
        const businessName = String(payload.businessName || 'FinRoute Collect').trim();
        const password = String(payload.password || '').trim();
        const tenantDbUrl = String(payload.tenantDbUrl || '').trim();
        const tenantAnonKey = String(payload.tenantAnonKey || '').trim();
        const tenantSecretKey = String(payload.tenantSecretKey || '').trim();
        const expiresAt = payload.expiresAt ? new Date(payload.expiresAt).toISOString() : null;

        if (!email || !clientName || !password) {
          return errorResponse('Email, client name, and password are required.', 400);
        }

        // 1. Insert Tenant
        const { data: tenant, error: tErr } = await serviceClient
          .from('master_tenants')
          .insert([{
            email,
            client_name: clientName,
            business_name: businessName,
            status: 'active',
          }])
          .select()
          .single();

        if (tErr) throw tErr;

        // 2. Insert Credentials
        const { error: cErr } = await serviceClient
          .from('master_credentials')
          .insert([{
            tenant_id: tenant.id,
            email,
            password_hash: password,
            expires_at: expiresAt,
          }]);

        if (cErr) throw cErr;

        // 3. Insert DB Config
        if (tenantDbUrl && tenantAnonKey) {
          const { error: dErr } = await serviceClient
            .from('master_db_configs')
            .insert([{
              tenant_id: tenant.id,
              tenant_supabase_url: tenantDbUrl,
              tenant_anon_key: tenantAnonKey,
              db_status: 'connected',
            }]);

          if (dErr) throw dErr;
        }

        const warnings = (tenantDbUrl && tenantAnonKey && tenantSecretKey)
          ? await applyTenantAuthChanges(serviceClient, tenant.id, {
              secretKey: tenantSecretKey,
              email,
              password,
              active: true,
            })
          : [];

        return jsonResponse({ success: true, tenant, warnings });
      }

      // ------------------------------------------------------------------------
      // 3. UPDATE TENANT STATUS
      // ------------------------------------------------------------------------
      case 'update_tenant_status': {
        const { tenantId, status } = payload;
        if (!tenantId || !status) {
          return errorResponse('tenantId and status are required.', 400);
        }

        const { error } = await serviceClient
          .from('master_tenants')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', tenantId);

        if (error) throw error;

        // Block / unblock the operator's tenant sign-in to match the status.
        const warnings = await applyTenantAuthChanges(serviceClient, tenantId, { active: status === 'active' });

        return jsonResponse({ success: true, message: `Tenant status updated to ${status}.`, warnings });
      }

      // ------------------------------------------------------------------------
      // 4. UPDATE FULL TENANT DETAILS
      // ------------------------------------------------------------------------
      case 'update_tenant_full': {
        const {
          tenantId,
          clientName,
          businessName,
          email,
          phone,
          status,
          password,
          tenantDbUrl,
          tenantAnonKey,
          tenantSecretKey,
          tenantAuthRequired,
        } = payload;

        if (!tenantId) {
          return errorResponse('tenantId is required.', 400);
        }

        if (tenantAuthRequired === true && !String(tenantSecretKey || '').trim()) {
          const existing = await getTenantDbAccess(serviceClient, tenantId).catch(() => null);
          if (!existing?.secretKey) {
            return errorResponse('Save the tenant secret key before requiring tenant sign-in.', 400);
          }
        }

        const cleanEmail = email ? String(email).trim().toLowerCase() : undefined;

        // 1. Update Profile
        const tenantUpdate: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (clientName) tenantUpdate.client_name = String(clientName).trim();
        if (businessName) tenantUpdate.business_name = String(businessName).trim();
        if (cleanEmail) tenantUpdate.email = cleanEmail;
        if (phone !== undefined) tenantUpdate.phone = phone ? String(phone).trim() : null;
        if (status) tenantUpdate.status = status;

        const { error: tErr } = await serviceClient
          .from('master_tenants')
          .update(tenantUpdate)
          .eq('id', tenantId);

        if (tErr) throw tErr;

        // 2. Update Credentials if password/email provided
        if (password || cleanEmail) {
          const credsUpdate: Record<string, unknown> = {};
          if (cleanEmail) credsUpdate.email = cleanEmail;
          if (password && String(password).trim()) credsUpdate.password_hash = String(password).trim();

          await serviceClient
            .from('master_credentials')
            .update(credsUpdate)
            .eq('tenant_id', tenantId);
        }

        // 3. Update DB Configs
        if (tenantDbUrl !== undefined || tenantAnonKey !== undefined) {
          const dbUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
          if (tenantDbUrl) dbUpdate.tenant_supabase_url = String(tenantDbUrl).trim();
          if (tenantAnonKey) dbUpdate.tenant_anon_key = String(tenantAnonKey).trim();

          const { data: existingDb } = await serviceClient
            .from('master_db_configs')
            .select('id')
            .eq('tenant_id', tenantId)
            .maybeSingle();

          if (existingDb) {
            await serviceClient.from('master_db_configs').update(dbUpdate).eq('tenant_id', tenantId);
          } else if (tenantDbUrl && tenantAnonKey) {
            await serviceClient.from('master_db_configs').insert([{
              tenant_id: tenantId,
              tenant_supabase_url: String(tenantDbUrl).trim(),
              tenant_anon_key: String(tenantAnonKey).trim(),
            }]);
          }
        }

        if (typeof tenantAuthRequired === 'boolean') {
          await serviceClient
            .from('master_db_configs')
            .update({ tenant_auth_required: tenantAuthRequired, updated_at: new Date().toISOString() })
            .eq('tenant_id', tenantId);
        }

        const warnings = await applyTenantAuthChanges(serviceClient, tenantId, {
          secretKey: String(tenantSecretKey || '').trim() || undefined,
          email: cleanEmail,
          password: password ? String(password).trim() : undefined,
          active: status ? status === 'active' : undefined,
        });

        return jsonResponse({ success: true, message: 'Tenant updated successfully.', warnings });
      }

      // ------------------------------------------------------------------------
      // 4a. TENANT DATABASE VERSIONS (which tenant updates have been applied)
      // ------------------------------------------------------------------------
      case 'tenant_versions': {
        const { data: rows, error: rErr } = await serviceClient.from('master_tenants').select('id');
        if (rErr) throw rErr;

        const entries = await Promise.all((rows || []).map(async (r: { id: string }) => {
          try {
            const access = await getTenantDbAccess(serviceClient, r.id);
            if (!access) return [r.id, { status: 'unconfigured', version: null }];
            if (!access.secretKey) return [r.id, { status: 'no_key', version: null }];

            const client = getTenantDataClient(access);
            const res: any = await Promise.race([
              client.from('finroute_schema_version').select('version').order('version', { ascending: false }).limit(1),
              new Promise((_, reject) => setTimeout(() => reject(new Error('timed out')), 6000)),
            ]);
            if (res?.error) {
              const missing = res.error.code === '42P01' || res.error.code === 'PGRST205' || /does not exist|could not find/i.test(res.error.message || '');
              return [r.id, missing ? { status: 'ok', version: 0 } : { status: 'error', version: null, message: res.error.message }];
            }
            return [r.id, { status: 'ok', version: Number(res?.data?.[0]?.version) || 0 }];
          } catch (e) {
            return [r.id, { status: 'error', version: null, message: String((e as Error)?.message || e) }];
          }
        }));

        return jsonResponse({ success: true, versions: Object.fromEntries(entries) });
      }

      // ------------------------------------------------------------------------
      // 4a2. END AN OPERATOR'S ACTIVE SESSION (lost / stolen phone)
      // ------------------------------------------------------------------------
      case 'end_session': {
        const tenantId = String(payload.tenantId || '').trim();
        if (!tenantId) return errorResponse('tenantId is required.', 400);

        // 1. Free the account: the device's next heartbeat (within a minute) signs it out
        const { error: dErr } = await serviceClient.from('master_active_sessions').delete().eq('tenant_id', tenantId);
        if (dErr) throw dErr;

        // 2. Also revoke the tenant database sign-in right away (tenant update 002)
        const warnings: string[] = [];
        try {
          const access = await getTenantDbAccess(serviceClient, tenantId);
          if (access?.secretKey && access.authUserId) {
            const { error: rErr } = await getTenantDataClient(access).rpc('finroute_revoke_user_sessions', { p_user_id: access.authUserId });
            if (rErr) {
              warnings.push(/could not find|does not exist|PGRST202/i.test(rErr.message || '')
                ? 'Run tenant update 002 on this tenant so "End session" also signs the device out of the database immediately.'
                : `Database sign-in not revoked: ${rErr.message}`);
            }
          }
        } catch (e) {
          warnings.push(`Database sign-in not revoked: ${(e as Error)?.message || e}`);
        }

        console.log(`Session ended by ${callerUser.email} for tenant ${tenantId}`);
        return jsonResponse({ success: true, message: 'Session ended. The device will be signed out within a minute.', warnings });
      }

      // ------------------------------------------------------------------------
      // 4a3. BACKUPS: list runs and create short-lived download links
      // ------------------------------------------------------------------------
      case 'list_backups': {
        const tenantId = String(payload.tenantId || '').trim();
        if (!tenantId) return errorResponse('tenantId is required.', 400);
        const { data, error } = await serviceClient
          .from('master_backup_runs')
          .select('id, status, file_path, size_bytes, row_counts, error, trigger, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(60);
        if (error) throw error;

        // Mark which files still exist (older ones are removed by retention)
        const { data: files } = await serviceClient.storage.from('tenant-backups').list(tenantId, { limit: 1000 });
        const existing = new Set((files || []).map((f: { name: string }) => `${tenantId}/${f.name}`));
        const runs = (data || []).map((r: any) => ({ ...r, available: Boolean(r.file_path && existing.has(r.file_path)) }));
        return jsonResponse({ success: true, runs });
      }

      case 'backup_download_url': {
        const tenantId = String(payload.tenantId || '').trim();
        const path = String(payload.path || '').trim();
        // Only files inside this tenant's own folder, no path tricks
        if (!tenantId || !path.startsWith(`${tenantId}/`) || path.includes('..')) {
          return errorResponse('Invalid backup file.', 400);
        }
        const { data, error } = await serviceClient.storage.from('tenant-backups').createSignedUrl(path, 300, { download: true });
        if (error) throw error;
        console.log(`Backup download link created by ${callerUser.email}: ${path}`);
        return jsonResponse({ success: true, url: data?.signedUrl });
      }

      // ------------------------------------------------------------------------
      // 4b. DELETE TENANT (master registry only; tenant project is untouched)
      // ------------------------------------------------------------------------
      case 'delete_tenant': {
        const tenantId = String(payload.tenantId || '').trim();
        const confirmEmail = String(payload.confirmEmail || '').trim().toLowerCase();
        if (!tenantId || !confirmEmail) {
          return errorResponse('tenantId and confirmEmail are required.', 400);
        }

        const { data: tenantRow, error: tErr } = await serviceClient
          .from('master_tenants')
          .select('id, email')
          .eq('id', tenantId)
          .maybeSingle();
        if (tErr) throw tErr;
        if (!tenantRow) {
          return errorResponse('Tenant not found.', 404);
        }
        if (String(tenantRow.email || '').trim().toLowerCase() !== confirmEmail) {
          return errorResponse('Confirmation email does not match this tenant.', 400);
        }

        const warnings: string[] = [];

        // 1. Remove the operator's sign-in account from the tenant project so
        //    any open session can no longer be refreshed.
        try {
          const access = await getTenantDbAccess(serviceClient, tenantId);
          if (access?.secretKey && access.authUserId) {
            const tenantAdmin = getTenantDataClient(access);
            const { error: delErr } = await tenantAdmin.auth.admin.deleteUser(access.authUserId);
            if (delErr && !/not found/i.test(delErr.message)) {
              warnings.push(`Tenant sign-in account not removed: ${delErr.message}`);
            }
          } else if (access && !access.secretKey) {
            warnings.push('No secret key was stored, so the operator\'s account in the tenant project (if any) was left in place.');
          }
        } catch (e) {
          warnings.push(`Tenant sign-in account not removed: ${(e as Error)?.message || e}`);
        }

        // 2. Remove master records + Vault secret in one transaction
        const { data: delRes, error: dErr } = await serviceClient.rpc('admin_delete_tenant', { p_tenant_id: tenantId });
        if (dErr) throw dErr;
        if (!delRes?.success) {
          return errorResponse(delRes?.message || 'Tenant could not be deleted.', 400);
        }

        console.log(`Tenant deleted by ${callerUser.email}: ${tenantRow.email} (${tenantId})`);

        return jsonResponse({
          success: true,
          message: `Tenant ${tenantRow.email} deleted from FinRoute.`,
          warnings,
        });
      }

      // ------------------------------------------------------------------------
      // 5. UPDATE TENANT DB CONFIG
      // ------------------------------------------------------------------------
      case 'update_tenant_db': {
        const { tenantId, tenantDbUrl, tenantAnonKey } = payload;
        if (!tenantId || !tenantDbUrl || !tenantAnonKey) {
          return errorResponse('tenantId, tenantDbUrl, and tenantAnonKey are required.', 400);
        }

        const { error } = await serviceClient
          .from('master_db_configs')
          .upsert({
            tenant_id: tenantId,
            tenant_supabase_url: String(tenantDbUrl).trim(),
            tenant_anon_key: String(tenantAnonKey).trim(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'tenant_id' });

        if (error) throw error;

        const warnings = payload.tenantSecretKey
          ? await applyTenantAuthChanges(serviceClient, tenantId, { secretKey: String(payload.tenantSecretKey).trim() })
          : [];

        return jsonResponse({ success: true, message: 'Database configuration updated.', warnings });
      }

      // ------------------------------------------------------------------------
      // 6. LIST ALL SUPER ADMINS (FROM SUPABASE AUTH & USER_ROLES)
      // ------------------------------------------------------------------------
      case 'list_admins': {
        // Query user_roles table
        const { data: roles, error: rErr } = await serviceClient
          .from('user_roles')
          .select('user_id, role, created_at')
          .order('created_at', { ascending: true });

        if (rErr) throw rErr;

        // Fetch auth users using Admin Auth API
        const { data: usersData, error: uErr } = await serviceClient.auth.admin.listUsers({
          perPage: 100,
        });

        if (uErr) throw uErr;

        const roleMap = new Map<string, { user_id: string; role: string; created_at: string }>(
          (roles || []).map((r: { user_id: string; role: string; created_at: string }) => [r.user_id, r])
        );

        // Combine Supabase Auth user metadata with role mapping
        const admins = (usersData?.users || [])
          .filter((u: { id: string }) => roleMap.has(u.id))
          .map((u: { id: string; email?: string; user_metadata?: Record<string, unknown>; created_at: string; last_sign_in_at?: string }) => {
            const roleInfo = roleMap.get(u.id);
            return {
              id: u.id,
              email: u.email,
              name: (u.user_metadata?.name as string) || u.email?.split('@')[0] || 'Administrator',
              role: roleInfo?.role || 'superadmin',
              created_at: roleInfo?.created_at || u.created_at,
              last_sign_in_at: u.last_sign_in_at || null,
            };
          });

        return jsonResponse({ success: true, admins });
      }

      // ------------------------------------------------------------------------
      // 7. CREATE SUPER ADMIN ACCOUNT IN SUPABASE AUTH
      // ------------------------------------------------------------------------
      case 'create_admin': {
        const email = String(payload.email || '').trim().toLowerCase();
        const password = String(payload.password || '').trim();
        const name = String(payload.name || '').trim();
        const role = String(payload.role || 'superadmin').trim();

        if (!email || !password || !name) {
          return errorResponse('Full name, email address, and initial password are required.', 400);
        }

        // 1. Create user in Supabase Auth with auto-confirmed email
        let createdUser: any = null;

        const { data: newAuthUser, error: authCreateErr } = await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            name,
            role,
          },
          app_metadata: {
            role,
          },
        });

        if (authCreateErr || !newAuthUser?.user) {
          const errMsg = authCreateErr?.message || '';
          // If already in auth.users, adopt and promote user to admin with the new password
          if (errMsg.toLowerCase().includes('already') || errMsg.toLowerCase().includes('registered') || errMsg.toLowerCase().includes('exists')) {
            const { data: userList } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
            const existing = userList?.users?.find((u: { email?: string; id: string }) => u.email?.toLowerCase() === email);

            if (existing) {
              const { data: updated, error: updateErr } = await serviceClient.auth.admin.updateUserById(existing.id, {
                password,
                email_confirm: true,
                user_metadata: { name, role },
                app_metadata: { role },
              });

              if (updateErr) {
                throw new Error(updateErr.message || 'Failed to update existing user in Supabase Auth.');
              }

              createdUser = updated.user;
            } else {
              throw new Error(authCreateErr?.message || 'A user with this email address has already been registered in Supabase Auth.');
            }
          } else {
            throw new Error(authCreateErr?.message || 'Failed to create user in Supabase Auth.');
          }
        } else {
          createdUser = newAuthUser.user;
        }

        // 2. Insert or update protected public.user_roles mapping
        const { error: roleInsertErr } = await serviceClient
          .from('user_roles')
          .upsert([{
            user_id: createdUser.id,
            role: role === 'admin' ? 'admin' : 'superadmin',
          }], { onConflict: 'user_id' });

        if (roleInsertErr) {
          console.error('user_roles insert error:', roleInsertErr);
        }

        // Backfill legacy table for consistency
        try {
          await serviceClient
            .from('master_super_admins')
            .upsert([{
              id: createdUser.id,
              email,
              password_hash: password,
              name,
              role,
            }], { onConflict: 'email' });
        } catch (e) {
          console.warn('master_super_admins backfill notice:', e);
        }

        return jsonResponse({
          success: true,
          admin: {
            id: createdUser.id,
            email: createdUser.email,
            name,
            role,
            created_at: createdUser.created_at,
          },
          message: 'Super administrator created successfully in Supabase Auth.',
        });
      }

      // ------------------------------------------------------------------------
      // 8. DELETE SUPER ADMIN ACCOUNT
      // ------------------------------------------------------------------------
      case 'delete_admin': {
        const { adminId, email } = payload;
        if (!adminId) {
          return errorResponse('adminId is required.', 400);
        }

        if (adminId === callerUser.id) {
          return errorResponse('You cannot delete your own active administrator account.', 400);
        }

        if (email === 'admin@finroute.com') {
          return errorResponse('The primary root system administrator cannot be deleted.', 400);
        }

        // Delete from Supabase Auth (cascades to user_roles)
        const { error: delErr } = await serviceClient.auth.admin.deleteUser(adminId);
        if (delErr) throw delErr;

        // Also clean up legacy table if present
        try {
          await serviceClient.from('master_super_admins').delete().eq('id', adminId);
        } catch (e) {
          console.warn('master_super_admins delete notice:', e);
        }

        return jsonResponse({ success: true, message: 'Administrator account deleted.' });
      }

      // ------------------------------------------------------------------------
      // 9. TENANT LIVE STATS & PING (SERVER-SIDE PROXY)
      // ------------------------------------------------------------------------
      case 'tenant_stats': {
        // DB location and keys are looked up server-side from the tenant id;
        // the browser never chooses which URL the server connects to.
        const statsAccess = payload.tenantId ? await getTenantDbAccess(serviceClient, String(payload.tenantId)) : null;
        if (!statsAccess) {
          return jsonResponse({ connected: false, message: 'Tenant database is not configured.' });
        }

        const startTime = performance.now();
        const tenantClient = getTenantDataClient(statsAccess);

        const [
          { data: customers, error: cErr },
          { data: payments, error: pErr },
          { data: weeks },
        ] = await Promise.all([
          tenantClient.from('customers').select('id, disbursed, original_amount, is_village_divider'),
          tenantClient.from('payments').select('amount'),
          tenantClient.from('weeks').select('id'),
        ]);

        const latency = Math.round(performance.now() - startTime);
        if (cErr) throw cErr;
        if (pErr) throw pErr;

        const realCustomers = (customers || []).filter((c: { is_village_divider?: boolean }) => !c.is_village_divider);
        const totalDisbursed = realCustomers.reduce(
          (sum: number, c: { original_amount?: number; disbursed?: number }) => sum + (Number(c.original_amount || c.disbursed) || 0),
          0
        );
        const totalCollected = (payments || []).reduce(
          (sum: number, p: { amount?: number }) => sum + (Number(p.amount) || 0),
          0
        );

        return jsonResponse({
          connected: true,
          latencyMs: latency,
          customerCount: realCustomers.length,
          weeksCount: (weeks || []).length,
          totalDisbursed,
          totalCollected,
          totalBalance: Math.max(0, totalDisbursed - totalCollected),
        });
      }

      // ------------------------------------------------------------------------
      // 10. TENANT AUDIT LOGS (SERVER-SIDE PROXY)
      // ------------------------------------------------------------------------
      case 'tenant_logs': {
        const logsAccess = payload.tenantId ? await getTenantDbAccess(serviceClient, String(payload.tenantId)) : null;
        if (!logsAccess) {
          return jsonResponse({ success: false, message: 'Tenant database is not configured.', logs: [] });
        }

        const tenantClient = getTenantDataClient(logsAccess);

        const [
          { data: directLogs },
          { data: recentPayments },
          { data: recentCustomers },
          { data: recentArchive },
        ] = await Promise.all([
          tenantClient.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
          tenantClient.from('payments').select('customer_id, week_id, amount, updated_at').order('updated_at', { ascending: false }).limit(20),
          tenantClient.from('customers').select('id, name, disbursed, updated_at, created_at').order('updated_at', { ascending: false }).limit(15),
          tenantClient.from('loan_archive').select('id, name, total_repaid, reason, created_at').order('created_at', { ascending: false }).limit(10),
        ]);

        const combined: Array<Record<string, unknown>> = [];

        // Change history (tenant update 003); ignored if the table doesn't exist yet
        const { data: changeRows } = await tenantClient
          .from('change_log')
          .select('*')
          .order('changed_at', { ascending: false })
          .limit(100);
        const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? '–' : typeof v === 'object' ? '(details)' : String(v));
        (changeRows || []).forEach((c: any) => {
          const fields = Object.keys(c.new_values || c.old_values || {});
          const summary = c.action === 'update'
            ? fields.map((k: string) => k + ': ' + fmt(c.old_values?.[k]) + ' → ' + fmt(c.new_values?.[k])).join('; ')
            : c.table_name === 'payments'
              ? 'amount: ' + fmt((c.new_values || c.old_values)?.amount)
              : '';
          combined.push({
            id: 'chg-' + c.id,
            action: String(c.table_name).toUpperCase() + '_' + String(c.action).toUpperCase(),
            entity_type: 'Change history',
            entity_id: c.record_id,
            details: { summary, by: c.changed_by_email || 'unknown' },
            created_at: c.changed_at,
          });
        });

        if (Array.isArray(directLogs)) {
          directLogs.forEach(l => combined.push(l));
        }

        (recentPayments || []).forEach((p: { customer_id: string; week_id: string; amount?: number; updated_at?: string }, idx: number) => {
          combined.push({
            id: `pay-${idx}-${p.customer_id}-${p.week_id}`,
            action: 'PAYMENT_RECEIVED',
            entity_type: 'Payment',
            entity_id: `${p.customer_id} (${p.week_id})`,
            details: { amount: `₹${Number(p.amount || 0).toLocaleString('en-IN')}`, week: p.week_id },
            created_at: p.updated_at || new Date().toISOString(),
          });
        });

        (recentCustomers || []).forEach((c: { id: string; name?: string; disbursed?: number; updated_at?: string; created_at?: string }, idx: number) => {
          combined.push({
            id: `cust-${idx}-${c.id}`,
            action: 'CUSTOMER_RECORD',
            entity_type: 'Customer',
            entity_id: c.name || c.id,
            details: { disbursed: `₹${Number(c.disbursed || 0).toLocaleString('en-IN')}` },
            created_at: c.updated_at || c.created_at || new Date().toISOString(),
          });
        });

        (recentArchive || []).forEach((a: { id: string; name?: string; reason?: string; total_repaid?: number; created_at?: string }, idx: number) => {
          combined.push({
            id: `arch-${idx}-${a.id}`,
            action: 'LOAN_ARCHIVED',
            entity_type: 'Archive',
            entity_id: a.name || a.id,
            details: { reason: a.reason, totalRepaid: `₹${Number(a.total_repaid || 0).toLocaleString('en-IN')}` },
            created_at: a.created_at || new Date().toISOString(),
          });
        });

        combined.sort((a, b) => new Date(String(b.created_at)).getTime() - new Date(String(a.created_at)).getTime());

        return jsonResponse({ success: true, logs: combined });
      }

      // ------------------------------------------------------------------------
      // 11. PING ALL TENANT DATABASES (KEEP-ALIVE & HEALTH CHECK)
      // ------------------------------------------------------------------------
      case 'ping_all_tenants': {
        const masterStart = performance.now();
        const { data: tenantRows, error: masterErr } = await serviceClient
          .from('master_tenants')
          .select(`
            id,
            client_name,
            business_name,
            email,
            status,
            master_db_configs (
              tenant_supabase_url,
              tenant_anon_key
            )
          `);

        const masterLatency = Math.round(performance.now() - masterStart);
        if (masterErr) throw masterErr;

        const allTenants = tenantRows || [];
        const pingResults = await Promise.all(allTenants.map((t: any) => pingTenantDatabase(serviceClient, {
          id: t.id,
          name: t.client_name || t.business_name || "Tenant",
          email: t.email,
        })));
        const nowIso = new Date().toISOString();
        const masterUrl = Deno.env.get('SUPABASE_URL') || '';
        const logRows: any[] = [
          {
            tenant_id: null,
            tenant_name: 'Master Database',
            tenant_email: 'Central Registry',
            database_url: masterUrl,
            status: 'online',
            latency_ms: masterLatency,
            error_message: null,
            created_at: nowIso,
          }
        ];

        for (const r of pingResults) {
          logRows.push({
            tenant_id: r.tenantId,
            tenant_name: r.name,
            tenant_email: r.email,
            database_url: r.dbUrl,
            status: r.status,
            latency_ms: r.latencyMs,
            error_message: r.errorMessage || null,
            created_at: nowIso,
          });

          try {
            await serviceClient
              .from('master_tenants')
              .update({
                last_health_status: r.status,
                last_latency_ms: r.latencyMs,
                last_health_check_at: nowIso,
              })
              .eq('id', r.tenantId);
          } catch (_) {}
        }

        if (logRows.length > 0) {
          try {
            await serviceClient.from('master_db_health_logs').insert(logRows);
          } catch (_) {}
        }

        const onlineCount = pingResults.filter((r) => r.status === 'online').length;
        const failedCount = pingResults.filter((r) => r.status === 'sleeping' || r.status === 'error').length;

        return jsonResponse({
          success: true,
          message: `Heartbeat complete. ${onlineCount} online, ${failedCount} sleeping/failed.`,
          timestamp: nowIso,
          masterDb: { status: 'online', latencyMs: masterLatency },
          summary: {
            totalTenants: pingResults.length,
            onlineCount,
            failedCount,
            unconfiguredCount: pingResults.filter((r) => r.status === 'unconfigured').length,
          },
          results: pingResults,
        });
      }

      // ------------------------------------------------------------------------
      // 12. GET HEALTH & KEEP-ALIVE LOGS
      // ------------------------------------------------------------------------
      case 'get_health_logs': {
        const limit = Number(payload?.limit) || 100;
        const { data: logs, error: lErr } = await serviceClient
          .from('master_db_health_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);

        if (lErr) throw lErr;
        return jsonResponse({ success: true, logs: logs || [] });
      }

      // ------------------------------------------------------------------------
      // 13. CLEAR HEALTH LOGS
      // ------------------------------------------------------------------------
      case 'clear_health_logs': {
        const { error: cErr } = await serviceClient
          .from('master_db_health_logs')
          .delete()
          .neq('status', '___DO_NOT_MATCH___');

        if (cErr) throw cErr;
        return jsonResponse({ success: true, message: 'Health check logs cleared.' });
      }

      default:
        return errorResponse(`Unsupported administration action: "${action}".`, 400);
    }
  } catch (err: unknown) {
    console.error('admin-tenants exception:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message, 500);
  }
}));
