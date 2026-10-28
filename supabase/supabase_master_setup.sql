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

-- 5. Stored Procedure: Verify Tenant Login & Return Scoped DB Credentials
CREATE OR REPLACE FUNCTION verify_tenant_login(p_email TEXT, p_password TEXT)
RETURNS JSON 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    v_tenant RECORD;
    v_creds RECORD;
    v_db RECORD;
    v_clean_email TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    -- Check if tenant exists
    SELECT * INTO v_tenant FROM master_tenants WHERE LOWER(TRIM(email)) = v_clean_email;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Tenant email not found.');
    END IF;

    IF v_tenant.status != 'active' THEN
        RETURN json_build_object('success', false, 'message', 'Account is ' || v_tenant.status || '. Please contact administrator.');
    END IF;

    -- Check credentials
    SELECT * INTO v_creds FROM master_credentials WHERE LOWER(TRIM(email)) = v_clean_email;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Credentials not configured.');
    END IF;

    IF v_creds.locked_until IS NOT NULL AND v_creds.locked_until > NOW() THEN
        RETURN json_build_object('success', false, 'message', 'Account temporarily locked due to failed attempts. Try again later.');
    END IF;

    -- Verify password (supports direct match or bcrypt hash)
    IF v_creds.password_hash != p_password AND v_creds.password_hash != crypt(p_password, v_creds.password_hash) THEN
        UPDATE master_credentials 
        SET failed_attempts = failed_attempts + 1,
            locked_until = CASE WHEN failed_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes' ELSE NULL END
        WHERE id = v_creds.id;

        RETURN json_build_object('success', false, 'message', 'Invalid password. Please try again.');
    END IF;

    -- Reset failed attempts & update last login
    UPDATE master_credentials 
    SET failed_attempts = 0, locked_until = NULL, last_login = NOW() 
    WHERE id = v_creds.id;

    -- Fetch tenant dedicated DB credentials
    SELECT * INTO v_db FROM master_db_configs WHERE tenant_id = v_tenant.id;
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Tenant dedicated database is not assigned yet.');
    END IF;

    RETURN json_build_object(
        'success', true,
        'email', v_tenant.email,
        'client_name', v_tenant.client_name,
        'business_name', v_tenant.business_name,
        'tenant_supabase_url', v_db.tenant_supabase_url,
        'tenant_anon_key', v_db.tenant_anon_key,
        'expires_at', v_creds.expires_at
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Seed Initial Tenants & Super Admin
DO $$
DECLARE
    v_t1_id UUID;
    v_t2_id UUID;
BEGIN
    -- Super Admin (admin@finroute.com / Admin@123)
    IF NOT EXISTS (SELECT 1 FROM master_super_admins WHERE email = 'admin@finroute.com') THEN
        INSERT INTO master_super_admins (email, password_hash, name)
        VALUES ('admin@finroute.com', 'Admin@123', 'FinRoute Administrator');
    END IF;

    -- Tenant 1: Sunday Kovuru (govinduraju6924@gmail.com / Kovuru@123)
    IF NOT EXISTS (SELECT 1 FROM master_tenants WHERE email = 'govinduraju6924@gmail.com') THEN
        INSERT INTO master_tenants (email, client_name, business_name, status)
        VALUES ('govinduraju6924@gmail.com', 'Sunday Kovuru', 'FinRoute Collect - Sunday Ledger', 'active')
        RETURNING id INTO v_t1_id;

        INSERT INTO master_credentials (tenant_id, email, password_hash)
        VALUES (v_t1_id, 'govinduraju6924@gmail.com', 'Kovuru@123');

        -- Point to dedicated tenant Supabase instance for Sunday Kovuru
        INSERT INTO master_db_configs (tenant_id, tenant_supabase_url, tenant_anon_key)
        VALUES (v_t1_id, 'https://bqbtufmyhtzdxbpogivk.supabase.co', 'sb_publishable_z5DGuSdW5h67ZRDNAzv6kA_kxfVxxre');
    ELSE
        -- Update existing tenant config if already seeded
        UPDATE master_db_configs
        SET tenant_supabase_url = 'https://bqbtufmyhtzdxbpogivk.supabase.co',
            tenant_anon_key = 'sb_publishable_z5DGuSdW5h67ZRDNAzv6kA_kxfVxxre',
            updated_at = NOW()
        WHERE tenant_id = (SELECT id FROM master_tenants WHERE email = 'govinduraju6924@gmail.com');
    END IF;

    -- Tenant 2: Lakshmi (lakshmi@gmail.com / Lakshmi#999)
    IF NOT EXISTS (SELECT 1 FROM master_tenants WHERE email = 'lakshmi@gmail.com') THEN
        INSERT INTO master_tenants (email, client_name, business_name, status)
        VALUES ('lakshmi@gmail.com', 'Lakshmi', 'FinRoute Collect - Lakshmi', 'active')
        RETURNING id INTO v_t2_id;

        INSERT INTO master_credentials (tenant_id, email, password_hash)
        VALUES (v_t2_id, 'lakshmi@gmail.com', 'Lakshmi#999');

        INSERT INTO master_db_configs (tenant_id, tenant_supabase_url, tenant_anon_key)
        VALUES (v_t2_id, 'https://ubhwoicsjmxslggltvaa.supabase.co', 'sb_publishable_raPNiMJx4rlabjgq3VGQAw_HSKpJ0P5');
    END IF;
END $$;

-- 7. Stored Procedure for Admin to update tenant DB anytime
CREATE OR REPLACE FUNCTION admin_set_tenant_db(p_email TEXT, p_url TEXT, p_key TEXT)
RETURNS JSON AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT id INTO v_tenant_id FROM master_tenants WHERE LOWER(TRIM(email)) = LOWER(TRIM(p_email));
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'message', 'Tenant not found');
    END IF;

    UPDATE master_db_configs
    SET tenant_supabase_url = p_url,
        tenant_anon_key = p_key,
        updated_at = NOW()
    WHERE tenant_id = v_tenant_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Stored Procedure for Admin to update full tenant profile, credentials, and DB config
CREATE OR REPLACE FUNCTION admin_update_full_tenant(
    p_tenant_id UUID,
    p_client_name TEXT,
    p_business_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_status TEXT,
    p_password TEXT,
    p_db_url TEXT,
    p_anon_key TEXT
)
RETURNS JSON AS $$
DECLARE
    v_clean_email TEXT;
BEGIN
    v_clean_email := LOWER(TRIM(p_email));

    -- 1. Update master_tenants
    UPDATE master_tenants
    SET client_name = TRIM(p_client_name),
        business_name = TRIM(p_business_name),
        email = v_clean_email,
        phone = TRIM(p_phone),
        status = p_status,
        updated_at = NOW()
    WHERE id = p_tenant_id;

    -- 2. Update master_credentials
    UPDATE master_credentials
    SET email = v_clean_email,
        password_hash = CASE WHEN p_password IS NOT NULL AND TRIM(p_password) != '' THEN TRIM(p_password) ELSE password_hash END,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;

    -- 3. Update master_db_configs
    UPDATE master_db_configs
    SET tenant_supabase_url = CASE WHEN p_db_url IS NOT NULL AND TRIM(p_db_url) != '' THEN TRIM(p_db_url) ELSE tenant_supabase_url END,
        tenant_anon_key = CASE WHEN p_anon_key IS NOT NULL AND TRIM(p_anon_key) != '' THEN TRIM(p_anon_key) ELSE tenant_anon_key END,
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Allow admin update RLS policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update master_tenants') THEN
        CREATE POLICY "Allow anon update master_tenants" ON master_tenants FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update master_credentials') THEN
        CREATE POLICY "Allow anon update master_credentials" ON master_credentials FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update master_db_configs') THEN
        CREATE POLICY "Allow anon update master_db_configs" ON master_db_configs FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon insert master_super_admins') THEN
        CREATE POLICY "Allow anon insert master_super_admins" ON master_super_admins FOR INSERT WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon update master_super_admins') THEN
        CREATE POLICY "Allow anon update master_super_admins" ON master_super_admins FOR UPDATE USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow anon delete master_super_admins') THEN
        CREATE POLICY "Allow anon delete master_super_admins" ON master_super_admins FOR DELETE USING (true);
    END IF;
END $$;

-- 10. Stored Procedure: Super Admin creates another admin account
CREATE OR REPLACE FUNCTION admin_create_super_admin(
    p_email TEXT,
    p_password TEXT,
    p_name TEXT,
    p_role TEXT DEFAULT 'superadmin'
)
RETURNS JSON AS $$
BEGIN
    INSERT INTO master_super_admins (email, password_hash, name, role)
    VALUES (LOWER(TRIM(p_email)), TRIM(p_password), TRIM(p_name), COALESCE(TRIM(p_role), 'superadmin'));

    RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;



