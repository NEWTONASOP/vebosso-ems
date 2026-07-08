-- ============================================================================
-- VEBOSSO EMS — Fix owner auth email (2451@ -> vb2451@vebosso.com)
-- Run once if reset script created the wrong email due to uppercase VB stripping.
-- ============================================================================

DO $$
DECLARE
  owner_user_id UUID;
  correct_email TEXT := 'vb2451@vebosso.com';
BEGIN
  SELECT id INTO owner_user_id
  FROM auth.users
  WHERE email IN ('2451@vebosso.com', 'vb2451@vebosso.com')
  LIMIT 1;

  IF owner_user_id IS NULL THEN
    RAISE EXCEPTION 'Owner user not found (expected 2451@ or vb2451@vebosso.com)';
  END IF;

  UPDATE auth.users
  SET
    email = correct_email,
    raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb)
      || jsonb_build_object('employee_id', 'VB-2451', 'full_name', 'VEBOSSO Owner')
  WHERE id = owner_user_id;

  UPDATE auth.identities
  SET identity_data = identity_data || jsonb_build_object('email', correct_email, 'email_verified', true)
  WHERE user_id = owner_user_id;

  UPDATE public.profiles
  SET employee_id = 'VB-2451'
  WHERE id = owner_user_id;

  RAISE NOTICE 'Owner email fixed to %', correct_email;
END $$;
