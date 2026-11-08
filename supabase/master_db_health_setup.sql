-- ==============================================================================
-- FINROUTE MASTER DATABASE: KEEP-ALIVE & DB HEALTH MONITORING SETUP
-- Run this in your Master Supabase Project SQL Editor (ubhwoicsjmxslggltvaa)
-- ==============================================================================

-- 1. Add health tracking columns to master_tenants
ALTER TABLE public.master_tenants 
ADD COLUMN IF NOT EXISTS last_health_status VARCHAR(50) DEFAULT 'unknown',
ADD COLUMN IF NOT EXISTS last_latency_ms INT,
ADD COLUMN IF NOT EXISTS last_health_check_at TIMESTAMP WITH TIME ZONE;

-- 2. Create the master_db_health_logs table to store historical pings
CREATE TABLE IF NOT EXISTS public.master_db_health_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.master_tenants(id) ON DELETE CASCADE,
    tenant_name VARCHAR(255),
    tenant_email VARCHAR(255),
    database_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'unknown', -- 'online' | 'sleeping' | 'error' | 'unconfigured'
    latency_ms INT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Indexes for fast dashboard lookups
CREATE INDEX IF NOT EXISTS idx_health_logs_tenant ON public.master_db_health_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_logs_created ON public.master_db_health_logs(created_at DESC);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.master_db_health_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Superadmins can read master_db_health_logs" ON public.master_db_health_logs;
CREATE POLICY "Superadmins can read master_db_health_logs" 
ON public.master_db_health_logs FOR SELECT 
TO authenticated 
USING (public.is_super_admin(auth.uid()));

DROP POLICY IF EXISTS "Service role full access master_db_health_logs" ON public.master_db_health_logs;
CREATE POLICY "Service role full access master_db_health_logs" 
ON public.master_db_health_logs FOR ALL 
TO service_role 
USING (true) WITH CHECK (true);

-- 6. Helper Function: Prune old health logs older than 30 days to keep DB light
CREATE OR REPLACE FUNCTION public.cleanup_old_health_logs()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.master_db_health_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

