-- ============================================================================
-- VEBOSSO EMS — Fix broken owner account (run once in Supabase SQL Editor)
-- ============================================================================
-- Use this if owner login fails after an earlier seed run.
-- It removes the broken owner auth/profile rows and recreates them correctly.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  owner_uid UUID := uuid_generate_v4();
  owner_email TEXT := 'vb0001@vebosso.local';
  owner_password TEXT := 'VebossoOwner@2024';
  encrypted_pw TEXT;
  existing_uid UUID;
BEGIN
  SELECT id INTO existing_uid FROM public.profiles WHERE role = 'owner' LIMIT 1;

  IF existing_uid IS NOT NULL THEN
    DELETE FROM public.profiles WHERE id = existing_uid;
    DELETE FROM auth.identities WHERE user_id = existing_uid;
    DELETE FROM auth.users WHERE id = existing_uid;
  END IF;

  -- Also remove orphaned auth rows for the owner email
  DELETE FROM auth.identities
  WHERE user_id IN (SELECT id FROM auth.users WHERE email = owner_email);

  DELETE FROM auth.users WHERE email = owner_email;

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

  RAISE NOTICE 'Owner account recreated. Employee ID: VB-0001, Password: VebossoOwner@2024';
END $$;
