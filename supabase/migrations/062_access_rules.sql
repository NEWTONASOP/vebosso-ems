-- ============================================================================
-- VEBOSSO EMS — Detailed access for Venues, Bills and Leads (062)
--
-- Until now a feature was just on or off per person (feature_access, 033), with
-- Venues also having one global "shared" switch (052). This adds RULES on top:
-- a person can have several rules per feature, each saying
--
--   scope    what they can see
--              own       only what they added
--              all       everything
--              people    what the listed people added (+ their own)
--              cities    venues in the listed cities (+ their own)    [venues]
--              banquets  leads in the listed banquets (+ their own)   [leads]
--              brands    bills of the listed brands (+ their own)     [bills]
--   do       can_add / can_edit / can_delete  (seeing is always included)
--   when     starts_at … expires_at (NULL = no end). Checked live on every
--            request, so access stops at the exact moment — no scheduled job.
--
-- feature_access stays as the "has this feature at all" row, so every existing
-- has_feature() check keeps working; for these three features it now also
-- needs at least one ACTIVE rule. Accounts is untouched.
--
-- Existing people keep exactly today's behaviour (see the backfill at the end):
--   venues  own-only, or everyone's if the global switch was on; add/edit/delete
--   bills   everything, add/edit/delete
--   leads   everything, add/edit/delete
--
-- Safe to run repeatedly.
-- ============================================================================

-- 1. Rules ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.access_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('venues', 'bills', 'leads')),
  scope TEXT NOT NULL CHECK (scope IN ('own', 'all', 'people', 'cities', 'banquets', 'brands')),
  -- people / city / banquet ids, depending on scope
  scope_ids UUID[] NOT NULL DEFAULT '{}',
  -- brand keys for bills
  scope_values TEXT[] NOT NULL DEFAULT '{}',
  can_add BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  granted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- a scope only fits its own feature
  CONSTRAINT chk_access_scope_feature CHECK (
    scope IN ('own', 'all', 'people')
    OR (scope = 'cities' AND feature = 'venues')
    OR (scope = 'banquets' AND feature = 'leads')
    OR (scope = 'brands' AND feature = 'bills')
  ),
  CONSTRAINT chk_access_window CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_access_rules_user ON public.access_rules(user_id, feature);

ALTER TABLE public.access_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "access_rules_owner_all" ON public.access_rules;
CREATE POLICY "access_rules_owner_all" ON public.access_rules
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "access_rules_read_own" ON public.access_rules;
CREATE POLICY "access_rules_read_own" ON public.access_rules
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 2. Checks --------------------------------------------------------------------

-- Does the signed-in person have at least one rule that is on right now?
CREATE OR REPLACE FUNCTION public.has_active_rule(p_feature TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.access_rules r
    WHERE r.user_id = auth.uid()
      AND r.feature = p_feature
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.has_active_rule(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_rule(TEXT) TO authenticated;

-- The owner, or an active person given this feature. For venues, bills and
-- leads they also need an active rule (so an ended rule ends all access).
CREATE OR REPLACE FUNCTION public.has_feature(p_feature TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR (
    EXISTS (
      SELECT 1
      FROM public.feature_access a
      JOIN public.profiles p ON p.id = a.user_id
      WHERE a.user_id = auth.uid() AND a.feature = p_feature AND p.is_active
    )
    AND (p_feature NOT IN ('venues', 'bills', 'leads') OR public.has_active_rule(p_feature))
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.has_feature(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_feature(TEXT) TO authenticated;

-- May the signed-in person do p_action ('view' | 'add' | 'edit' | 'delete') to
-- one row?
--   p_owner   who added the row (added_by / created_by)
--   p_target  its city / banquet id (cities and banquets scopes)
--   p_value   its brand (brands scope)
-- What someone added themselves stays visible and editable to them (as far as
-- the rule's ticks go); for a NEW row the scope itself must fit.
CREATE OR REPLACE FUNCTION public.access_ok(
  p_feature TEXT,
  p_action TEXT,
  p_owner UUID,
  p_target UUID DEFAULT NULL,
  p_value TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = p_feature
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (
        p_action = 'view'
        OR (p_action = 'add' AND r.can_add)
        OR (p_action = 'edit' AND r.can_edit)
        OR (p_action = 'delete' AND r.can_delete)
      )
      AND (
        r.scope = 'all'
        OR (r.scope IN ('own', 'people') AND (
              p_action = 'add'
              OR p_owner = auth.uid()
              OR (r.scope = 'people' AND p_owner = ANY (r.scope_ids))
        ))
        OR (r.scope IN ('cities', 'banquets') AND (
              p_target = ANY (r.scope_ids)
              OR (p_action <> 'add' AND p_owner = auth.uid())
        ))
        OR (r.scope = 'brands' AND (
              p_value = ANY (r.scope_values)
              OR (p_action <> 'add' AND p_owner = auth.uid())
        ))
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_ok(TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_ok(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;

-- The lists that rows hang under (cities, banquets), which hold no "added by"
-- that matters. Seen when a rule shows everything, or names this one.
CREATE OR REPLACE FUNCTION public.access_list_visible(p_feature TEXT, p_id UUID)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = p_feature
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (r.scope IN ('all', 'own', 'people', 'brands') OR p_id = ANY (r.scope_ids))
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_list_visible(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_list_visible(TEXT, UUID) TO authenticated;

-- May they add / change / remove entries in such a list at all (a new city or
-- banquet)? Not with a rule that is limited to named cities or banquets.
CREATE OR REPLACE FUNCTION public.access_list_ok(p_feature TEXT, p_action TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = p_feature
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND r.scope NOT IN ('cities', 'banquets')
      AND (
        (p_action = 'add' AND r.can_add)
        OR (p_action = 'edit' AND r.can_edit)
        OR (p_action = 'delete' AND r.can_delete)
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_list_ok(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_list_ok(TEXT, TEXT) TO authenticated;

-- 3. Venues --------------------------------------------------------------------
DROP POLICY IF EXISTS "venues_team_read" ON public.venues;
DROP POLICY IF EXISTS "venues_team_add" ON public.venues;
DROP POLICY IF EXISTS "venues_team_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_team_delete" ON public.venues;
DROP POLICY IF EXISTS "venues_own_read" ON public.venues;
DROP POLICY IF EXISTS "venues_own_add" ON public.venues;
DROP POLICY IF EXISTS "venues_own_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_own_delete" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_read" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_add" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_delete" ON public.venues;

CREATE POLICY "venues_rule_read" ON public.venues
  FOR SELECT TO authenticated
  USING (public.access_ok('venues', 'view', added_by, city_id));
CREATE POLICY "venues_rule_add" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.access_ok('venues', 'add', added_by, city_id));
CREATE POLICY "venues_rule_edit" ON public.venues
  FOR UPDATE TO authenticated
  USING (public.access_ok('venues', 'edit', added_by, city_id))
  WITH CHECK (public.access_ok('venues', 'edit', added_by, city_id));
CREATE POLICY "venues_rule_delete" ON public.venues
  FOR DELETE TO authenticated
  USING (public.access_ok('venues', 'delete', added_by, city_id));

-- Cities
DROP POLICY IF EXISTS "venue_cities_team_read" ON public.venue_cities;
DROP POLICY IF EXISTS "venue_cities_team_add" ON public.venue_cities;
DROP POLICY IF EXISTS "venue_cities_rule_read" ON public.venue_cities;
DROP POLICY IF EXISTS "venue_cities_rule_add" ON public.venue_cities;

CREATE POLICY "venue_cities_rule_read" ON public.venue_cities
  FOR SELECT TO authenticated
  USING (public.access_list_visible('venues', id));
CREATE POLICY "venue_cities_rule_add" ON public.venue_cities
  FOR INSERT TO authenticated
  WITH CHECK (public.access_list_ok('venues', 'add'));

-- "In business" mark: needs edit on that venue.
CREATE OR REPLACE FUNCTION public.set_venue_in_business(p_venue_id UUID, p_value BOOLEAN)
RETURNS VOID AS $fn$
DECLARE
  v_name TEXT;
BEGIN
  IF NOT public.has_feature('venues') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = auth.uid();

  UPDATE public.venues
  SET in_business = p_value,
      in_business_by_name = CASE WHEN p_value THEN v_name END,
      in_business_at = CASE WHEN p_value THEN now() END
  WHERE id = p_venue_id
    AND public.access_ok('venues', 'edit', added_by, city_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. Bills ---------------------------------------------------------------------
DROP POLICY IF EXISTS "bills_team_all" ON public.bills;
DROP POLICY IF EXISTS "bills_rule_read" ON public.bills;
DROP POLICY IF EXISTS "bills_rule_add" ON public.bills;
DROP POLICY IF EXISTS "bills_rule_edit" ON public.bills;
DROP POLICY IF EXISTS "bills_rule_delete" ON public.bills;

CREATE POLICY "bills_rule_read" ON public.bills
  FOR SELECT TO authenticated
  USING (public.access_ok('bills', 'view', created_by, NULL, brand));
CREATE POLICY "bills_rule_add" ON public.bills
  FOR INSERT TO authenticated
  WITH CHECK (public.access_ok('bills', 'add', created_by, NULL, brand));
-- A new bill is saved as a draft and then updated while it is filled in. So
-- someone who may ADD bills can keep working on their own draft (only while it
-- is still a draft; once saved, changing it needs the Edit tick).
CREATE POLICY "bills_rule_edit" ON public.bills
  FOR UPDATE TO authenticated
  USING (
    public.access_ok('bills', 'edit', created_by, NULL, brand)
    OR (status = 'draft' AND created_by = auth.uid()
        AND public.access_ok('bills', 'add', created_by, NULL, brand))
  )
  WITH CHECK (
    public.access_ok('bills', 'edit', created_by, NULL, brand)
    OR (created_by = auth.uid() AND public.access_ok('bills', 'add', created_by, NULL, brand))
  );
CREATE POLICY "bills_rule_delete" ON public.bills
  FOR DELETE TO authenticated
  USING (public.access_ok('bills', 'delete', created_by, NULL, brand));

-- Bills are never deleted: "delete" means moving to trash, which is an update.
-- So trashing a bill needs the Delete tick, not just Edit.
CREATE OR REPLACE FUNCTION public.bills_trash_needs_delete()
RETURNS TRIGGER AS $fn$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NEW.status = 'trash'
     AND OLD.status IS DISTINCT FROM 'trash'
     AND NOT public.access_ok('bills', 'delete', OLD.created_by, NULL, OLD.brand) THEN
    RAISE EXCEPTION 'You are not allowed to delete this bill';
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_bills_trash_needs_delete ON public.bills;
CREATE TRIGGER trg_bills_trash_needs_delete
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.bills_trash_needs_delete();

-- A bill's edit history is seen by whoever can see the bill (RLS on bills
-- applies inside the sub-select).
DROP POLICY IF EXISTS "bill_edits_read" ON public.bill_edits;
CREATE POLICY "bill_edits_read" ON public.bill_edits
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.bills b WHERE b.id = bill_edits.bill_id));

-- 5. Leads ---------------------------------------------------------------------
DROP POLICY IF EXISTS "leads_team_all" ON public.leads;
DROP POLICY IF EXISTS "leads_rule_read" ON public.leads;
DROP POLICY IF EXISTS "leads_rule_add" ON public.leads;
DROP POLICY IF EXISTS "leads_rule_edit" ON public.leads;
DROP POLICY IF EXISTS "leads_rule_delete" ON public.leads;

CREATE POLICY "leads_rule_read" ON public.leads
  FOR SELECT TO authenticated
  USING (public.access_ok('leads', 'view', created_by, banquet_id));
CREATE POLICY "leads_rule_add" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (public.access_ok('leads', 'add', created_by, banquet_id));
CREATE POLICY "leads_rule_edit" ON public.leads
  FOR UPDATE TO authenticated
  USING (public.access_ok('leads', 'edit', created_by, banquet_id))
  WITH CHECK (public.access_ok('leads', 'edit', created_by, banquet_id));
CREATE POLICY "leads_rule_delete" ON public.leads
  FOR DELETE TO authenticated
  USING (public.access_ok('leads', 'delete', created_by, banquet_id));

DROP POLICY IF EXISTS "lead_banquets_team_all" ON public.lead_banquets;
DROP POLICY IF EXISTS "lead_banquets_rule_read" ON public.lead_banquets;
DROP POLICY IF EXISTS "lead_banquets_rule_add" ON public.lead_banquets;
DROP POLICY IF EXISTS "lead_banquets_rule_edit" ON public.lead_banquets;
DROP POLICY IF EXISTS "lead_banquets_rule_delete" ON public.lead_banquets;

CREATE POLICY "lead_banquets_rule_read" ON public.lead_banquets
  FOR SELECT TO authenticated
  USING (public.access_list_visible('leads', id));
CREATE POLICY "lead_banquets_rule_add" ON public.lead_banquets
  FOR INSERT TO authenticated
  WITH CHECK (public.access_list_ok('leads', 'add'));
CREATE POLICY "lead_banquets_rule_edit" ON public.lead_banquets
  FOR UPDATE TO authenticated
  USING (public.access_list_ok('leads', 'edit'))
  WITH CHECK (public.access_list_ok('leads', 'edit'));
CREATE POLICY "lead_banquets_rule_delete" ON public.lead_banquets
  FOR DELETE TO authenticated
  USING (public.access_list_ok('leads', 'delete'));

-- 6. Everyone who has access today keeps exactly what they have ------------------
-- Venues were own-only, or everyone's while the global switch (052) was on.
INSERT INTO public.access_rules (user_id, feature, scope, can_add, can_edit, can_delete, granted_by)
SELECT a.user_id,
       a.feature,
       CASE WHEN a.feature = 'venues' AND NOT public.venues_shared() THEN 'own' ELSE 'all' END,
       true, true, true,
       a.granted_by
FROM public.feature_access a
WHERE a.feature IN ('venues', 'bills', 'leads')
  AND NOT EXISTS (
    SELECT 1 FROM public.access_rules r WHERE r.user_id = a.user_id AND r.feature = a.feature
  );
