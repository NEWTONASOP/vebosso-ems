-- ============================================================================
-- VEBOSSO EMS — Feature access, venue cities, voice notes, no bill deletes (033)
-- ============================================================================
-- 1. feature_access — the owner gives chosen people Bills, Venues and/or
--      Accounts. Off by default for everyone (so Venues, which everyone had,
--      is now off until given). Replaces bill_access (rows carried over).
-- 2. Bills can never be deleted — trash is final (no DELETE policy at all).
-- 3. Venues: only people with Venues access (and the owner). Cities — anyone
--      with Venues access can add a city; each venue can belong to one.
-- 4. Accounts: the owner and people given Accounts.
-- 5. Voice notes — in chats (both sides) and on tasks (only the person giving
--      the task, i.e. the owner or the member's manager). Files live in the
--      private `voice-notes` bucket:  chat/<member_id>/…  and  task/<assignee_id>/…
--
-- Run after 032. Safe to run repeatedly.
-- ============================================================================


-- ============================================================================
-- 1. Feature access
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_access (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('bills', 'venues', 'accounts')),
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature)
);

ALTER TABLE public.feature_access ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_feature_access" ON public.feature_access;
CREATE POLICY "owner_all_feature_access" ON public.feature_access
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_feature_access" ON public.feature_access;
CREATE POLICY "read_own_feature_access" ON public.feature_access
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- The owner, or an active person the owner gave this feature to.
CREATE OR REPLACE FUNCTION public.has_feature(p_feature TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.feature_access a
    JOIN public.profiles p ON p.id = a.user_id
    WHERE a.user_id = auth.uid() AND a.feature = p_feature AND p.is_active
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.has_feature(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_feature(TEXT) TO authenticated;

-- Bills access given so far (030) carries over.
DO $do$
BEGIN
  IF to_regclass('public.bill_access') IS NOT NULL THEN
    INSERT INTO public.feature_access (user_id, feature, granted_by, granted_at)
    SELECT user_id, 'bills', granted_by, granted_at FROM public.bill_access
    ON CONFLICT DO NOTHING;
  END IF;
END;
$do$;

-- Bills policies (030) call this; it now reads feature_access.
CREATE OR REPLACE FUNCTION public.can_manage_bills()
RETURNS BOOLEAN AS $fn$
  SELECT public.has_feature('bills');
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

DROP TABLE IF EXISTS public.bill_access;


-- ============================================================================
-- 2. Bills: no deleting, ever
-- ============================================================================

DROP POLICY IF EXISTS "owner_all_bills" ON public.bills;
DROP POLICY IF EXISTS "bills_team_all" ON public.bills;
DROP POLICY IF EXISTS "bills_team_read" ON public.bills;
DROP POLICY IF EXISTS "bills_team_add" ON public.bills;
DROP POLICY IF EXISTS "bills_team_edit" ON public.bills;

CREATE POLICY "bills_team_read" ON public.bills
  FOR SELECT TO authenticated USING (public.can_manage_bills());
CREATE POLICY "bills_team_add" ON public.bills
  FOR INSERT TO authenticated WITH CHECK (public.can_manage_bills());
CREATE POLICY "bills_team_edit" ON public.bills
  FOR UPDATE TO authenticated
  USING (public.can_manage_bills())
  WITH CHECK (public.can_manage_bills());
-- No DELETE policy: a trashed bill stays in Trash.


-- ============================================================================
-- 3. Venues — access, cities
-- ============================================================================

DROP POLICY IF EXISTS "employees_read_venues" ON public.venues;
DROP POLICY IF EXISTS "employees_add_venues" ON public.venues;
DROP POLICY IF EXISTS "venues_team_read" ON public.venues;
DROP POLICY IF EXISTS "venues_team_add" ON public.venues;

CREATE POLICY "venues_team_read" ON public.venues
  FOR SELECT TO authenticated USING (public.has_feature('venues'));
CREATE POLICY "venues_team_add" ON public.venues
  FOR INSERT TO authenticated WITH CHECK (public.has_feature('venues'));
-- Editing and deleting stay owner-only (owner_all_venues, 024).

CREATE TABLE IF NOT EXISTS public.venue_cities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_venue_city_name CHECK (length(trim(name)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_venue_city_name ON public.venue_cities(lower(trim(name)));

ALTER TABLE public.venue_cities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_venue_cities" ON public.venue_cities;
CREATE POLICY "owner_all_venue_cities" ON public.venue_cities
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "venue_cities_team_read" ON public.venue_cities;
CREATE POLICY "venue_cities_team_read" ON public.venue_cities
  FOR SELECT TO authenticated USING (public.has_feature('venues'));

DROP POLICY IF EXISTS "venue_cities_team_add" ON public.venue_cities;
CREATE POLICY "venue_cities_team_add" ON public.venue_cities
  FOR INSERT TO authenticated WITH CHECK (public.has_feature('venues'));

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS city_id UUID REFERENCES public.venue_cities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_city ON public.venues(city_id);

-- "In business" marking (029): now for anyone with Venues access.
CREATE OR REPLACE FUNCTION public.set_venue_in_business(p_venue_id UUID, p_value BOOLEAN)
RETURNS VOID AS $fn$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT public.has_feature('venues') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT p_value AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can remove this mark';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.venues
  SET in_business = p_value,
      in_business_by_name = CASE WHEN p_value THEN v_name END,
      in_business_at = CASE WHEN p_value THEN now() END
  WHERE id = p_venue_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- 4. Accounts — owner and people given Accounts
-- ============================================================================

DROP POLICY IF EXISTS "owner_all_accounts" ON public.accounts;
DROP POLICY IF EXISTS "accounts_team_all" ON public.accounts;
CREATE POLICY "accounts_team_all" ON public.accounts
  FOR ALL TO authenticated
  USING (public.has_feature('accounts'))
  WITH CHECK (public.has_feature('accounts'));

DROP POLICY IF EXISTS "owner_all_account_txns" ON public.account_transactions;
DROP POLICY IF EXISTS "account_txns_team_all" ON public.account_transactions;
CREATE POLICY "account_txns_team_all" ON public.account_transactions
  FOR ALL TO authenticated
  USING (public.has_feature('accounts'))
  WITH CHECK (public.has_feature('accounts'));

DROP POLICY IF EXISTS "account_receipts_owner_all" ON storage.objects;
DROP POLICY IF EXISTS "account_receipts_team_all" ON storage.objects;
CREATE POLICY "account_receipts_team_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'account-receipts' AND public.has_feature('accounts'))
  WITH CHECK (bucket_id = 'account-receipts' AND public.has_feature('accounts'));


-- ============================================================================
-- 5. Voice notes
-- ============================================================================

-- Chat: a message is text, a voice note, or both.
ALTER TABLE public.chat_messages ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS audio_path TEXT,
  ADD COLUMN IF NOT EXISTS audio_ms INT;
ALTER TABLE public.chat_messages DROP CONSTRAINT IF EXISTS chk_chat_body;
ALTER TABLE public.chat_messages
  ADD CONSTRAINT chk_chat_body CHECK (
    (body IS NOT NULL AND length(trim(body)) BETWEEN 1 AND 2000)
    OR audio_path IS NOT NULL
  );

-- Tasks: an optional voice note from whoever gave the task.
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS voice_path TEXT,
  ADD COLUMN IF NOT EXISTS voice_ms INT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voice-notes',
  'voice-notes',
  false,
  10485760, -- 10MB (a few minutes of voice)
  '{"audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/webm", "audio/ogg", "audio/mpeg"}'
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "voice_owner_all" ON storage.objects;
CREATE POLICY "voice_owner_all" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'voice-notes' AND public.is_owner())
  WITH CHECK (bucket_id = 'voice-notes' AND public.is_owner());

-- Chat voice notes: the person, in their own conversation's folder.
DROP POLICY IF EXISTS "voice_chat_own_read" ON storage.objects;
CREATE POLICY "voice_chat_own_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'chat'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "voice_chat_own_add" ON storage.objects;
CREATE POLICY "voice_chat_own_add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'chat'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Task voice notes: the assignee listens; their manager records and listens.
DROP POLICY IF EXISTS "voice_task_read" ON storage.objects;
CREATE POLICY "voice_task_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'task'
    AND (
      (storage.foldername(name))[2] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id::text = (storage.foldername(name))[2] AND p.manager_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "voice_task_manager_add" ON storage.objects;
CREATE POLICY "voice_task_manager_add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = 'task'
    AND public.get_user_role() = 'manager'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[2] AND p.manager_id = auth.uid()
    )
  );


-- ============================================================================
-- 6. Realtime
-- ============================================================================

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'venue_cities'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_cities;
  END IF;
END;
$do$;
