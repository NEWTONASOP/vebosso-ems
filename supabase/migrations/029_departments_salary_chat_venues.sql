-- ============================================================================
-- VEBOSSO EMS — Departments, monthly salary, chat, venue status (029)
-- ============================================================================
-- 1. departments + department_members — the owner groups people into
--      departments (one department per person). Owner only.
-- 2. Salary amounts — a monthly salary per person (salary_settings) and the
--      amount actually paid for a month (salary_requests.amount, set by the
--      owner when marking it paid). The person can read their own.
-- 3. chat_messages — a two-way chat between the owner and each person,
--      replacing one-way "Message Boss". Existing boss messages are copied in.
-- 4. Venues — the contact's phone number, and "in business with VEBOSSO":
--      anyone can mark a venue, only the owner can unmark it.
--
-- Run after 028. Safe to run repeatedly.
-- ============================================================================


-- ============================================================================
-- 1. Departments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_department_name CHECK (length(trim(name)) BETWEEN 1 AND 60)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_department_name
  ON public.departments(lower(trim(name)));

-- user_id is the key, so a person is in at most one department.
CREATE TABLE IF NOT EXISTS public.department_members (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_department_members_department
  ON public.department_members(department_id);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.department_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_departments" ON public.departments;
CREATE POLICY "owner_all_departments" ON public.departments
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "owner_all_department_members" ON public.department_members;
CREATE POLICY "owner_all_department_members" ON public.department_members
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());


-- ============================================================================
-- 2. Salary amounts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.salary_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  monthly_amount NUMERIC(12, 2) NOT NULL,
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_salary_monthly_amount CHECK (monthly_amount >= 0 AND monthly_amount < 100000000)
);

DROP TRIGGER IF EXISTS set_salary_settings_updated_at ON public.salary_settings;
CREATE TRIGGER set_salary_settings_updated_at
  BEFORE UPDATE ON public.salary_settings
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.salary_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_salary_settings" ON public.salary_settings;
CREATE POLICY "owner_all_salary_settings" ON public.salary_settings
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "read_own_salary_settings" ON public.salary_settings;
CREATE POLICY "read_own_salary_settings" ON public.salary_settings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE public.salary_requests
  ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);

ALTER TABLE public.salary_requests DROP CONSTRAINT IF EXISTS chk_salary_request_amount;
ALTER TABLE public.salary_requests
  ADD CONSTRAINT chk_salary_request_amount CHECK (amount IS NULL OR (amount >= 0 AND amount < 100000000));

-- Same rules as 020, plus: only the owner sets the amount.
CREATE OR REPLACE FUNCTION public.guard_salary_requests()
RETURNS TRIGGER AS $fn$
BEGIN
  IF public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only manage your own salary requests';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'requested' OR NEW.paid_at IS NOT NULL
       OR NEW.paid_by IS NOT NULL OR NEW.received_at IS NOT NULL
       OR NEW.amount IS NOT NULL THEN
      RAISE EXCEPTION 'A new salary request must start as requested';
    END IF;
    NEW.requested_at := now();
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.month IS DISTINCT FROM OLD.month
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.paid_at IS DISTINCT FROM OLD.paid_at
     OR NEW.paid_by IS DISTINCT FROM OLD.paid_by
     OR NEW.amount IS DISTINCT FROM OLD.amount THEN
    RAISE EXCEPTION 'Not allowed to change this salary record';
  END IF;

  IF OLD.status = 'requested' AND NEW.status = 'requested' THEN
    NEW.requested_at := now();
    NEW.received_at := OLD.received_at;
    RETURN NEW;
  END IF;

  IF OLD.status = 'paid' AND NEW.status = 'received' THEN
    NEW.received_at := now();
    NEW.requested_at := OLD.requested_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not allowed to change this salary record';
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- 3. Chat — owner ↔ one person
-- ============================================================================
-- member_id is the non-owner side of the conversation; every owner shares it.

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  member_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- When the other side read it.
  read_at TIMESTAMPTZ,

  CONSTRAINT chk_chat_body CHECK (length(trim(body)) BETWEEN 1 AND 2000)
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_member
  ON public.chat_messages(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread
  ON public.chat_messages(member_id) WHERE read_at IS NULL;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_read_chat" ON public.chat_messages;
CREATE POLICY "owner_read_chat" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "owner_send_chat" ON public.chat_messages;
CREATE POLICY "owner_send_chat" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_owner() AND sender_id = auth.uid() AND read_at IS NULL);

DROP POLICY IF EXISTS "member_read_own_chat" ON public.chat_messages;
CREATE POLICY "member_read_own_chat" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (member_id = auth.uid());

DROP POLICY IF EXISTS "member_send_own_chat" ON public.chat_messages;
CREATE POLICY "member_send_own_chat" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (member_id = auth.uid() AND sender_id = auth.uid() AND read_at IS NULL);
-- No UPDATE / DELETE policies: messages are final. Read receipts go through
-- mark_chat_read below.

-- Marks the other side's messages in one conversation as read.
CREATE OR REPLACE FUNCTION public.mark_chat_read(p_member_id UUID)
RETURNS VOID AS $fn$
BEGIN
  IF public.is_owner() THEN
    UPDATE public.chat_messages
    SET read_at = now()
    WHERE member_id = p_member_id
      AND read_at IS NULL
      AND sender_id = p_member_id;
  ELSIF p_member_id = auth.uid() THEN
    UPDATE public.chat_messages
    SET read_at = now()
    WHERE member_id = p_member_id
      AND read_at IS NULL
      AND sender_id IS DISTINCT FROM p_member_id;
  ELSE
    RAISE EXCEPTION 'Not allowed';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.mark_chat_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_chat_read(UUID) TO authenticated;

-- Old one-way messages become the start of each chat (only once).
INSERT INTO public.chat_messages (member_id, sender_id, body, created_at, read_at)
SELECT b.sender_id, b.sender_id, b.body, b.created_at,
       CASE WHEN b.status = 'done' THEN COALESCE(b.done_at, b.created_at) END
FROM public.boss_messages b
WHERE NOT EXISTS (
  SELECT 1 FROM public.chat_messages c
  WHERE c.member_id = b.sender_id AND c.created_at = b.created_at AND c.body = b.body
);


-- ============================================================================
-- 4. Venues — phone number and "in business with VEBOSSO"
-- ============================================================================

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS in_business BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS in_business_by_name TEXT,
  ADD COLUMN IF NOT EXISTS in_business_at TIMESTAMPTZ;

ALTER TABLE public.venues DROP CONSTRAINT IF EXISTS chk_venue_contact_phone;
ALTER TABLE public.venues
  ADD CONSTRAINT chk_venue_contact_phone CHECK (contact_phone IS NULL OR length(contact_phone) <= 30);

-- Anyone in the team can mark a venue as in business; only the owner can
-- take the mark off. Non-owners have no UPDATE policy, so it goes through here.
CREATE OR REPLACE FUNCTION public.set_venue_in_business(p_venue_id UUID, p_value BOOLEAN)
RETURNS VOID AS $fn$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_active
  ) THEN
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

REVOKE ALL ON FUNCTION public.set_venue_in_business(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_venue_in_business(UUID, BOOLEAN) TO authenticated;


-- ============================================================================
-- 5. Realtime
-- ============================================================================

DO $do$
DECLARE
  t TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    FOREACH t IN ARRAY ARRAY['chat_messages', 'departments', 'department_members'] LOOP
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      END IF;
    END LOOP;
  END IF;
END;
$do$;
