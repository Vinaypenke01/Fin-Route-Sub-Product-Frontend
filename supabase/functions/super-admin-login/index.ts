// ==============================================================================
// SUPABASE EDGE FUNCTION: super-admin-login
// Authenticates super-admin users via Supabase Auth and validates the role
// mapping in public.user_roles. No legacy/plaintext fallbacks.
//
// Account recovery: reset the password from the Supabase dashboard
// (Authentication -> Users) and make sure the user has a 'superadmin' row
// in public.user_roles. Never hardcode credentials here.
// ==============================================================================
// @ts-ignore: Deno standard library import
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { withCors, handleCors, jsonResponse, errorResponse } from '../_shared/cors.ts';
import { getAnonClient, getServiceClient } from '../_shared/auth.ts';

const GENERIC_AUTH_ERROR = 'Invalid administrator email or password.';

serve(withCors(async (req: Request) => {
  const corsRes = handleCors(req);
  if (corsRes) return corsRes;

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

    const anonClient = getAnonClient();
    const serviceClient = getServiceClient();

    // 1. Authenticate through Supabase Auth
    const authResult = await anonClient.auth.signInWithPassword({ email, password });

    if (authResult.error || !authResult.data?.user || !authResult.data?.session) {
      return errorResponse(GENERIC_AUTH_ERROR, 401);
    }

    const user = authResult.data.user;
    const session = authResult.data.session;

    // 2. Role must come from the protected user_roles table
    const { data: roleRow, error: roleError } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError) {
      console.error('Role mapping query error:', roleError);
    }

    if (roleRow?.role !== 'superadmin') {
      await serviceClient.auth.admin.signOut(session.access_token).catch(() => {});
      return errorResponse('Access forbidden. Your account does not have super-admin privileges.', 403);
    }

    const adminName = (user.user_metadata?.name as string) || email.split('@')[0];

    return jsonResponse({
      success: true,
      message: 'Super-admin authenticated successfully.',
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
      },
      admin: {
        id: user.id,
        email: user.email,
        name: adminName,
        role: 'superadmin',
      },
    });
  } catch (err: unknown) {
    console.error('super-admin-login exception:', err);
    return errorResponse('Internal authentication error.', 500);
  }
}));
