-- ==============================================================================
-- FINROUTE MASTER DATABASE SETUP SCRIPT
-- Run this in your Master Supabase project SQL Editor (https://supabase.com/dashboard/project/ubhwoicsjmxslggltvaa/sql)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Master Tenants Table
CREATE TABLE IF NOT EXISTS master_tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    client_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    business_name VARCHAR(255) DEFAULT 'FinRoute Collect',
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'expired', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Master Credentials Table
CREATE TABLE IF NOT EXISTS master_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES master_tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    session_timeout_hours INT DEFAULT 24,
    last_login TIMESTAMP WITH TIME ZONE,
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Master Tenant Dedicated DB Configurations Table
CREATE TABLE IF NOT EXISTS master_db_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE REFERENCES master_tenants(id) ON DELETE CASCADE,
    tenant_supabase_url TEXT NOT NULL,
    tenant_anon_key TEXT NOT NULL,
    db_status VARCHAR(50) DEFAULT 'connected' CHECK (db_status IN ('connected', 'unreachable', 'maintenance')),
    last_health_check TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Protected Role Mapping Table for Supabase Auth Super Admins
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'superadmin' CHECK (role IN ('superadmin', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legacy Super Admin Table (Retained for backwards compatibility & audit reference)
CREATE TABLE IF NOT EXISTS master_super_admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'superadmin',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_master_tenants_email ON master_tenants(email);
CREATE INDEX IF NOT EXISTS idx_master_credentials_email ON master_credentials(email);
CREATE INDEX IF NOT EXISTS idx_master_db_configs_tenant ON master_db_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- Enable RLS
ALTER TABLE master_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_db_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_super_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helper Function: Check If Current User Is a Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = p_user_id AND role = 'superadmin'
    );
$$;

-- RLS: Authenticated users can only read their own role mapping
CREATE POLICY "Users can read own role" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- RLS: Allow authenticated superadmins to read master tables
CREATE POLICY "Superadmins can read master_tenants" 
ON master_tenants FOR SELECT 
TO authenticated 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Superadmins can read master_db_configs" 
ON master_db_configs FOR SELECT 
TO authenticated 
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Superadmins can read master_credentials" 
ON master_credentials FOR SELECT 
TO authenticated 
USING (public.is_super_admin(auth.uid()));
-- ==============================================================================
-- NEXT STEPS (run in order, in the SQL Editor):
--   1. supabase/migrations/20261026_super_admin_auth_migration.sql
--   2. supabase/migrations/20261123_security_hardening.sql
--      (defines verify_tenant_login with bcrypt-only checks, password hashing
--       triggers, and superadmin-only write policies)
--
-- Tenants and admins are created from the Super Admin panel (admin-tenants
-- Edge Function). Never commit seed credentials or tenant keys to this file.
-- ==============================================================================
