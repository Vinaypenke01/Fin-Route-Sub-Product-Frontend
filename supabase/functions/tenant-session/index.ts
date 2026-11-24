// ==============================================================================
// SUPABASE EDGE FUNCTION: tenant-session
// Keeps the "one active device per tenant" record up to date.
//   { action: 'heartbeat', email, deviceSessionId } -> { active: true|false }
//   { action: 'logout',    email, deviceSessionId } -> { success: true }
//   { action: 'change_password', email, deviceSessionId, currentPassword, newPassword }
// The device session id is a random secret created on the device at login, so
// only that device can refresh or release its own session.
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: TS extension import in Deno
import { withCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
// @ts-ignore: TS extension import in Deno
import { getServiceClient } from '../_shared/auth.ts';
// @ts-ignore: TS extension import in Deno
import { isValidDeviceSessionId } from '../_shared/session.ts';
// @ts-ignore: TS extension import in Deno
import { passwordProblem } from '../_shared/password.ts';
// @ts-ignore: TS extension import in Deno
import { getTenantDbAccess, syncTenantAuthUser } from '../_shared/tenant.ts';

serve(withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const email = String(body?.email || '').trim().toLowerCase();
    const deviceSessionId = body?.deviceSessionId;

    if (!email || !isValidDeviceSessionId(deviceSessionId) || !['heartbeat', 'logout', 'change_password'].includes(action)) {
      return errorResponse('Invalid request.', 400);
    }

    const serviceClient = getServiceClient();
    const { data: tenant, error: tErr } = await serviceClient
      .from('master_tenants')
      .select('id, status')
      .eq('email', email)
      .maybeSingle();
    if (tErr) throw tErr;
    if (!tenant) {
      return action === 'change_password'
        ? jsonResponse({ success: false, message: 'Please sign in again, then change your password.' })
        : jsonResponse({ success: true, active: false, reason: 'ended' });
    }

    if (action === 'change_password') {
      const currentPassword = String(body?.currentPassword || '').trim();
      const newPassword = String(body?.newPassword || '');
      // Only the device that holds the active session may change the password
      const { data: active } = await serviceClient
        .from('master_active_sessions').select('session_id').eq('tenant_id', tenant.id).maybeSingle();
      if (!active || active.session_id !== deviceSessionId) {
        return jsonResponse({ success: false, message: 'Please sign in again, then change your password.' });
      }
      // Verify the current password with the normal login check (counts toward lockout)
      const { data: verify, error: vErr } = await serviceClient.rpc('verify_tenant_login', { p_email: email, p_password: currentPassword });
      if (vErr) throw vErr;
      if (!verify?.success) {
        return jsonResponse({ success: false, message: verify?.message === 'Invalid email or password.' ? 'Current password is not correct.' : (verify?.message || 'Current password is not correct.') });
      }
      const problem = passwordProblem(newPassword, email);
      if (problem) return jsonResponse({ success: false, message: problem });
      if (newPassword === currentPassword) return jsonResponse({ success: false, message: 'Choose a password different from the current one.' });

      const { error: pErr } = await serviceClient
        .from('master_credentials').update({ password_hash: newPassword }).eq('tenant_id', tenant.id); // hashed by DB trigger
      if (pErr) throw pErr;

      // Keep the tenant database sign-in in step
      try {
        const access = await getTenantDbAccess(serviceClient, tenant.id);
        if (access?.secretKey) await syncTenantAuthUser(serviceClient, access, { email, password: newPassword });
      } catch (e) {
        console.error('Tenant password sync after change failed (will resync at next login):', e);
      }
      return jsonResponse({ success: true, message: 'Password changed.' });
    }

    if (action === 'logout') {
      // Only this device may release its own session
      await serviceClient
        .from('master_active_sessions')
        .delete()
        .eq('tenant_id', tenant.id)
        .eq('session_id', deviceSessionId);
      return jsonResponse({ success: true });
    }

    // heartbeat
    if (tenant.status !== 'active') {
      await serviceClient.from('master_active_sessions').delete().eq('tenant_id', tenant.id);
      return jsonResponse({ success: true, active: false, reason: 'suspended' });
    }

    const { data: updated, error: uErr } = await serviceClient
      .from('master_active_sessions')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('tenant_id', tenant.id)
      .eq('session_id', deviceSessionId)
      .select('tenant_id');
    if (uErr) throw uErr;

    if (!updated || updated.length === 0) {
      // Row gone (ended by admin / logged out) or taken over by another device
      return jsonResponse({ success: true, active: false, reason: 'ended' });
    }
    return jsonResponse({ success: true, active: true });
  } catch (err: unknown) {
    console.error('tenant-session exception:', err);
    return errorResponse('Session service error.', 500);
  }
}));
