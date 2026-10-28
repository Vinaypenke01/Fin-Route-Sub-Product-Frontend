-- ==============================================================================
-- FIX FOR: "Database error querying schema" on Supabase Auth login
-- Run this in your Master Supabase project SQL Editor
-- (https://supabase.com/dashboard/project/ubhwoicsjmxslggltvaa/sql)
-- ==============================================================================

-- 1. Remove any broken manual record in auth.users and auth.identities
DELETE FROM auth.identities WHERE user_id IN (SELECT id FROM auth.users WHERE LOWER(email) = 'admin@finroute.com');
DELETE FROM auth.users WHERE LOWER(email) = 'admin@finroute.com';

-- 2. Create the user cleanly with all GoTrue required columns populated (no NULL strings)
DO $$
DECLARE
    v_user_id UUID := gen_random_uuid();
    v_email TEXT := 'admin@finroute.com';
    v_password TEXT := 'FinRoute@Master2026!';
    has_provider_id BOOLEAN;
BEGIN
    -- Check if provider_id column exists in auth.identities
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'auth' AND table_name = 'identities' AND column_name = 'provider_id'
    ) INTO has_provider_id;

    -- Insert into auth.users with all GoTrue expected string defaults (NOT NULL in Go scanner)
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
        v_user_id,
        'authenticated',
        'authenticated',
        v_email,
        crypt(v_password, gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"name":"Root Administrator"}'::jsonb,
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

    -- Insert into auth.identities (provider_id must be v_user_id::text for email provider)
    IF has_provider_id THEN
        EXECUTE 'INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NOW())'
        USING v_user_id, v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true), 'email', v_user_id::text;
    ELSE
        EXECUTE 'INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW(), NOW())'
        USING v_user_id, v_user_id, jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true), 'email';
    END IF;

    -- Map into protected public.user_roles table
    INSERT INTO public.user_roles (user_id, role)
    VALUES (v_user_id, 'superadmin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'superadmin';

    -- Ensure backup record exists in master_super_admins
    INSERT INTO public.master_super_admins (id, email, password_hash, name, role)
    VALUES (v_user_id, v_email, v_password, 'Root Administrator', 'superadmin')
    ON CONFLICT (email) DO UPDATE SET password_hash = v_password;

END $$;
