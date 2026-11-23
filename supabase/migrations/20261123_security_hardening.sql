-- ==============================================================================
-- FINROUTE MASTER DATABASE: SECURITY HARDENING MIGRATION
-- Run in the Master Supabase project SQL Editor AFTER
-- 20261026_super_admin_auth_migration.sql. Safe to run more than once.
--
-- Fixes:
--   1. Removes "Allow anon ..." write policies on master tables.
--   2. Drops the unauthenticated SECURITY DEFINER admin_* RPC functions
--      (anyone holding the public anon key could call them).
--   3. Stores every tenant / legacy admin password as a bcrypt hash
--      (trigger + one-time backfill of existing plaintext values).
--   4. verify_tenant_login: bcrypt-only comparison, no account enumeration.
--   5. Super-admin-only write policies so the admin UI fallbacks still work.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. Drop permissive anonymous policies
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow anon update master_tenants" ON public.master_tenants;
DROP POLICY IF EXISTS "Allow anon update master_credentials" ON public.master_credentials;
DROP POLICY IF EXISTS "Allow anon update master_db_configs" ON public.master_db_configs;
DROP POLICY IF EXISTS "Allow anon insert master_super_admins" ON public.master_super_admins;
DROP POLICY IF EXISTS "Allow anon update master_super_admins" ON public.master_super_admins;
DROP POLICY IF EXISTS "Allow anon delete master_super_admins" ON public.master_super_admins;
DROP POLICY IF EXISTS "Allow anon read super admins" ON public.master_super_admins;
DROP POLICY IF EXISTS "Allow anon login function read master_credentials" ON public.master_credentials;
DROP POLICY IF EXISTS "Allow anon login function read master_db_configs" ON public.master_db_configs;

-- ------------------------------------------------------------------------------
-- 2. Remove unauthenticated admin RPCs (all admin writes go through the
--    'admin-tenants' Edge Function, which verifies the caller's superadmin role)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_set_tenant_db(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_update_full_tenant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.admin_create_super_admin(TEXT, TEXT, TEXT, TEXT);

-- get_user_role lets any caller look up any user's role; restrict it.
REVOKE EXECUTE ON FUNCTION public.get_user_role(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO service_role;

-- is_super_admin is used inside RLS policies; anon has no reason to call it.
REVOKE EXECUTE ON FUNCTION public.is_super_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(UUID) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Always store passwords as bcrypt hashes
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.hash_password_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF NEW.password_hash IS NOT NULL
       AND NEW.password_hash !~ '^\$2[abxy]\$\d{2}\$' THEN
        NEW.password_hash := crypt(TRIM(NEW.password_hash), gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hash_master_credentials_pw ON public.master_credentials;
CREATE TRIGGER trg_hash_master_credentials_pw
BEFORE INSERT OR UPDATE OF password_hash ON public.master_credentials
FOR EACH ROW EXECUTE FUNCTION public.hash_password_column();

DROP TRIGGER IF EXISTS trg_hash_master_super_admins_pw ON public.master_super_admins;
CREATE TRIGGER trg_hash_master_super_admins_pw
BEFORE INSERT OR UPDATE OF password_hash ON public.master_super_admins
FOR EACH ROW EXECUTE FUNCTION public.hash_password_column();

-- One-time backfill: hash any remaining plaintext values (trigger does the work)
UPDATE public.master_credentials
SET password_hash = password_hash
WHERE password_hash !~ '^\$2[abxy]\$\d{2}\$';

UPDATE public.master_super_admins
SET password_hash = password_hash
WHERE password_hash !~ '^\$2[abxy]\$\d{2}\$';

-- ------------------------------------------------------------------------------
-- 4. Tenant login: bcrypt only, generic errors, status checked after password
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verify_tenant_login(p_email TEXT, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_tenant RECORD;
    v_creds RECORD;
    v_db RECORD;
    v_clean_email TEXT := LOWER(TRIM(p_email));
    v_generic_fail CONSTANT TEXT := 'Invalid email or password.';
BEGIN
    SELECT * INTO v_creds FROM master_credentials WHERE LOWER(TRIM(email)) = v_clean_email;
    IF NOT FOUND THEN
        -- Burn comparable time so response timing does not reveal valid emails
        PERFORM crypt(COALESCE(p_password, ''), gen_salt('bf', 10));
        RETURN json_build_object('success', false, 'message', v_generic_fail);
    END IF;

    IF v_creds.locked_until IS NOT NULL AND v_creds.locked_until > NOW() THEN
        RETURN json_build_object('success', false, 'message', 'Account temporarily locked due to failed attempts. Try again later.');
    END IF;

    IF v_creds.password_hash IS NULL
       OR v_creds.password_hash !~ '^\$2[abxy]\$\d{2}\$'
       OR v_creds.password_hash <> crypt(TRIM(COALESCE(p_password, '')), v_creds.password_hash) THEN
        UPDATE master_credentials
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
        WHERE id = v_creds.id;
        RETURN json_build_object('success', false, 'message', v_generic_fail);
    END IF;

    SELECT * INTO v_tenant FROM master_tenants WHERE id = v_creds.tenant_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', v_generic_fail);
    END IF;

    IF v_tenant.status <> 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Account is ' || v_tenant.status || '. Please contact administrator.');
    END IF;

    IF v_creds.expires_at IS NOT NULL AND v_creds.expires_at < NOW() THEN
        RETURN json_build_object('success', false, 'message', 'Account access has expired. Please contact administrator.');
    END IF;

    UPDATE master_credentials
    SET failed_attempts = 0, locked_until = NULL, last_login = NOW()
    WHERE id = v_creds.id;

    SELECT * INTO v_db FROM master_db_configs WHERE tenant_id = v_tenant.id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Tenant dedicated database is not assigned yet.');
    END IF;

    RETURN json_build_object(
        'success', true,
        'email', v_tenant.email,
        'client_name', v_tenant.client_name,
        'business_name', v_tenant.business_name,
        'tenant_supabase_url', v_db.tenant_supabase_url,
        'tenant_anon_key', v_db.tenant_anon_key,
        'expires_at', v_creds.expires_at
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_tenant_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_tenant_login(TEXT, TEXT) TO anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. Super-admin-only write policies (used by the admin UI direct-query fallbacks)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Superadmins can write master_tenants" ON public.master_tenants;
CREATE POLICY "Superadmins can write master_tenants"
ON public.master_tenants FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can write master_credentials" ON public.master_credentials;
CREATE POLICY "Superadmins can write master_credentials"
ON public.master_credentials FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Superadmins can write master_db_configs" ON public.master_db_configs;
CREATE POLICY "Superadmins can write master_db_configs"
ON public.master_db_configs FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

-- master_super_admins is legacy: no client policies at all (service_role only).
-- user_roles: read-own policy only; writes are service_role only (Edge Functions).
DROP POLICY IF EXISTS "Superadmins can manage user_roles" ON public.user_roles;

-- ------------------------------------------------------------------------------
-- 6. Verification queries (run manually and review the output)
-- ------------------------------------------------------------------------------
-- SELECT tablename, policyname, roles, cmd, qual FROM pg_policies
--  WHERE schemaname = 'public' ORDER BY tablename;
-- SELECT count(*) FROM master_credentials WHERE password_hash !~ '^\$2[abxy]\$\d{2}\$';  -- expect 0
