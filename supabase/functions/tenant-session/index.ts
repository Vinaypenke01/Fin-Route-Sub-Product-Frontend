// ==============================================================================
// SUPABASE EDGE FUNCTION: tenant-session
// Keeps the "one active device per tenant" record up to date.
//   { action: 'heartbeat', email, deviceSessionId } -> { active: true|false }
//   { action: 'logout',    email, deviceSessionId } -> { success: true }
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

serve(withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed. Use POST.', 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || '');
    const email = String(body?.email || '').trim().toLowerCase();
    const deviceSessionId = body?.deviceSessionId;

    if (!email || !isValidDeviceSessionId(deviceSessionId) || !['heartbeat', 'logout'].includes(action)) {
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
      return jsonResponse({ success: true, active: false, reason: 'ended' });
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
