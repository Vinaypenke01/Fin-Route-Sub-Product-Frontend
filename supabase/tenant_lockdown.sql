-- ==============================================================================
-- FINROUTE TENANT DATABASE LOCKDOWN (M2c)
-- Run in EACH tenant's own Supabase project (SQL Editor), one tenant at a time.
--
-- Before running, in the Super Admin panel for this tenant:
--   1. Save the tenant's Secret Key (Edit tenant -> Tenant Secret Key).
--   2. Have the operator log in once (or set a new password) so their tenant
--      sign-in account exists. Check: Authentication -> Users in this project.
-- In this project's dashboard:
--   3. Authentication -> Sign In / Providers: turn OFF "Allow new users to sign up".
--
-- After running: Edit tenant -> tick "Require tenant sign-in" -> Save.
-- Rollback: run the "ROLLBACK" block at the bottom.
-- ==============================================================================

-- 1. Helper: is the caller a FinRoute operator? (role set only by the server)
CREATE OR REPLACE FUNCTION public.is_finroute_operator()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'finroute_role') = 'operator', false);
$$;

REVOKE ALL ON FUNCTION public.is_finroute_operator() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_finroute_operator() TO authenticated, service_role;

-- 2. Replace open policies with operator-only policies
DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY['villages', 'customers', 'weeks', 'payments',
                             'weekly_reconciliation', 'loan_archive',
                             'tenant_settings', 'audit_logs']
    LOOP
        IF to_regclass('public.' || t) IS NULL THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Tenant full access ' || t, t);
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Operators full access ' || t, t);
        EXECUTE format(
            'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_finroute_operator()) WITH CHECK (public.is_finroute_operator())',
            'Operators full access ' || t, t
        );
    END LOOP;
END $$;

-- 3. The public (anon) key gets no table access at all
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- 4. Verification (run and review)
-- SELECT tablename, policyname, roles, cmd FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename;
-- Expect only "Operators full access <table>" policies for role {authenticated}.

-- ==============================================================================
-- ROLLBACK (only if operators cannot work and you need the old open access back)
-- ==============================================================================
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY['villages','customers','weeks','payments','weekly_reconciliation','loan_archive','tenant_settings','audit_logs']
--   LOOP
--     IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
--     EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Operators full access ' || t, t);
--     EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)', 'Tenant full access ' || t, t);
--   END LOOP;
-- END $$;
-- GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
-- (and untick "Require tenant sign-in" for this tenant in the admin panel)
