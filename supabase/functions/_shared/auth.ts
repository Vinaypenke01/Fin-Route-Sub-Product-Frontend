// ==============================================================================
// Authentication & Super-Admin Role Verification Helper for Edge Functions
// ==============================================================================
// @ts-ignore: Supabase JS library import
import { createClient, SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

declare const Deno: any;

export interface VerifiedSuperAdmin {
  user: User;
  serviceClient: SupabaseClient;
  role: string;
}

/**
 * Creates a privileged Supabase client with the service role key.
 * The service role key is retrieved strictly from server-side environment secrets.
 */
export function getServiceClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Server environment misconfigured: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Creates an anonymous Supabase client using public URL and anon key.
 */
export function getAnonClient(): SupabaseClient {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
    },
  });
}

/**
 * Extracts and verifies the caller's JWT, asserting that the caller exists in public.user_roles
 * and has the 'superadmin' role.
 * Throws an Error with status code if verification fails.
 */
export async function verifySuperAdmin(req: Request): Promise<VerifiedSuperAdmin> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('401: Missing or invalid Authorization Bearer header.');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new Error('401: Empty authentication token provided.');
  }

  const serviceClient = getServiceClient();

  // 1. Verify token with Supabase Auth
  const { data: userData, error: userError } = await serviceClient.auth.getUser(token);
  if (userError || !userData?.user) {
    throw new Error(`401: Authentication failed: ${userError?.message || 'Invalid or expired session token.'}`);
  }

  const user = userData.user;

  // 2. Verify protected role mapping in public.user_roles
  const { data: roleRow, error: roleError } = await serviceClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle();

  if (roleError) {
    throw new Error(`500: Database role verification error: ${roleError.message}`);
  }

  // Also check user_metadata or legacy master_super_admins as fallback for zero-downtime migration
  let role = roleRow?.role;
  if (!role && user.email) {
    const { data: legacyAdmin } = await serviceClient
      .from('master_super_admins')
      .select('role')
      .eq('email', user.email.toLowerCase().trim())
      .maybeSingle();

    if (legacyAdmin?.role) {
      role = legacyAdmin.role;
      // Auto-backfill into user_roles
      await serviceClient
        .from('user_roles')
        .insert([{ user_id: user.id, role: legacyAdmin.role }])
        .catch(() => {});
    }
  }

  if (role !== 'superadmin') {
    throw new Error('403: Access forbidden. This operation requires an active superadmin role.');
  }

  return {
    user,
    serviceClient,
    role,
  };
}
