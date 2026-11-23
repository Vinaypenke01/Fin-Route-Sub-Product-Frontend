-- ==============================================================================
-- FINROUTE MASTER DATABASE: DELETE TENANT
-- Run in the Master Supabase project SQL Editor AFTER 20261124_tenant_auth.sql.
-- Safe to run more than once.
--
-- admin_delete_tenant removes a tenant from the master registry in one
-- transaction:
--   * master_tenants row (cascades to master_credentials, master_db_configs
--     and master_db_health_logs through ON DELETE CASCADE)
--   * the tenant's secret key in Vault
-- It does NOT touch the tenant's own Supabase project or its ledger data.
-- Callable by service_role only (the admin-tenants Edge Function).
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.admin_delete_tenant(p_tenant_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
    v_email TEXT;
    v_secret_id UUID;
BEGIN
    SELECT email INTO v_email FROM master_tenants WHERE id = p_tenant_id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Tenant not found.');
    END IF;

    SELECT tenant_secret_id INTO v_secret_id FROM master_db_configs WHERE tenant_id = p_tenant_id;

    DELETE FROM master_tenants WHERE id = p_tenant_id;

    IF v_secret_id IS NOT NULL THEN
        DELETE FROM vault.secrets WHERE id = v_secret_id;
    END IF;

    RETURN json_build_object('success', true, 'email', v_email);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_tenant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_tenant(UUID) TO service_role;
