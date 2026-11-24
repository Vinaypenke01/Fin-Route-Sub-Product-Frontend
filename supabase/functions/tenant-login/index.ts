// ==============================================================================
// SUPABASE EDGE FUNCTION: tenant-login
// 1. Verifies operator credentials against the master DB (lockout, status,
//    expiry, bcrypt) via verify_tenant_login.
// 2. Makes sure the operator has a matching Auth user in their tenant project
//    (created / password-synced with the tenant secret key from Vault).
// 3. Signs in to the tenant project and returns that session, so the browser
//    never needs to store the password and tenant RLS can require auth.
//
// Tenants without a secret key configured fall back to the legacy public-key
// mode (session: null) unless tenant_auth_required is set.
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// @ts-ignore: TS extension import in Deno
import { withCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
// @ts-ignore: TS extension import in Deno
import { getServiceClient } from '../_shared/auth.ts';
// @ts-ignore: TS extension import in Deno
import { getTenantDbAccess, getTenantAnonClient, syncTenantAuthUser } from '../_shared/tenant.ts';
// @ts-ignore: TS extension import in Deno
import { decideLogin, inUseMessage, isValidDeviceSessionId, cleanDeviceLabel } from '../_shared/session.ts';

serve(withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '').trim();
    if (!email || !password) {
      return errorResponse('Email and password are required.', 400);
    }

    const serviceClient = getServiceClient();

    // 1. Master verification (same checks as the legacy RPC login)
    const { data: verify, error: vErr } = await serviceClient.rpc('verify_tenant_login', {
      p_email: email,
      p_password: password,
    });
    if (vErr) {
      console.error('verify_tenant_login error:', vErr);
      return errorResponse('Authentication service error.', 500);
    }
    if (!verify?.success) {
      // Same shape as the RPC so the client's fallback logic keeps working
      return jsonResponse({ success: false, message: verify?.message || 'Invalid email or password.' });
    }

    const tenantId = String(verify.tenant_id || '');

    // 2. One active device per tenant (checked only after the password is
    //    verified, so wrong passwords learn nothing about other devices).
    const deviceSessionId = body?.deviceSessionId;
    if (!isValidDeviceSessionId(deviceSessionId)) {
      return jsonResponse({ success: false, message: 'Please refresh the page to update the app, then sign in again.' });
    }
    if (tenantId) {
      const { data: activeRow, error: aErr } = await serviceClient
        .from('master_active_sessions')
        .select('session_id, device_label, last_seen_at')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (aErr) {
        console.error('master_active_sessions read error:', aErr);
        return errorResponse('Authentication service error.', 500);
      }
      const decision = decideLogin(activeRow, deviceSessionId);
      if (!decision.allow) {
        return jsonResponse({ success: false, code: 'IN_USE', message: inUseMessage(decision) });
      }
      const nowIso = new Date().toISOString();
      const { error: uErr } = await serviceClient.from('master_active_sessions').upsert({
        tenant_id: tenantId,
        session_id: deviceSessionId,
        device_label: cleanDeviceLabel(body?.deviceLabel),
        ip_address: (req.headers.get('x-forwarded-for') || '').split(',')[0].trim().slice(0, 64) || null,
        started_at: nowIso,
        last_seen_at: nowIso,
      }, { onConflict: 'tenant_id' });
      if (uErr) {
        console.error('master_active_sessions upsert error:', uErr);
        return errorResponse('Authentication service error.', 500);
      }
    }

    const profile = {
      success: true,
      tenantId,
      email: verify.email,
      clientName: verify.client_name,
      businessName: verify.business_name,
      tenantDbUrl: verify.tenant_supabase_url,
      tenantAnonKey: verify.tenant_anon_key,
      tenantAuthRequired: Boolean(verify.tenant_auth_required),
      expiresAt: verify.expires_at,
    };

    // 2. Tenant project sign-in
    const access = tenantId ? await getTenantDbAccess(serviceClient, tenantId) : null;
    if (!access || !access.secretKey) {
      if (profile.tenantAuthRequired) {
        return errorResponse('Tenant sign-in is required but not configured. Please contact administrator.', 500);
      }
      return jsonResponse({ ...profile, session: null });
    }

    const tenantAnon = getTenantAnonClient(access);
    const tenantEmail = String(verify.email || email).toLowerCase();

    let signIn = await tenantAnon.auth.signInWithPassword({ email: tenantEmail, password });
    if (signIn.error || !signIn.data?.session) {
      // Master password is verified: (re)provision the tenant user to match it.
      try {
        await syncTenantAuthUser(serviceClient, access, { email: tenantEmail, password, active: true });
        signIn = await tenantAnon.auth.signInWithPassword({ email: tenantEmail, password });
      } catch (syncErr) {
        // e.g. wrong/revoked secret key. Don't lock out tenants still on the public key.
        console.error('Tenant user sync failed:', syncErr);
      }
    }

    const session = signIn.data?.session;
    if (signIn.error || !session) {
      console.error('Tenant sign-in failed after sync:', signIn.error);
      if (profile.tenantAuthRequired) {
        return errorResponse('Could not open a session on your private database. Please contact administrator.', 500);
      }
      return jsonResponse({ ...profile, session: null });
    }

    return jsonResponse({
      ...profile,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
      },
    });
  } catch (err: unknown) {
    console.error('tenant-login exception:', err);
    return errorResponse('Internal authentication error.', 500);
  }
}));
