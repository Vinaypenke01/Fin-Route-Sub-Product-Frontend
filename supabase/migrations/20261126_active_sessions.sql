-- ==============================================================================
-- FINROUTE MASTER DATABASE: ONE ACTIVE DEVICE PER TENANT (Phase 2)
-- Run in the Master Supabase project SQL Editor AFTER 20261125_tenant_delete.sql.
-- Safe to run more than once.
--
-- One row per tenant while an operator is signed in. The tenant-login Edge
-- Function refuses a second device while the row was seen in the last few
-- minutes; the app's heartbeat keeps it fresh; logout removes it.
-- Only Edge Functions (service role) write here; super-admins can read it.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.master_active_sessions (
    tenant_id     UUID PRIMARY KEY REFERENCES public.master_tenants(id) ON DELETE CASCADE,
    session_id    TEXT NOT NULL,
    device_label  TEXT,
    ip_address    TEXT,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.master_active_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmins can read active sessions" ON public.master_active_sessions;
CREATE POLICY "Superadmins can read active sessions"
ON public.master_active_sessions FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));

REVOKE ALL ON public.master_active_sessions FROM anon;
