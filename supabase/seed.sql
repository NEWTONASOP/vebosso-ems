-- ============================================================================
-- VEBOSSO EMS — Seed Owner Account
-- ============================================================================
-- Run this AFTER running the migrations.
-- Creates the initial owner account in Supabase Auth + profiles table.
--
-- Login credentials:
--   Employee ID: VB-0001
--   Password:    VebossoOwner@2024
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  owner_uid UUID := uuid_generate_v4();
  owner_email TEXT := 'vb0001@vebosso.local';
  owner_password TEXT := 'VebossoOwner@2024';
  encrypted_pw TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE role = 'owner') THEN
    RAISE NOTICE 'Owner account already exists. Skipping seed.';
    RETURN;
  END IF;

  encrypted_pw := extensions.crypt(owner_password, extensions.gen_salt('bf'));

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

  RAISE NOTICE 'Owner account created successfully!';
  RAISE NOTICE 'Employee ID: VB-0001';
  RAISE NOTICE 'Password: VebossoOwner@2024';
END $$;
