// ==============================================================================
// Tenant database access helpers for Edge Functions (server-side only)
// ==============================================================================
// Tenant secret keys live in the master Vault and are read through the
// service_role-only RPC admin_get_tenant_secret. They never reach the browser.
// @ts-ignore: Supabase JS library import
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

export const OPERATOR_ROLE = 'operator';

export interface TenantDbAccess {
  tenantId: string;
  url: string;
  anonKey: string;
  secretKey: string | null;
  authUserId: string | null;
  authRequired: boolean;
}

const noSession = { auth: { persistSession: false, autoRefreshToken: false } };

export async function getTenantDbAccess(serviceClient: SupabaseClient, tenantId: string): Promise<TenantDbAccess | null> {
  const { data: cfg, error } = await serviceClient
    .from('master_db_configs')
    .select('tenant_supabase_url, tenant_anon_key, tenant_auth_user_id, tenant_auth_required')
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (error) throw error;
  if (!cfg?.tenant_supabase_url || !cfg?.tenant_anon_key) return null;

  const { data: secret, error: sErr } = await serviceClient.rpc('admin_get_tenant_secret', { p_tenant_id: tenantId });
  if (sErr) console.warn('admin_get_tenant_secret notice:', sErr.message);

  return {
    tenantId,
    url: String(cfg.tenant_supabase_url).trim(),
    anonKey: String(cfg.tenant_anon_key).trim(),
    secretKey: typeof secret === 'string' && secret.trim() ? secret.trim() : null,
    authUserId: cfg.tenant_auth_user_id || null,
    authRequired: Boolean(cfg.tenant_auth_required),
  };
}

/** Privileged client (secret key) when configured, otherwise the public key. */
export function getTenantDataClient(access: TenantDbAccess): SupabaseClient {
  return createClient(access.url, access.secretKey || access.anonKey, noSession);
}

export function getTenantAnonClient(access: TenantDbAccess): SupabaseClient {
  return createClient(access.url, access.anonKey, noSession);
}

/**
 * Creates or updates the operator's Auth user inside the tenant project so it
 * matches the master credentials. Requires the tenant secret key.
 */
export async function syncTenantAuthUser(
  serviceClient: SupabaseClient,
  access: TenantDbAccess,
  opts: { email: string; password?: string; active?: boolean }
): Promise<string> {
  if (!access.secretKey) {
    throw new Error('Tenant secret key is not configured for this tenant.');
  }
  const admin = createClient(access.url, access.secretKey, noSession);
  const email = opts.email.trim().toLowerCase();
  const appMeta = { finroute_role: OPERATOR_ROLE, finroute_tenant_id: access.tenantId };

  const attrs: Record<string, unknown> = { email, app_metadata: appMeta, email_confirm: true };
  if (opts.password) attrs.password = opts.password;
  if (opts.active === false) attrs.ban_duration = '876000h';
  if (opts.active === true) attrs.ban_duration = 'none';

  let userId = access.authUserId;

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, attrs);
    if (error && /not found/i.test(error.message)) {
      userId = null; // stale id (user deleted in tenant project): recreate below
    } else if (error) {
      throw error;
    }
  }

  if (!userId) {
    if (!opts.password) {
      throw new Error('A password is required to create the tenant sign-in account.');
    }
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: opts.password,
      email_confirm: true,
      app_metadata: appMeta,
      ...(opts.active === false ? { ban_duration: '876000h' } : {}),
    });

    if (created?.user) {
      userId = created.user.id;
    } else if (cErr && /already|registered|exists/i.test(cErr.message)) {
      userId = await findTenantUserIdByEmail(admin, email);
      if (!userId) throw cErr;
      const { error: uErr } = await admin.auth.admin.updateUserById(userId, attrs);
      if (uErr) throw uErr;
    } else {
      throw cErr || new Error('Failed to create tenant sign-in account.');
    }

    await serviceClient
      .from('master_db_configs')
      .update({ tenant_auth_user_id: userId, updated_at: new Date().toISOString() })
      .eq('tenant_id', access.tenantId);
  }

  return userId as string;
}

async function findTenantUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u: { email?: string }) => (u.email || '').toLowerCase() === email);
    if (match) return match.id;
    if (users.length < 200) break;
  }
  return null;
}

export interface TenantPingResult {
  tenantId: string;
  name: string;
  email: string;
  dbUrl: string;
  status: 'online' | 'sleeping' | 'error' | 'unconfigured';
  latencyMs: number | null;
  errorMessage?: string | null;
}

/** Lightweight connectivity ping; uses the secret key when available. */
export async function pingTenantDatabase(
  serviceClient: SupabaseClient,
  tenant: { id: string; name: string; email: string }
): Promise<TenantPingResult> {
  const base = { tenantId: tenant.id, name: tenant.name, email: tenant.email };
  let access: TenantDbAccess | null = null;
  try {
    access = await getTenantDbAccess(serviceClient, tenant.id);
  } catch (e) {
    return { ...base, dbUrl: '', status: 'error', latencyMs: null, errorMessage: String((e as Error)?.message || e) };
  }
  if (!access) {
    return { ...base, dbUrl: '', status: 'unconfigured', latencyMs: null, errorMessage: 'No dedicated database URL configured' };
  }

  const client = getTenantDataClient(access);
  const start = performance.now();
  try {
    const result: any = await Promise.race([
      client.from('tenant_settings').select('id').limit(1),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timed out (>6000ms)')), 6000)),
    ]);
    const latency = Math.round(performance.now() - start);

    if (result?.error) {
      const fallback = await client.from('weeks').select('id').limit(1);
      if (fallback.error && !fallback.error.message.includes('42P01')) throw fallback.error;
    }
    return { ...base, dbUrl: access.url, status: 'online', latencyMs: latency };
  } catch (err: any) {
    const latency = Math.round(performance.now() - start);
    const errMsg = String(err?.message || err);
    const isSleeping = /timed out|503|504|Failed to fetch/.test(errMsg);
    return { ...base, dbUrl: access.url, status: isSleeping ? 'sleeping' : 'error', latencyMs: latency, errorMessage: errMsg };
  }
}
