-- ============================================================================
-- VEBOSSO EMS — Employee details (045)
-- ============================================================================
-- One record per person: personal, contact, emergency contact, family, work
-- (joining date, working hours, weekly off), education and experience.
-- The person fills it in once — after that they can only read it. The owner
-- can read, fill in, change or clear anyone's at any time.
-- ID papers and bank proof stay in Documents, and pay in Salary — not here.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.employee_details (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- Personal
  date_of_birth DATE,
  gender TEXT,
  blood_group TEXT,
  marital_status TEXT,

  -- Contact
  phone TEXT,
  alt_phone TEXT,
  personal_email TEXT,
  current_address TEXT,
  permanent_address TEXT,

  -- Emergency contact
  emergency_name TEXT,
  emergency_relation TEXT,
  emergency_phone TEXT,

  -- Family: [{ "name", "relation", "phone", "occupation" }]
  family JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Work
  joining_date DATE,
  work_start TEXT,          -- "HH:mm"
  work_end TEXT,            -- "HH:mm"
  weekly_off TEXT[] NOT NULL DEFAULT '{}',

  -- Education & experience
  qualification TEXT,
  experience TEXT,

  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_employee_family_array CHECK (jsonb_typeof(family) = 'array'),
  CONSTRAINT chk_employee_work_start CHECK (work_start IS NULL OR work_start ~ '^\d{2}:\d{2}$'),
  CONSTRAINT chk_employee_work_end CHECK (work_end IS NULL OR work_end ~ '^\d{2}:\d{2}$')
);

DROP TRIGGER IF EXISTS set_employee_details_updated_at ON public.employee_details;
CREATE TRIGGER set_employee_details_updated_at
  BEFORE UPDATE ON public.employee_details
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Who changed it last is always the signed-in person.
CREATE OR REPLACE FUNCTION public.set_employee_details_editor()
RETURNS TRIGGER AS $fn$
BEGIN
  NEW.updated_by := auth.uid();
  IF TG_OP = 'UPDATE' THEN
    NEW.submitted_at := OLD.submitted_at;
  ELSIF NOT public.is_owner() THEN
    NEW.submitted_at := now();
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_employee_details_editor ON public.employee_details;
CREATE TRIGGER trg_employee_details_editor
  BEFORE INSERT OR UPDATE ON public.employee_details
  FOR EACH ROW EXECUTE FUNCTION public.set_employee_details_editor();

ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;

-- Owner: everything.
DROP POLICY IF EXISTS "employee_details_owner_all" ON public.employee_details;
CREATE POLICY "employee_details_owner_all" ON public.employee_details
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- The person: read their own, and fill it in once. No UPDATE or DELETE
-- policy, so after the first save it is locked for them.
DROP POLICY IF EXISTS "employee_details_read_own" ON public.employee_details;
CREATE POLICY "employee_details_read_own" ON public.employee_details
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "employee_details_add_own" ON public.employee_details;
CREATE POLICY "employee_details_add_own" ON public.employee_details
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
