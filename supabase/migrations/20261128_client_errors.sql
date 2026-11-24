-- ==============================================================================
-- FINROUTE MASTER DATABASE: APP ERROR REPORTS (Phase 6)
-- Run in the Master Supabase project SQL Editor AFTER 20261127_backups.sql.
-- Safe to run more than once.
--
-- Crashes and failed saves from operators' devices, with personal data
-- (phone numbers, long numbers, email addresses other than the tenant's)
-- removed by the report-error Edge Function before it is stored.
-- Only the Edge Function writes; super-admins read. Kept 90 days.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.master_client_errors (
    id           BIGSERIAL PRIMARY KEY,
    tenant_email TEXT,
    kind         TEXT NOT NULL DEFAULT 'error',
    message      TEXT NOT NULL,
    detail       TEXT,
    page         TEXT,
    device       TEXT,
    app_version  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_created ON public.master_client_errors (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_errors_email ON public.master_client_errors (tenant_email, created_at DESC);

ALTER TABLE public.master_client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can read client errors" ON public.master_client_errors;
CREATE POLICY "Superadmins can read client errors"
ON public.master_client_errors FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.master_client_errors FROM anon;
