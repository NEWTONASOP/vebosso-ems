-- ============================================================================
-- VEBOSSO EMS — Seed Owner Account (Fresh Reset)
-- ============================================================================
-- Run this in your Supabase SQL Editor (or: supabase db execute -f supabase/seed.sql)
-- Deletes the existing owner account and recreates it with a new random employee ID.
--
-- Login credentials (generated on each run):
--   Employee ID: random VB-XXXX (see NOTICE output after run)
--   Password:    VEBOSSO
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  owner_uid UUID := uuid_generate_v4();
  owner_employee_id TEXT := 'VB-' || LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');
  owner_email TEXT := lower(regexp_replace(owner_employee_id, '[^a-z0-9]', '', 'g')) || '@vebosso.com';
  owner_password TEXT := 'VEBOSSO';
  encrypted_pw TEXT;
BEGIN
  -- Disable triggers that block owner deletion on hosted Supabase
  ALTER TABLE public.profiles DISABLE TRIGGER on_profile_delete_cleanup_storage;
  ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_privilege_escalation;

  -- Remove existing owner account(s)
  DELETE FROM auth.identities
  WHERE user_id IN (SELECT id FROM public.profiles WHERE role = 'owner');

  DELETE FROM auth.users
  WHERE id IN (SELECT id FROM public.profiles WHERE role = 'owner');

  ALTER TABLE public.profiles ENABLE TRIGGER on_profile_delete_cleanup_storage;
  ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_privilege_escalation;

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
    jsonb_build_object('full_name', 'VEBOSSO Owner', 'employee_id', owner_employee_id),
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
    owner_employee_id,
    'owner',
    'Management',
    true,
    false
  );

  RAISE NOTICE '✅ Owner account seeded successfully!';
  RAISE NOTICE '   Employee ID : %', owner_employee_id;
  RAISE NOTICE '   Email       : %', owner_email;
  RAISE NOTICE '   Password    : VEBOSSO';
END $$;
