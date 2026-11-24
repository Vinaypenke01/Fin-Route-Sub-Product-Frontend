-- ==============================================================================
-- FINROUTE MASTER DATABASE: TENANT BACKUPS (Phase 4)
-- Run in the Master Supabase project SQL Editor AFTER 20261126_active_sessions.sql.
-- Safe to run more than once.
--
-- * Private Storage bucket "tenant-backups" (no public access, no client
--   policies: only the tenant-backup / admin-tenants Edge Functions using the
--   service role can read or write it). Backups contain borrower personal data.
-- * master_backup_runs: one row per backup attempt (shown in the admin panel).
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('tenant-backups', 'tenant-backups', false)
ON CONFLICT (id) DO UPDATE SET public = false;

CREATE TABLE IF NOT EXISTS public.master_backup_runs (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   UUID REFERENCES public.master_tenants(id) ON DELETE CASCADE,
    status      TEXT NOT NULL CHECK (status IN ('success', 'failed', 'skipped')),
    file_path   TEXT,
    size_bytes  BIGINT,
    row_counts  JSONB,
    error       TEXT,
    trigger     TEXT NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule', 'manual')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backup_runs_tenant ON public.master_backup_runs (tenant_id, created_at DESC);

ALTER TABLE public.master_backup_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can read backup runs" ON public.master_backup_runs;
CREATE POLICY "Superadmins can read backup runs"
ON public.master_backup_runs FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.master_backup_runs FROM anon;
