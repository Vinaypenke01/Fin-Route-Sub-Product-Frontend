// ==============================================================================
// SUPABASE EDGE FUNCTION: admin-tenants
// Authenticated Administration Engine for Tenants, DB Configs & Admin Accounts
// Enforces caller role = 'superadmin' on EVERY request.
// Privileged keys (SUPABASE_SERVICE_ROLE_KEY) are stored only in server-side secrets.
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: Supabase JS library import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
// @ts-ignore: TS extension import in Deno
import { handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
// @ts-ignore: TS extension import in Deno
import { verifySuperAdmin } from '../_shared/auth.ts';

declare const Deno: any;

serve(async (req: Request) => {
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

        return jsonResponse({ success: true, tenant });
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
        return jsonResponse({ success: true, message: `Tenant status updated to ${status}.` });
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
        } = payload;

        if (!tenantId) {
          return errorResponse('tenantId is required.', 400);
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

        return jsonResponse({ success: true, message: 'Tenant updated successfully.' });
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
        return jsonResponse({ success: true, message: 'Database configuration updated.' });
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
        const { tenantDbUrl, tenantAnonKey } = payload;
        if (!tenantDbUrl || !tenantAnonKey) {
          return errorResponse('tenantDbUrl and tenantAnonKey are required.', 400);
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
        const { tenantDbUrl, tenantAnonKey, tenantMetadata } = payload;
        if (!tenantDbUrl || !tenantAnonKey) {
          return errorResponse('tenantDbUrl and tenantAnonKey are required.', 400);
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

        const combined: Array<Record<string, unknown>> = [];

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

      default:
        return errorResponse(`Unsupported administration action: "${action}".`, 400);
    }
  } catch (err: unknown) {
    console.error('admin-tenants exception:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorResponse(message, 500);
  }
});
