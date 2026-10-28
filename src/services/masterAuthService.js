import { createClient } from '@supabase/supabase-js';

const masterUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTER_SUPABASE_URL) || 'https://ubhwoicsjmxslggltvaa.supabase.co';
const masterAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_MASTER_SUPABASE_ANON_KEY) || 'sb_publishable_raPNiMJx4rlabjgq3VGQAw_HSKpJ0P5';

// Master client configured with persistent auth session for Super-Admin
export const masterSupabase = createClient(masterUrl, masterAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'FINROUTE_SUPERADMIN_SUPABASE_AUTH',
    detectSessionInUrl: true,
  },
});

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
  try {
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPassword = String(password || '').trim();

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

    let tenantDbUrl = data.tenant_supabase_url;
    let tenantAnonKey = data.tenant_anon_key;

    // Graceful routing: ensure Sunday Kovuru routes directly to their dedicated Supabase database
    if (cleanEmail === 'govinduraju6924@gmail.com' && (!tenantDbUrl || tenantDbUrl === masterUrl)) {
      tenantDbUrl = 'https://bqbtufmyhtzdxbpogivk.supabase.co';
      tenantAnonKey = 'sb_publishable_z5DGuSdW5h67ZRDNAzv6kA_kxfVxxre';
    }

    // Record login audit event asynchronously into the tenant dedicated database
    recordTenantLoginAudit(tenantDbUrl, tenantAnonKey, {
      email: data.email || cleanEmail,
      clientName: data.client_name,
      businessName: data.business_name,
    }).catch(e => console.warn('Tenant login audit non-blocking error:', e));

    return {
      success: true,
      email: data.email,
      clientName: data.client_name,
      businessName: data.business_name,
      tenantDbUrl: tenantDbUrl,
      tenantAnonKey: tenantAnonKey,
      expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : null,
    };
  } catch (err) {
    console.error('authenticateTenant exception:', err);
    return { success: false, message: err.message || 'Unable to connect to master authentication service.' };
  }
}

/**
 * Safely records a user login audit event into the tenant's dedicated database
 */
export async function recordTenantLoginAudit(tenantDbUrl, tenantAnonKey, { email, clientName, businessName }) {
  if (!tenantDbUrl || !tenantAnonKey) return;
  try {
    const client = createClient(tenantDbUrl, tenantAnonKey, { auth: { persistSession: false } });

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
      // Graceful fallback during migration if GoTrue schema error occurs
      try {
        const { data: legacyAdmin } = await masterSupabase
          .from('master_super_admins')
          .select('*')
          .eq('email', cleanEmail)
          .eq('password_hash', cleanPassword)
          .maybeSingle();

        if (legacyAdmin && legacyAdmin.role === 'superadmin') {
          return {
            success: true,
            admin: {
              id: legacyAdmin.id,
              email: legacyAdmin.email,
              name: legacyAdmin.name || cleanEmail.split('@')[0],
              role: 'superadmin',
            },
          };
        }
      } catch (legErr) {
        console.warn('Legacy fallback notice:', legErr);
      }

      return { success: false, message: authErr?.message || 'Invalid administrator credentials.' };
    }

    const user = authData.user;

    // 3. Verify user's role in public.user_roles (Server-side Role Mapping)
    const { data: roleRow, error: roleErr } = await masterSupabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    let role = roleRow?.role;

    // Migration fallback: check master_super_admins
    if (!role) {
      const { data: legacyRow } = await masterSupabase
        .from('master_super_admins')
        .select('name, role')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (legacyRow?.role === 'superadmin') {
        role = 'superadmin';
      }
    }

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
          password_hash,
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
export async function createTenantWithDb({ email, clientName, businessName, password, tenantDbUrl, tenantAnonKey, expiresAt }) {
  try {
    // 1. Call Authenticated Edge Function
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'create_tenant', {
        email,
        clientName,
        businessName,
        password,
        tenantDbUrl,
        tenantAnonKey,
        expiresAt,
      });
      if (res?.success) {
        return { success: true, tenant: res.tenant };
      }
    } catch (e) {
      console.warn('Edge Function admin-tenants create_tenant fallback:', e);
    }

    // 2. Direct query fallback
    const cleanEmail = String(email || '').trim().toLowerCase();

    const { data: tenant, error: tErr } = await masterSupabase
      .from('master_tenants')
      .insert([{
        email: cleanEmail,
        client_name: clientName.trim(),
        business_name: businessName?.trim() || 'FinRoute Collect',
        status: 'active',
      }])
      .select()
      .single();

    if (tErr) throw tErr;

    const { error: cErr } = await masterSupabase
      .from('master_credentials')
      .insert([{
        tenant_id: tenant.id,
        email: cleanEmail,
        password_hash: password.trim(),
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      }]);

    if (cErr) throw cErr;

    if (tenantDbUrl && tenantAnonKey) {
      const { error: dErr } = await masterSupabase
        .from('master_db_configs')
        .insert([{
          tenant_id: tenant.id,
          tenant_supabase_url: tenantDbUrl.trim(),
          tenant_anon_key: tenantAnonKey.trim(),
          db_status: 'connected',
        }]);

      if (dErr) throw dErr;
    }

    return { success: true, tenant };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Super-Admin: Toggle tenant status (active <-> suspended).
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
export async function updateTenantStatus(tenantId, newStatus) {
  try {
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'update_tenant_status', { tenantId, status: newStatus });
      if (res?.success) {
        return { success: true };
      }
    } catch (e) {
      console.warn('Edge Function update_tenant_status fallback:', e);
    }

    const { error } = await masterSupabase
      .from('master_tenants')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', tenantId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
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
}) {
  try {
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
      });
      if (res?.success) {
        return { success: true };
      }
    } catch (e) {
      console.warn('Edge Function update_tenant_full fallback:', e);
    }

    const cleanEmail = String(email || '').trim().toLowerCase();

    const { error: tErr } = await masterSupabase
      .from('master_tenants')
      .update({
        client_name: String(clientName).trim(),
        business_name: String(businessName || 'FinRoute Collect').trim(),
        email: cleanEmail,
        phone: phone ? String(phone).trim() : null,
        status: status || 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId);

    if (tErr) console.warn('master_tenants update notice:', tErr);

    const credsUpdate = {
      email: cleanEmail,
      updated_at: new Date().toISOString(),
    };
    if (password && String(password).trim()) {
      credsUpdate.password_hash = String(password).trim();
    }

    await masterSupabase
      .from('master_credentials')
      .update(credsUpdate)
      .eq('tenant_id', tenantId);

    if (tenantDbUrl !== undefined || tenantAnonKey !== undefined) {
      const dbUpdate = { updated_at: new Date().toISOString() };
      if (tenantDbUrl) dbUpdate.tenant_supabase_url = String(tenantDbUrl).trim();
      if (tenantAnonKey) dbUpdate.tenant_anon_key = String(tenantAnonKey).trim();

      await masterSupabase
        .from('master_db_configs')
        .update(dbUpdate)
        .eq('tenant_id', tenantId);
    }

    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Super-Admin: Update a tenant's database URL and Anon Key in master DB.
 * Routes through the authenticated 'admin-tenants' Edge Function.
 */
export async function updateTenantDbConfig(tenantId, tenantDbUrl, tenantAnonKey) {
  try {
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'update_tenant_db', {
        tenantId,
        tenantDbUrl,
        tenantAnonKey,
      });
      if (res?.success) {
        return { success: true };
      }
    } catch (e) {
      console.warn('Edge Function update_tenant_db fallback:', e);
    }

    const { error } = await masterSupabase
      .from('master_db_configs')
      .update({
        tenant_supabase_url: String(tenantDbUrl).trim(),
        tenant_anon_key: String(tenantAnonKey).trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, message: err.message };
  }
}

/**
 * Super-Admin: Fetch live audit logs & recent ledger transactions directly from tenant DB.
 */
export async function fetchTenantAuditLogs(tenantDbUrl, tenantAnonKey, tenantMetadata = {}) {
  if (!tenantDbUrl || !tenantAnonKey) {
    return { success: false, message: 'Tenant database is not configured.', logs: [] };
  }

  try {
    // 1. Try Edge Function proxy first
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'tenant_logs', {
        tenantDbUrl,
        tenantAnonKey,
        tenantMetadata,
      });
      if (res?.success) {
        return { success: true, logs: res.logs || [] };
      }
    } catch {
      // fallback to direct client query below
    }

    const tenantClient = createClient(tenantDbUrl, tenantAnonKey, { auth: { persistSession: false } });

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

    const combined = [];

    if (Array.isArray(directLogs)) {
      directLogs.forEach(l => combined.push(l));
    }

    (recentPayments || []).forEach((p, idx) => {
      combined.push({
        id: `pay-${idx}-${p.customer_id}-${p.week_id}`,
        action: 'PAYMENT_RECEIVED',
        entity_type: 'Payment',
        entity_id: `${p.customer_id} (${p.week_id})`,
        details: { amount: `₹${Number(p.amount || 0).toLocaleString('en-IN')}`, week: p.week_id },
        created_at: p.updated_at || new Date().toISOString(),
      });
    });

    (recentCustomers || []).forEach((c, idx) => {
      combined.push({
        id: `cust-${idx}-${c.id}`,
        action: 'CUSTOMER_RECORD',
        entity_type: 'Customer',
        entity_id: c.name || c.id,
        details: { disbursed: `₹${Number(c.disbursed || 0).toLocaleString('en-IN')}` },
        created_at: c.updated_at || c.created_at || new Date().toISOString(),
      });
    });

    (recentArchive || []).forEach((a, idx) => {
      combined.push({
        id: `arch-${idx}-${a.id}`,
        action: 'LOAN_ARCHIVED',
        entity_type: 'Archive',
        entity_id: a.name || a.id,
        details: { reason: a.reason, totalRepaid: `₹${Number(a.total_repaid || 0).toLocaleString('en-IN')}` },
        created_at: a.created_at || new Date().toISOString(),
      });
    });

    combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return { success: true, logs: combined };
  } catch (err) {
    return { success: false, message: err.message, logs: [] };
  }
}

/**
 * Super-Admin: Live Ping and Data Statistics of Tenant DB.
 */
export async function fetchTenantStats(tenantDbUrl, tenantAnonKey) {
  if (!tenantDbUrl || !tenantAnonKey) {
    return { connected: false, message: 'No DB credentials' };
  }

  try {
    // 1. Try Edge Function proxy first
    try {
      const res = await invokeAdminEdgeFunction('admin-tenants', 'tenant_stats', {
        tenantDbUrl,
        tenantAnonKey,
      });
      if (res?.connected !== undefined) {
        return res;
      }
    } catch {
      // fallback to direct client query below
    }

    const startTime = performance.now();
    const tenantClient = createClient(tenantDbUrl, tenantAnonKey, { auth: { persistSession: false } });

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

    const realCustomers = (customers || []).filter(c => !c.is_village_divider);
    const totalDisbursed = realCustomers.reduce((sum, c) => sum + (Number(c.original_amount || c.disbursed) || 0), 0);
    const totalCollected = (payments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    return {
      connected: true,
      latencyMs: latency,
      customerCount: realCustomers.length,
      weeksCount: (weeks || []).length,
      totalDisbursed,
      totalCollected,
      totalBalance: Math.max(0, totalDisbursed - totalCollected),
    };
  } catch (err) {
    return {
      connected: false,
      message: err.message,
    };
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
