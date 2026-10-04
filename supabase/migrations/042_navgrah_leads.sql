-- ============================================================================
-- VEBOSSO EMS — Navgrah Leads (042)
-- ============================================================================
-- Leads grouped under banquets (like venues under cities). One shared list:
-- the owner, and everyone the owner gives "Navgrah Leads" to, can see, add,
-- edit, delete, import and export. Off for everyone else.
--
--   lead_banquets  a banquet hall the leads come from
--   leads          date of function, client name, function type, contact,
--                  remarks — in a banquet (or none, if its banquet is removed)
--
-- Access uses feature_access (033) with the new feature 'leads'.
-- Safe to run repeatedly.
-- ============================================================================

-- 1. 'leads' as a feature the owner can give.
ALTER TABLE public.feature_access DROP CONSTRAINT IF EXISTS feature_access_feature_check;
ALTER TABLE public.feature_access
  ADD CONSTRAINT feature_access_feature_check
  CHECK (feature IN ('bills', 'venues', 'accounts', 'leads'));

-- 2. Banquets
CREATE TABLE IF NOT EXISTS public.lead_banquets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_lead_banquet_name CHECK (length(trim(name)) BETWEEN 1 AND 120)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_lead_banquet_name ON public.lead_banquets(lower(trim(name)));

-- 3. Leads
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  banquet_id UUID REFERENCES public.lead_banquets(id) ON DELETE SET NULL,
  -- Date of function
  dof DATE,
  name TEXT,
  function TEXT,
  contact TEXT,
  remarks TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_lead_name CHECK (name IS NULL OR length(name) <= 200),
  CONSTRAINT chk_lead_function CHECK (function IS NULL OR length(function) <= 120),
  CONSTRAINT chk_lead_contact CHECK (contact IS NULL OR length(contact) <= 40),
  CONSTRAINT chk_lead_remarks CHECK (remarks IS NULL OR length(remarks) <= 2000)
);

CREATE INDEX IF NOT EXISTS idx_leads_banquet ON public.leads(banquet_id, dof);

DROP TRIGGER IF EXISTS set_leads_updated_at ON public.leads;
CREATE TRIGGER set_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. Who can use them: the owner, and people given 'leads'.
ALTER TABLE public.lead_banquets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lead_banquets_team_all" ON public.lead_banquets;
CREATE POLICY "lead_banquets_team_all" ON public.lead_banquets
  FOR ALL TO authenticated
  USING (public.has_feature('leads'))
  WITH CHECK (public.has_feature('leads'));

DROP POLICY IF EXISTS "leads_team_all" ON public.leads;
CREATE POLICY "leads_team_all" ON public.leads
  FOR ALL TO authenticated
  USING (public.has_feature('leads'))
  WITH CHECK (public.has_feature('leads'));

-- 5. Live updates while the list is open.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'leads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lead_banquets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_banquets;
    END IF;
  END IF;
END;
$do$;
