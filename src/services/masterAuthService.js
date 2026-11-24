import { createClient } from '@supabase/supabase-js';
import { getDeviceSessionId, getDeviceLabel } from './deviceSession';

const masterUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTER_SUPABASE_URL) || '';
const masterAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTER_SUPABASE_ANON_KEY) || '';

export const isMasterConfigured = Boolean(masterUrl && masterAnonKey);

// When the build is missing its settings, every call fails with a clear
// message (shown to the user) instead of crashing the whole screen on load.
function notConfiguredClient() {
  const fail = () => { throw new Error('Sign-in service is not configured. Please contact support.'); };
  return new Proxy({}, { get: () => new Proxy(fail, { get: fail, apply: fail }) });
}

// Master client configured with persistent auth session for Super-Admin
export const masterSupabase = isMasterConfigured
  ? createClient(masterUrl, masterAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'FINROUTE_SUPERADMIN_SUPABASE_AUTH',
        detectSessionInUrl: true,
      },
    })
  : notConfiguredClient();

/**
 * Helper to invoke authenticated Admin Edge Functions.
 * Automatically attaches the active Supabase Auth JWT Bearer token.
 */
async function invokeAdminEdgeFunction(functionName, action, payload = {}) {
  try {
    const { data: { session } } = await masterSupabase.auth.getSession();
    const token = session?.access_token;

    const { data, error } = await masterSupabase.functions.invoke(functionName, {
      body: { action, payload },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (error) {
      throw error;
    }
    return data;
  } catch (err) {
    console.warn(`Edge Function "${functionName}" notice:`, err);
    throw err;
  }
}

/**
 * Authenticates an operator/tenant against the Master Database.
 * Returns tenant metadata and their isolated database connection details.
 */
export async function authenticateTenant(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '').trim();

  try {
    // 1. Preferred: tenant-login Edge Function (verifies in master, returns a
    //    tenant Auth session so the tenant DB can require signed-in operators).
    const { data, error } = await masterSupabase.functions.invoke('tenant-login', {
      body: {
        email: cleanEmail,
        password: cleanPassword,
        deviceSessionId: getDeviceSessionId(),
        deviceLabel: getDeviceLabel(),
      },
    });

    if (!error && data) {
      if (!data.success) {
        return { success: false, message: data.message || 'Invalid email or password.' };
      }
      return {
        success: true,
        email: data.email,
        clientName: data.clientName,
        businessName: data.businessName,
        tenantDbUrl: data.tenantDbUrl,
        tenantAnonKey: data.tenantAnonKey,
        tenantAuthRequired: Boolean(data.tenantAuthRequired),
        tenantSession: data.session || null,
        deviceSessionManaged: true,
        mustChangePassword: Boolean(data.mustChangePassword),
        expiresAt: data.expiresAt ? new Date(data.expiresAt).getTime() : null,
      };
    }

    const status = error?.context?.status;
    if (status && status !== 404) {
      let message = 'Authentication service error.';
      try {
        const body = await error.context.json();
        message = body?.message || body?.error || message;
      } catch { /* ignore */ }
      return { success: false, message };
    }
    console.warn('tenant-login unavailable, falling back to legacy RPC login:', error);
  } catch (err) {
    console.warn('tenant-login call failed, falling back to legacy RPC login:', err);
  }

  // 2. Legacy fallback (function not deployed yet): public-key mode, no session
  try {
    const { data, error } = await masterSupabase.rpc('verify_tenant_login', {
      p_email: cleanEmail,
      p_password: cleanPassword,
    });

    if (error) {
      console.error('Master RPC error:', error);
      return { success: false, message: error.message || 'Authentication service error.' };
    }

    if (!data || !data.success) {
      return { success: false, message: data?.message || 'Invalid email or password.' };
    }

    if (data.tenant_auth_required) {
      return { success: false, message: 'Secure sign-in service is unavailable. Please try again shortly.' };
    }

    return {
      success: true,
      email: data.email,
      clientName: data.client_name,
      businessName: data.business_name,
      tenantDbUrl: data.tenant_supabase_url,
      tenantAnonKey: data.tenant_anon_key,
      tenantAuthRequired: false,
      tenantSession: null,
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null,
    };
  } catch (err) {
    console.error('authenticateTenant exception:', err);
    return { success: false, message: err.message || 'Unable to connect to master authentication service.' };
  }
}

/**
 * Safely records a user login audit event into the tenant's dedicated database.
 * Pass the tenant client that already holds the operator's session.
 */
export async function recordTenantLoginAudit(client, { email, clientName, businessName }) {
  if (!client) return;
  try {

    let device = 'Desktop / PC';
    let browser = 'Web Browser';
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) {
        device = 'Mobile Device';
      } else if (/Tablet/i.test(ua)) {
        device = 'Tablet Device';
      }
      if (ua.includes('Chrome/')) browser = 'Google Chrome';
      else if (ua.includes('Safari/') && !ua.includes('Chrome/')) browser = 'Safari';
      else if (ua.includes('Firefox/')) browser = 'Mozilla Firefox';
      else if (ua.includes('Edg/')) browser = 'Microsoft Edge';
    }

    await client.from('audit_logs').insert([{
      action: 'USER_LOGIN',
      entity_type: 'Auth Session',
      entity_id: email,
      details: {
        clientName: clientName || 'Authorized Operator',
        businessName: businessName || 'FinRoute Collect',
        device: device,
        browser: browser,
        status: 'Session Authenticated',
        authMethod: 'Master Password Gateway',
        sessionToken: 'active',
      },
    }]);
  } catch (err) {
    console.warn('Could not record login audit:', err?.message || err);
  }
}

/**
 * Authenticates Super Admin using Supabase Auth & validates protected role mapping.
 * Priority 1: Supabase Edge Function 'super-admin-login'
 * Priority 2: Direct Supabase Auth signInWithPassword + public.user_roles verification
 */
export async function authenticateSuperAdmin(email, password) {
  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();

    // 1. Attempt authentication via super-admin-login Edge Function
    try {
      const { data, error } = await masterSupabase.functions.invoke('super-admin-login', {
        body: { email: cleanEmail, password: cleanPassword },
      });

      if (!error && data?.success && data?.session) {
        // Hydrate client Supabase Auth session with the verified tokens
        await masterSupabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        return {
          success: true,
          admin: data.admin,
          session: data.session,
        };
      }

      if (data && !data.success) {
        return { success: false, message: data.message || data.error || 'Authentication rejected.' };
      }
    } catch (edgeErr) {
      console.warn('Edge function super-admin-login fallback to Supabase Auth client:', edgeErr);
    }

    // 2. Direct Supabase Auth Client Authentication fallback
    const { data: authData, error: authErr } = await masterSupabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    if (authErr || !authData?.user) {
      return { success: false, message: 'Invalid administrator email or password.' };
    }

    const user = authData.user;

    // 3. Verify user's role in public.user_roles (Server-side Role Mapping)
    const { data: roleRow, error: roleErr } = await masterSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const role = roleRow?.role;

    if (role !== 'superadmin') {
      await masterSupabase.auth.signOut();
      return {
        success: false,
        message: 'Access forbidden. This account does not have super-admin privileges.',
      };
    }

    const adminProfile = {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || cleanEmail.split('@')[0],
      role: 'superadmin',
    };

    return {
      success: true,
      admin: adminProfile,
      session: authData.session,
    };
  } catch (err) {
    return { success: false, message: err.message || 'Authentication error.' };
  }
}

/**
 * Checks and returns existing Super Admin Supabase Auth session on reload
 */
export async function getSuperAdminSession() {
  try {
    const { data: { session }, error } = await masterSupabase.auth.getSession();
    if (error || !session?.user) return null;

    const user = session.user;

    // Verify role mapping
    const { data: roleRow } = await masterSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleRow && roleRow.role !== 'superadmin') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email?.split('@')[0],
      role: 'superadmin',
      token: session.access_token,
    };
  } catch {
    return null;
  }
}

/**
 * Signs out Super Admin from Supabase Auth
 */
export async function logoutSuperAdmin() {
  try {
    await masterSupabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase Auth signOut notice:', err);
  }
}

/**
 * Super-Admin: Fetch all registered tenants and their database configs.
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
export async function getTenantsList() {
  try {
    // 1. Call Authenticated Edge Function
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'list_tenants');
      if (res?.success) {
        return { success: true, data: res.data || [] };
      }
    } catch (e) {
      console.warn('Edge Function admin-tenants list_tenants fallback to direct query:', e);
    }

    // 2. Direct query fallback (authorized via RLS is_super_admin policy)
    const { data: tenants, error: tErr } = await masterSupabase
      .from('master_tenants')
      .select(`
        id,
        email,
        client_name,
        phone,
        business_name,
        status,
        created_at,
        master_db_configs (
          tenant_supabase_url,
          tenant_anon_key,
          db_status,
          last_health_check
        ),
        master_credentials (
          last_login,
          expires_at
        )
      `)
      .order('created_at', { ascending: false });

    if (tErr) throw tErr;
    return { success: true, data: tenants || [] };
  } catch (err) {
    return { success: false, message: err.message, data: [] };
  }
}

/**
 * Super-Admin: Register a new tenant with their dedicated Supabase database.
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
async function edgeErrorMessage(err, fallback) {
  try {
    const body = await err?.context?.json();
    return body?.message || body?.error || err?.message || fallback;
  } catch {
    return err?.message || fallback;
  }
}

function warningsMessage(res) {
  return Array.isArray(res?.warnings) && res.warnings.length ? res.warnings.join(' ') : null;
}

export async function createTenantWithDb({ email, clientName, businessName, password, tenantDbUrl, tenantAnonKey, tenantSecretKey, expiresAt }) {
  // Edge Function only: it also stores the secret key in Vault and creates the
  // operator's tenant sign-in account, which a direct table write would skip.
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'create_tenant', {
      email,
      clientName,
      businessName,
      password,
      tenantDbUrl,
      tenantAnonKey,
      tenantSecretKey,
      expiresAt,
    });
    if (res?.success) {
      return { success: true, tenant: res.tenant, warning: warningsMessage(res) };
    }
    return { success: false, message: res?.message || res?.error || 'Failed to create tenant.' };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Failed to create tenant.') };
  }
}

/**
 * Super-Admin: Toggle tenant status (active <-> suspended).
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
export async function updateTenantStatus(tenantId, newStatus) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'update_tenant_status', { tenantId, status: newStatus });
    if (res?.success) {
      return { success: true, warning: warningsMessage(res) };
    }
    return { success: false, message: res?.message || 'Failed to update status.' };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Failed to update status.') };
  }
}

/**
 * Super-Admin: Update complete tenant profile, credentials, and DB config.
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
export async function updateTenantFullDetails({
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
}) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'update_tenant_full', {
      tenantId,
      clientName,
      businessName,
      email,
      phone,
      status,
      password,
      tenantDbUrl,
      tenantAnonKey,
      tenantSecretKey: tenantSecretKey || undefined,
      tenantAuthRequired,
    });
    if (res?.success) {
      return { success: true, warning: warningsMessage(res) };
    }
    return { success: false, message: res?.message || 'Failed to update tenant.' };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Failed to update tenant.') };
  }
}

/**
 * Super-Admin: Update a tenant's database URL and Anon Key in master DB.
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
/**
 * Super-Admin: which tenant database update each tenant has applied.
 * Returns { [tenantId]: { status: 'ok'|'no_key'|'unconfigured'|'error', version, message? } }
 */
export async function fetchTenantVersions() {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'tenant_versions');
    return res?.success ? (res.versions || {}) : {};
  } catch {
    return {};
  }
}

/**
 * Super-Admin: end the operator's active session (lost or stolen phone).
 */
export async function endTenantSession(tenantId) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'end_session', { tenantId });
    if (res?.success) return { success: true, message: res.message, warning: warningsMessage(res) };
    return { success: false, message: res?.message || 'Failed to end session.' };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Failed to end session.') };
  }
}

/** Super-Admin: recent app error reports from operators' devices. */
export async function listClientErrors(limit = 100) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'list_client_errors', { limit });
    return res?.success ? { success: true, errors: res.errors || [] } : { success: false, message: res?.message, errors: [] };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Could not load error reports.'), errors: [] };
  }
}

/** Super-Admin: backup runs for one tenant (newest first). */
export async function listTenantBackups(tenantId) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'list_backups', { tenantId });
    return res?.success ? { success: true, runs: res.runs || [] } : { success: false, message: res?.message, runs: [] };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Could not load backups.'), runs: [] };
  }
}

/** Super-Admin: a 5-minute download link for one backup file. */
export async function getBackupDownloadUrl(tenantId, path) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'backup_download_url', { tenantId, path });
    return res?.success ? { success: true, url: res.url } : { success: false, message: res?.message };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Could not create a download link.') };
  }
}

/** Super-Admin: back up one tenant right now. */
export async function runTenantBackup(tenantId) {
  try {
    const { data: { session } } = await masterSupabase.auth.getSession();
    const { data, error } = await masterSupabase.functions.invoke('tenant-backup', {
      body: { tenantId },
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    });
    if (error) return { success: false, message: await edgeErrorMessage(error, 'Backup failed.') };
    const r = (data?.results || [])[0];
    if (r?.status === 'success') return { success: true, message: 'Backup saved.' };
    return { success: false, message: r?.error || data?.message || 'Backup failed.' };
  } catch (err) {
    return { success: false, message: err?.message || 'Backup failed.' };
  }
}

/** Operator: change own password (needs the current one). */
export async function changeTenantPassword(email, currentPassword, newPassword) {
  try {
    const { data, error } = await masterSupabase.functions.invoke('tenant-session', {
      body: { action: 'change_password', email, deviceSessionId: getDeviceSessionId(), currentPassword, newPassword },
    });
    if (error) return { success: false, message: await edgeErrorMessage(error, 'Could not change the password.') };
    return { success: Boolean(data?.success), message: data?.message };
  } catch (err) {
    return { success: false, message: err?.message || 'Could not change the password. Check your internet connection.' };
  }
}

/**
 * Operator: keep this device's session alive / release it on logout.
 * Returns { active: boolean | null } (null = couldn't reach the server).
 */
export async function tenantSessionPing(action, email, deviceSessionId) {
  try {
    const { data, error } = await masterSupabase.functions.invoke('tenant-session', {
      body: { action, email, deviceSessionId },
    });
    if (error || !data) return { active: null };
    return { active: data.active === undefined ? null : Boolean(data.active), reason: data.reason || null };
  } catch {
    return { active: null };
  }
}

/**
 * Super-Admin: Permanently delete a tenant from the master registry.
 * The server also removes the operator's sign-in account in the tenant
 * project and the stored secret key. The tenant's own Supabase project and
 * ledger data are NOT deleted.
 */
export async function deleteTenant(tenantId, confirmEmail) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'delete_tenant', { tenantId, confirmEmail });
    if (res?.success) {
      return { success: true, message: res.message, warning: warningsMessage(res) };
    }
    return { success: false, message: res?.message || 'Failed to delete tenant.' };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Failed to delete tenant.') };
  }
}

export async function updateTenantDbConfig(tenantId, tenantDbUrl, tenantAnonKey, tenantSecretKey) {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'update_tenant_db', {
      tenantId,
      tenantDbUrl,
      tenantAnonKey,
      tenantSecretKey: tenantSecretKey || undefined,
    });
    if (res?.success) {
      return { success: true, warning: warningsMessage(res) };
    }
    return { success: false, message: res?.message || 'Failed to update database config.' };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Failed to update database config.') };
  }
}

/**
 * Super-Admin: Fetch live audit logs & recent ledger transactions directly from tenant DB.
 */
export async function fetchTenantAuditLogs(tenantId) {
  if (!tenantId) {
    return { success: false, message: 'Tenant database is not configured.', logs: [] };
  }
  // Server-side only: the tenant DB is read with the tenant secret key from Vault.
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'tenant_logs', { tenantId });
    if (res?.success) {
      return { success: true, logs: res.logs || [] };
    }
    return { success: false, message: res?.message || 'Could not load tenant activity.', logs: [] };
  } catch (err) {
    return { success: false, message: await edgeErrorMessage(err, 'Could not load tenant activity.'), logs: [] };
  }
}

/**
 * Super-Admin: Live Ping and Data Statistics of Tenant DB (server-side).
 */
export async function fetchTenantStats(tenantId) {
  if (!tenantId) {
    return { connected: false, message: 'No DB credentials' };
  }
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'tenant_stats', { tenantId });
    if (res?.connected !== undefined) {
      return res;
    }
    return { connected: false, message: res?.message || 'Could not reach tenant database.' };
  } catch (err) {
    return { connected: false, message: await edgeErrorMessage(err, 'Could not reach tenant database.') };
  }
}

/**
 * Super-Admin: Fetch all registered system administrators.
 * Uses Edge Function 'admin-tenants' to query Supabase Auth users + role mapping.
 */
export async function fetchSuperAdmins() {
  try {
    // 1. Call Authenticated Edge Function
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'list_admins');
      if (res?.success) {
        return { success: true, admins: res.admins || [] };
      }
    } catch (e) {
      console.warn('Edge Function list_admins fallback:', e);
    }

    // 2. Direct query fallback
    const { data: roles } = await masterSupabase
      .from('user_roles')
      .select('user_id, role, created_at');

    const { data: legacy } = await masterSupabase
      .from('master_super_admins')
      .select('id, email, name, role, created_at');

    const combined = (legacy || []).map(a => ({
      id: a.id,
      email: a.email,
      name: a.name,
      role: a.role,
      created_at: a.created_at,
    }));

    return { success: true, admins: combined };
  } catch (err) {
    return { success: false, message: err.message, admins: [] };
  }
}

/**
 * Super-Admin: Create another administrator account in Supabase Auth.
 * Routes through the authenticated 'admin-tenants' Edge Function with SUPABASE_SERVICE_ROLE_KEY.
 */
export async function createSuperAdmin({ email, password, name, role = 'superadmin' }) {
  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();
    const cleanName = String(name || '').trim();
    const cleanRole = String(role || 'superadmin').trim();

    if (!cleanEmail || !cleanPassword || !cleanName) {
      return { success: false, message: 'Full name, email address, and initial password are required.' };
    }

    // 1. Call Authenticated Edge Function (creates user in Supabase Auth via Admin API)
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'create_admin', {
        email: cleanEmail,
        password: cleanPassword,
        name: cleanName,
        role: cleanRole,
      });

      if (res?.success) {
        return { success: true, admin: res.admin, message: res.message };
      }
      if (res && !res.success) {
        return { success: false, message: res.message || res.error };
      }
    } catch (e) {
      console.warn('Edge Function create_admin fallback notice:', e);
    }

    // 2. Client-side fallback: Attempt Supabase Auth signUp + public.user_roles
    const { data: authData, error: authErr } = await masterSupabase.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: { name: cleanName, role: cleanRole },
      },
    });

    if (authErr) {
      return { success: false, message: authErr.message };
    }

    if (authData?.user) {
      await masterSupabase
        .from('user_roles')
        .insert([{ user_id: authData.user.id, role: cleanRole }])
        .catch(() => {});
    }

    return {
      success: true,
      admin: {
        id: authData?.user?.id,
        email: cleanEmail,
        name: cleanName,
        role: cleanRole,
      },
    };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Super-Admin: Delete an administrator account in Supabase Auth.
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
export async function deleteSuperAdmin(adminId, currentEmail) {
  try {
    if (!adminId) return { success: false, message: 'Invalid admin ID' };

    // 1. Call Authenticated Edge Function
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'delete_admin', {
        adminId,
        email: currentEmail,
      });
      if (res?.success) {
        return { success: true };
      }
      if (res && !res.success) {
        return { success: false, message: res.message || res.error };
      }
    } catch (e) {
      console.warn('Edge Function delete_admin fallback notice:', e);
    }

    // 2. Fallback direct table cleanup
    const { error } = await masterSupabase
      .from('user_roles')
      .delete()
      .eq('user_id', adminId);

    await masterSupabase.from('master_super_admins').delete().eq('id', adminId).catch(() => {});

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Super-Admin: Ping and wake up all tenant databases & master database (Heartbeat & Keep-Alive).
 * Routes through the authenticated 'admin-tenants' Edge Function or 'keep-alive'.
 */
export async function pingAllTenantDatabases() {
  try {
    const res = await invokeAdminEdgeFunction('admin-tenants', 'ping_all_tenants', {});
    if (res?.success) {
      return res;
    }
    // Fallback: direct invoke keep-alive function
    const { data, error } = await masterSupabase.functions.invoke('keep-alive', {});
    if (!error && data?.success) {
      return data;
    }
    return { success: false, message: res?.message || error?.message || 'Failed to ping databases' };
  } catch (err) {
    console.warn('pingAllTenantDatabases notice:', err);
    return { success: false, message: err.message || 'Error triggering database heartbeat' };
  }
}

/**
 * Super-Admin: Fetch historical database keep-alive & health check logs from master DB.
 */
export async function fetchMasterDbHealthLogs(limit = 100) {
  try {
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'get_health_logs', { limit });
      if (res?.success) {
        return { success: true, logs: res.logs || [] };
      }
    } catch (e) {
      console.warn('Edge function get_health_logs fallback notice:', e);
    }

    const { data, error } = await masterSupabase
      .from('master_db_health_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return { success: false, logs: [], message: error.message };
    }
    return { success: true, logs: data || [] };
  } catch (err) {
    return { success: false, logs: [], message: err.message };
  }
}

/**
 * Super-Admin: Clear historical health logs from master DB.
 */
export async function clearMasterDbHealthLogs() {
  try {
    const { error } = await masterSupabase
      .from('master_db_health_logs')
      .delete()
      .neq('status', '___DO_NOT_MATCH___');

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}
