-- ============================================================================
-- VEBOSSO EMS — Add a Second Owner (non-destructive)
-- ============================================================================
-- Adds a NEW owner account. Does NOT delete or modify any existing owner.
--
-- Matches how seed.sql / reset-all-seed-owner.sql create owners:
--   1. auth.users  (Supabase Auth login)
--   2. auth.identities  (email provider mapping)
--   3. public.profiles  (role = 'owner', employee_id unique)
--
-- Login email is derived the same way as the app (authStore + create-member):
--   VB-2001  ->  vb2001@vebosso.com
--
-- Run in Supabase Dashboard → SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  -- ===== EDIT THESE BEFORE RUNNING =====
  new_full_name       TEXT := 'Test Owner';       -- display name
  new_employee_id     TEXT := 'VB-8707';            -- must be unique (e.g. VB-2001)
  new_password        TEXT := 'VEBOSSO';            -- min 8 chars; share securely
  new_department      TEXT := 'Management';
  -- =====================================

  new_uid             UUID;
  new_email           TEXT;
  encrypted_pw        TEXT;
  existing_owner_id   UUID;
BEGIN
  -- Normalize employee ID (same style as app: uppercase VB-XXXX)
  new_employee_id := upper(trim(new_employee_id));

  -- Email: lower() first, then strip non-alphanumeric (see fix-owner-email.sql)
  new_email := regexp_replace(lower(new_employee_id), '[^a-z0-9]', '', 'g') || '@vebosso.com';

  IF length(new_password) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters.';
  END IF;

  -- Safety: do not overwrite existing accounts
  IF EXISTS (SELECT 1 FROM public.profiles WHERE employee_id = new_employee_id) THEN
    RAISE EXCEPTION 'Employee ID "%" already exists. Pick a different ID.', new_employee_id;
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = new_email) THEN
    RAISE EXCEPTION 'Auth email "%" already exists. Pick a different employee ID.', new_email;
  END IF;

  -- Optional: link created_by to the first existing owner (for audit trail)
  SELECT id INTO existing_owner_id
  FROM public.profiles
  WHERE role = 'owner'
  ORDER BY created_at ASC
  LIMIT 1;

  new_uid := uuid_generate_v4();
  encrypted_pw := extensions.crypt(new_password, extensions.gen_salt('bf'));

  -- 1. Supabase Auth user (same columns as seed.sql)
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
    new_uid,
    'authenticated',
    'authenticated',
    new_email,
    encrypted_pw,
    NOW(),
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', new_full_name, 'employee_id', new_employee_id),
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  );

  -- 2. Identity row (required for email/password sign-in)
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
    new_uid,
    new_uid,
    jsonb_build_object('sub', new_uid::text, 'email', new_email, 'email_verified', true),
    'email',
    new_uid::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- 3. Profile row (profiles.id must match auth.users.id per migration 001)
  INSERT INTO public.profiles (
    id,
    full_name,
    employee_id,
    role,
    department,
    is_active,
    must_change_password,
    created_by
  ) VALUES (
    new_uid,
    new_full_name,
    new_employee_id,
    'owner',
    new_department,
    true,
    false,
    existing_owner_id
  );

  RAISE NOTICE '✅ Second owner created successfully (existing owner untouched).';
  RAISE NOTICE '   Full name   : %', new_full_name;
  RAISE NOTICE '   Employee ID : %', new_employee_id;
  RAISE NOTICE '   Auth email  : % (internal — app builds this automatically)', new_email;
  RAISE NOTICE '   Password    : %', new_password;
  RAISE NOTICE '   Owners now  : %', (SELECT count(*) FROM public.profiles WHERE role = 'owner');
END $$;
