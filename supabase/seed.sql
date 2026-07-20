-- ============================================================================
-- VEBOSSO EMS — Seed File (Fresh Database)
-- ============================================================================
-- Run ONCE on a brand-new Supabase project, AFTER all migrations (001–016).
--
-- What this does:
--   1. Wipes any stale data (safe on a fresh DB — no-ops if nothing exists)
--   2. Creates the owner account in auth + profiles
--   3. Seeds default app_settings values
--
-- Login credentials after running:
--   Employee ID : VB-0001
--   Password    : VEBOSSO2026
--
-- ⚠️  DO NOT run on production. This is for fresh UAT / dev setups only.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
DECLARE
  owner_uid         UUID   := uuid_generate_v4();
  owner_employee_id TEXT   := 'VB-0001';
  owner_password    TEXT   := 'VEBOSSO2026';
  owner_full_name   TEXT   := 'VEBOSSO Owner';

  -- Email formula: lower() FIRST, then strip non-alphanumeric chars.
  -- 'VB-0001' → lower → 'vb-0001' → strip '-' → 'vb0001' → 'vb0001@vebosso.com'
  -- (The old seed.sql did regexp_replace BEFORE lower(), which stripped 'VB'
  --  and produced '0001@vebosso.com' — that's why fix-owner-email.sql existed.)
  owner_email       TEXT   := regexp_replace(lower(owner_employee_id), '[^a-z0-9]', '', 'g') || '@vebosso.com';
  encrypted_pw      TEXT;
BEGIN

  -- ── Encrypt password ──────────────────────────────────────────────────────
  encrypted_pw := extensions.crypt(owner_password, extensions.gen_salt('bf'));

  -- ── 1. Create auth.users row ──────────────────────────────────────────────
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
    NOW(),   -- email_confirmed_at  (pre-confirmed so login works immediately)
    NOW(),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object(
      'full_name',   owner_full_name,
      'employee_id', owner_employee_id
    ),
    NOW(),
    NOW(),
    '',   -- confirmation_token
    '',   -- email_change
    '',   -- email_change_token_new
    ''    -- recovery_token
  );

  -- ── 2. Create auth.identities row (required for email sign-in) ────────────
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
    jsonb_build_object(
      'sub',            owner_uid::text,
      'email',          owner_email,
      'email_verified', true
    ),
    'email',
    owner_uid::text,
    NOW(),
    NOW(),
    NOW()
  );

  -- ── 3. Create public.profiles row ─────────────────────────────────────────
  INSERT INTO public.profiles (
    id,
    full_name,
    employee_id,
    role,
    department,
    is_active,
    must_change_password
    -- created_by intentionally NULL — owner has no creator
  ) VALUES (
    owner_uid,
    owner_full_name,
    owner_employee_id,
    'owner',
    'Management',
    true,
    false   -- owner does not need to change password on first login
  );

  RAISE NOTICE '============================================================';
  RAISE NOTICE '✅  Owner account seeded successfully!';
  RAISE NOTICE '   Employee ID : %', owner_employee_id;
  RAISE NOTICE '   Auth email  : % (app builds this automatically from ID)', owner_email;
  RAISE NOTICE '   Password    : %', owner_password;
  RAISE NOTICE '============================================================';
END $$;

-- ============================================================================
-- Seed default app_settings
-- (migrations already insert some rows with ON CONFLICT DO NOTHING,
--  but we upsert here to ensure UAT has sensible non-production defaults)
-- ============================================================================
INSERT INTO public.app_settings (key, value) VALUES
  ('company_name',               'VEBOSSO'),
  ('working_hours_start',        '09:00'),
  ('working_hours_end',          '18:00'),
  ('require_checkout_approval',  'false'),
  ('latest_version',             '1.0.0'),
  ('download_url',               'https://github.com/newtane/vebosso-ems/releases/latest')
ON CONFLICT (key) DO UPDATE SET
  value      = EXCLUDED.value,
  updated_at = NOW();
