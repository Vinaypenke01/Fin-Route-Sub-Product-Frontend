-- ==============================================================================
-- FINROUTE MASTER DATABASE MIGRATION: SUPER ADMIN TO SUPABASE AUTH & ROLE MAPPING
-- Run this in your Master Supabase project SQL Editor
-- (https://supabase.com/dashboard/project/ubhwoicsjmxslggltvaa/sql)
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Protected Role Mapping Table for Supabase Auth Users
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'superadmin' CHECK (role IN ('superadmin', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- 3. Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read only their own role mapping
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role" 
ON public.user_roles FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Service role has full access; no public insert/update/delete policies are created.

-- 4. Helper Function: Check If Current or Specified User Is a Super Admin
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

-- 5. Helper Stored Procedure: Verify Super Admin Role by Email (Used in Edge Functions or Auth Checks)
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

-- 6. Migrate Existing Accounts from master_super_admins to auth.users & public.user_roles
DO $$
DECLARE
    r RECORD;
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    FOR r IN SELECT * FROM master_super_admins LOOP
        -- Check if user already exists in auth.users
        SELECT id INTO v_user_id FROM auth.users WHERE LOWER(email) = LOWER(TRIM(r.email));

        IF v_user_id IS NULL THEN
            -- Generate a new UUID for user
            v_user_id := gen_random_uuid();
            -- Use bcrypt password hash from master_super_admins or crypt
            v_encrypted_pw := crypt(r.password_hash, gen_salt('bf'));

            -- Insert directly into auth.users (Supabase Auth internal table)
            INSERT INTO auth.users (
                instance_id,
                id,
                aud,
                role,
                email,
                encrypted_password,
                email_confirmed_at,
                raw_app_meta_data,
                raw_user_meta_data,
                created_at,
                updated_at,
                confirmation_token
            ) VALUES (
                '00000000-0000-0000-0000-000000000000',
                v_user_id,
                'authenticated',
                'authenticated',
                LOWER(TRIM(r.email)),
                v_encrypted_pw,
                NOW(),
                jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', r.role),
                jsonb_build_object('name', r.name),
                NOW(),
                NOW(),
                encode(gen_random_bytes(32), 'hex')
            );
        END IF;

        -- Ensure user is mapped in public.user_roles
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, COALESCE(r.role, 'superadmin'))
        ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
    END LOOP;
END $$;

-- 7. Ensure Default Root Super Admin Exists in auth.users & public.user_roles
-- Default: admin@finroute.com / FinRoute@Master2026!
DO $$
DECLARE
    v_root_email TEXT := 'admin@finroute.com';
    v_root_name TEXT := 'Root Administrator';
    v_root_pw TEXT := 'FinRoute@Master2026!';
    v_root_uid UUID;
BEGIN
    SELECT id INTO v_root_uid FROM auth.users WHERE LOWER(email) = v_root_email;

    IF v_root_uid IS NULL THEN
        v_root_uid := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_root_uid,
            'authenticated',
            'authenticated',
            v_root_email,
            crypt(v_root_pw, gen_salt('bf')),
            NOW(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'superadmin'),
            jsonb_build_object('name', v_root_name),
            NOW(),
            confirmation_token,
            recovery_token,
            email_change_token_new,
            email_change,
            email_change_token_current,
            phone_change,
            phone_change_token,
            reauthentication_token,
            is_sso_user,
            is_super_admin
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            v_root_uid,
            'authenticated',
            'authenticated',
            v_root_email,
            crypt(v_root_pw, gen_salt('bf')),
            NOW(),
            jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email'), 'role', 'superadmin'),
            jsonb_build_object('name', v_root_name),
            NOW(),
            NOW(),
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            '',
            false,
            false
        );

        -- Also create identity in auth.identities with UUID id
        INSERT INTO auth.identities (
            id,
            user_id,
            identity_data,
            provider,
            provider_id,
            last_sign_in_at,
            created_at,
            updated_at
        ) VALUES (
            v_root_uid,
            v_root_uid,
            jsonb_build_object('sub', v_root_uid::text, 'email', v_root_email, 'email_verified', true),
            'email',
            v_root_uid::text,
            NOW(),
            NOW(),
            NOW()
        );
    END IF;

    -- Map in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_root_uid, 'superadmin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin';
END $$;

-- 8. Hardening: Revoke Insecure Anon Public Read from master_super_admins
DROP POLICY IF EXISTS "Allow anon read super admins" ON master_super_admins;

-- 9. Hardening: Protect Master Tenant Configurations & Credentials
-- Only authenticated super-admins (or service_role in Edge Functions) can read credentials/db configs
DROP POLICY IF EXISTS "Allow anon login function read master_credentials" ON master_credentials;
DROP POLICY IF EXISTS "Allow anon login function read master_db_configs" ON master_db_configs;

-- Authenticated superadmins can view tenants & configs
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

-- Maintain tenant operator login through verify_tenant_login with SECURITY DEFINER
-- This ensures operator logins continue to function without exposing raw tables to anon.
