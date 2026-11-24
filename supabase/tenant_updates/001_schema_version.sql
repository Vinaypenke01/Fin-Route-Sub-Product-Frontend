-- ==============================================================================
-- FINROUTE TENANT UPDATE 001: schema version tracking
-- Run in EACH tenant's own Supabase project (SQL Editor). Safe to run twice.
-- Run AFTER supabase_tenant_template.sql and tenant_lockdown.sql.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.finroute_schema_version (
    version    INT PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.finroute_schema_version ENABLE ROW LEVEL SECURITY;

-- Operators may read the version; only the service role (server) and this
-- SQL Editor can change it.
DROP POLICY IF EXISTS "Operators read schema version" ON public.finroute_schema_version;
CREATE POLICY "Operators read schema version"
ON public.finroute_schema_version FOR SELECT TO authenticated
USING (public.is_finroute_operator());

REVOKE ALL ON public.finroute_schema_version FROM anon;
GRANT SELECT ON public.finroute_schema_version TO authenticated;

INSERT INTO public.finroute_schema_version (version, name)
VALUES (1, 'schema version tracking')
ON CONFLICT (version) DO NOTHING;

-- Check: should return 1
SELECT max(version) AS current_version FROM public.finroute_schema_version;
