-- ==============================================================================
-- FINROUTE TENANT UPDATE 004: database size reporting
-- Run in EACH tenant's own Supabase project (SQL Editor). Safe to run twice.
-- Requires updates 001-003.
--
-- Lets the FinRoute admin panel show how full this database is, so you can
-- upgrade the Supabase plan before the free-tier limit (500 MB) is reached.
-- Only the server (service role) can call it.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.finroute_database_size()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT pg_database_size(current_database());
$$;

REVOKE ALL ON FUNCTION public.finroute_database_size() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finroute_database_size() TO service_role;

INSERT INTO public.finroute_schema_version (version, name)
VALUES (4, 'database size reporting')
ON CONFLICT (version) DO NOTHING;

-- Check: should return 4
SELECT max(version) AS current_version FROM public.finroute_schema_version;
