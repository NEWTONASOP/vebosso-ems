-- ============================================================================
-- VEBOSSO EMS — Full Reset + Fixed Owner Seed
-- ============================================================================
-- DESTRUCTIVE: Deletes ALL auth users and ALL app data tied to profiles
-- (work logs, tasks, announcements, leave requests, sessions, notifications, etc.)
--
-- Preserves: app_settings (version control, company config)
--
-- After run, login with:
--   Employee ID : 2451  (or VB-2451)
--   Password    : VEBOSSO
--   Auth email  : vb2451@vebosso.com  (internal; app builds this automatically)
--
-- Run in Supabase SQL Editor.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
DECLARE
  owner_uid UUID := uuid_generate_v4();
  owner_employee_id TEXT := 'VB-2451';
  -- lower() BEFORE regexp_replace (POSIX [a-z] does not match uppercase VB)
  owner_email TEXT := regexp_replace(lower(owner_employee_id), '[^a-z0-9]', '', 'g') || '@vebosso.com';
  owner_password TEXT := 'VEBOSSO';
  encrypted_pw TEXT;
BEGIN
  -- Disable triggers that can block profile/user deletion on hosted Supabase
  ALTER TABLE public.profiles DISABLE TRIGGER on_profile_delete_cleanup_storage;
  ALTER TABLE public.profiles DISABLE TRIGGER trg_prevent_privilege_escalation;

  -- Wipe all auth users (profiles + related app rows cascade via FK)
  DELETE FROM auth.identities;
  DELETE FROM auth.users;

  ALTER TABLE public.profiles ENABLE TRIGGER on_profile_delete_cleanup_storage;
  ALTER TABLE public.profiles ENABLE TRIGGER trg_prevent_privilege_escalation;

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
    jsonb_build_object('full_name', 'VEBOSSO Owner', 'employee_id', owner_employee_id),
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
    owner_employee_id,
    'owner',
    'Management',
    true,
    false
  );

  RAISE NOTICE '✅ Full reset complete. Owner account created.';
  RAISE NOTICE '   Employee ID : %', owner_employee_id;
  RAISE NOTICE '   Email       : %', owner_email;
  RAISE NOTICE '   Password    : %', owner_password;
END $$;
