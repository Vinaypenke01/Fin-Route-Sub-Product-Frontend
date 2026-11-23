-- ==============================================================================
-- FINROUTE MASTER DATABASE: TENANT AUTH (M2)
-- Run in the Master Supabase project SQL Editor AFTER
-- 20261123_security_hardening.sql. Safe to run more than once.
--
-- Adds:
--   1. Per-tenant secret key storage in Supabase Vault (service_role only).
--   2. master_db_configs.tenant_auth_user_id / tenant_auth_required.
--   3. verify_tenant_login now also returns tenant_id and tenant_auth_required.
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- ------------------------------------------------------------------------------
-- 1. New columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.master_db_configs
    ADD COLUMN IF NOT EXISTS tenant_secret_id UUID,
    ADD COLUMN IF NOT EXISTS tenant_auth_user_id UUID,
    ADD COLUMN IF NOT EXISTS tenant_auth_required BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.master_db_configs.tenant_secret_id IS
    'vault.secrets id holding the tenant project''s secret (service) key. Never exposed to clients.';
COMMENT ON COLUMN public.master_db_configs.tenant_auth_required IS
    'true once the tenant DB has tenant_lockdown.sql applied: operators must hold a tenant Auth session.';

-- ------------------------------------------------------------------------------
-- 2. Vault helpers (service_role only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_tenant_secret(p_tenant_id UUID, p_secret TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_secret_id UUID;
    v_name TEXT := 'finroute_tenant_secret_' || p_tenant_id::text;
BEGIN
    IF p_secret IS NULL OR TRIM(p_secret) = '' THEN
        RAISE EXCEPTION 'Secret key must not be empty';
    END IF;

    SELECT tenant_secret_id INTO v_secret_id FROM master_db_configs WHERE tenant_id = p_tenant_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % has no database configuration yet', p_tenant_id;
    END IF;

    IF v_secret_id IS NULL THEN
        SELECT id INTO v_secret_id FROM vault.secrets WHERE name = v_name;
    END IF;

    IF v_secret_id IS NULL THEN
        v_secret_id := vault.create_secret(TRIM(p_secret), v_name, 'FinRoute tenant project secret key');
    ELSE
        PERFORM vault.update_secret(v_secret_id, TRIM(p_secret), v_name, 'FinRoute tenant project secret key');
    END IF;

    UPDATE master_db_configs
    SET tenant_secret_id = v_secret_id, updated_at = NOW()
    WHERE tenant_id = p_tenant_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_tenant_secret(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, vault
AS $$
    SELECT ds.decrypted_secret
    FROM master_db_configs c
    JOIN vault.decrypted_secrets ds ON ds.id = c.tenant_secret_id
    WHERE c.tenant_id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION public.admin_set_tenant_secret(UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_get_tenant_secret(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_tenant_secret(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_tenant_secret(UUID) TO service_role;

-- ------------------------------------------------------------------------------
-- 3. verify_tenant_login: same checks as 20261123, plus tenant_id / auth flag
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
        'tenant_id', v_tenant.id,
        'email', v_tenant.email,
        'client_name', v_tenant.client_name,
        'business_name', v_tenant.business_name,
        'tenant_supabase_url', v_db.tenant_supabase_url,
        'tenant_anon_key', v_db.tenant_anon_key,
        'tenant_auth_required', COALESCE(v_db.tenant_auth_required, false),
        'expires_at', v_creds.expires_at
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_tenant_login(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_tenant_login(TEXT, TEXT) TO anon, authenticated, service_role;
-- NOTE: once every tenant logs in through the 'tenant-login' Edge Function,
-- revoke anon/authenticated EXECUTE here so login only goes through the server.
