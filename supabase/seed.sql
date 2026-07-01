-- ============================================================================
-- VEBOSSO EMS — Seed Owner Account (Fresh Reset)
-- ============================================================================
-- Run this in your Supabase SQL Editor.
-- Deletes all old users and recreates the owner account.
--
-- Login credentials:
--   Employee ID: VB-0001
--   Email:       owner@vebosso.com
--   Password:    VEBOSSO
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  owner_uid UUID := uuid_generate_v4();
  owner_email TEXT := 'owner@vebosso.com';
  owner_password TEXT := 'VEBOSSO';
  encrypted_pw TEXT;
BEGIN
  -- Delete all existing auth identities and users
  -- Note: Cascades will automatically delete rows in public.profiles, work_logs, tasks, etc.
  DELETE FROM auth.identities;
  DELETE FROM auth.users;

  encrypted_pw := extensions.crypt(owner_password, extensions.gen_salt('bf'));

  -- Create owner user in auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    owner_uid,
    'authenticated',
    'authenticated',
    owner_email,
    encrypted_pw,
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"VEBOSSO Owner","employee_id":"VB-0001"}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- Create identity mapping
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
    owner_uid,
    owner_uid,
    jsonb_build_object('sub', owner_uid::text, 'email', owner_email, 'email_verified', true),
    'email',
    owner_uid::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- Create profile row linked to the user
  INSERT INTO public.profiles (
    id,
    full_name,
    employee_id,
    role,
    department,
    is_active,
    must_change_password
  ) VALUES (
    owner_uid,
    'VEBOSSO Owner',
    'VB-0001',
    'owner',
    'Management',
    true,
    false
  );

  RAISE NOTICE 'Owner account seeded successfully!';
  RAISE NOTICE 'Employee ID: VB-0001';
  RAISE NOTICE 'Email: owner@vebosso.com';
  RAISE NOTICE 'Password: VEBOSSO';
END $$;
