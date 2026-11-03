-- ============================================================================
-- VEBOSSO EMS — Venue brands (074)
--
-- A brand is a group of venues (a hotel chain: many hotels, one brand). A venue
-- sits under one city AND one brand, and shows under both on the venues list.
--
--   venue_brands      the shared list of brands (same rules as venue_cities)
--   venues.brand_id   the brand a venue belongs to (NULL = none)
--
-- Access rules need no new scope. A 'cities' rule's scope_ids (and a 'people'
-- rule's within_ids) may now hold brand ids as well as city ids — they are all
-- UUIDs, so they can't clash. A venue is reachable when the rule names its city
-- OR its brand: venue_access_ok() asks access_ok() about both.
--
-- Run after 073. Safe to run repeatedly.
-- ============================================================================

-- 1. Brands --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.venue_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT chk_venue_brand_name CHECK (length(trim(name)) BETWEEN 1 AND 80)
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_venue_brand_name ON public.venue_brands(lower(trim(name)));

ALTER TABLE public.venue_brands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_all_venue_brands" ON public.venue_brands;
CREATE POLICY "owner_all_venue_brands" ON public.venue_brands
  FOR ALL TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());

DROP POLICY IF EXISTS "venue_brands_rule_read" ON public.venue_brands;
CREATE POLICY "venue_brands_rule_read" ON public.venue_brands
  FOR SELECT TO authenticated
  USING (public.access_list_visible('venues', id));

DROP POLICY IF EXISTS "venue_brands_rule_add" ON public.venue_brands;
CREATE POLICY "venue_brands_rule_add" ON public.venue_brands
  FOR INSERT TO authenticated
  WITH CHECK (public.access_list_ok('venues', 'add'));

ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES public.venue_brands(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_venues_brand ON public.venues(brand_id);

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'venue_brands'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.venue_brands;
  END IF;
END;
$do$;

-- 2. Access: a venue is reachable through its city or its brand ------------------
CREATE OR REPLACE FUNCTION public.venue_access_ok(
  p_action TEXT,
  p_owner UUID,
  p_city UUID,
  p_brand UUID
) RETURNS BOOLEAN AS $fn$
  SELECT public.access_ok('venues', p_action, p_owner, p_city)
      OR (p_brand IS NOT NULL AND public.access_ok('venues', p_action, p_owner, p_brand));
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.venue_access_ok(TEXT, UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.venue_access_ok(TEXT, UUID, UUID, UUID) TO authenticated;

-- Same policy names as 062, so 067's keep list still covers them.
DROP POLICY IF EXISTS "venues_rule_read" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_add" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_edit" ON public.venues;
DROP POLICY IF EXISTS "venues_rule_delete" ON public.venues;

CREATE POLICY "venues_rule_read" ON public.venues
  FOR SELECT TO authenticated
  USING (public.venue_access_ok('view', added_by, city_id, brand_id));
CREATE POLICY "venues_rule_add" ON public.venues
  FOR INSERT TO authenticated
  WITH CHECK (public.venue_access_ok('add', added_by, city_id, brand_id));
CREATE POLICY "venues_rule_edit" ON public.venues
  FOR UPDATE TO authenticated
  USING (public.venue_access_ok('edit', added_by, city_id, brand_id))
  WITH CHECK (public.venue_access_ok('edit', added_by, city_id, brand_id));
CREATE POLICY "venues_rule_delete" ON public.venues
  FOR DELETE TO authenticated
  USING (public.venue_access_ok('delete', added_by, city_id, brand_id));

-- "In business" mark: needs edit on that venue (062), now city or brand.
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
    AND public.venue_access_ok('edit', added_by, city_id, brand_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venue not found';
  END IF;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Recycle bin: brands are kept and restored like cities (056) ------------------
-- 056's two functions, with venue_brands added (and venues.brand_id re-linked).
CREATE OR REPLACE FUNCTION public.recycle_bin_capture()
RETURNS TRIGGER AS $fn$
DECLARE
  r JSONB := to_jsonb(OLD);
  batch BIGINT := txid_current();
  cascaded BOOLEAN := pg_trigger_depth() > 1;
  lbl TEXT;
  ctx TEXT;
  lnk JSONB;
  person TEXT;
BEGIN
  -- department_members: only when its department goes, not on every re-pick.
  IF TG_NARGS > 0 AND TG_ARGV[0] = 'cascade_only' AND NOT cascaded THEN
    RETURN OLD;
  END IF;
  -- Deleted along with something that isn't kept (a person removed from the
  -- team, a redone check-in) — skip.
  IF cascaded AND NOT EXISTS (SELECT 1 FROM public.recycle_bin WHERE batch_id = batch) THEN
    RETURN OLD;
  END IF;

  IF r ? 'user_id' THEN
    SELECT full_name INTO person FROM public.profiles WHERE id = (r->>'user_id')::uuid;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'venue_cities' THEN
      lbl := r->>'name';
      SELECT jsonb_build_object('venues.city_id', COALESCE(jsonb_agg(id), '[]'::jsonb))
        INTO lnk FROM public.venues WHERE city_id = (r->>'id')::uuid;
    WHEN 'venue_brands' THEN
      lbl := r->>'name';
      SELECT jsonb_build_object('venues.brand_id', COALESCE(jsonb_agg(id), '[]'::jsonb))
        INTO lnk FROM public.venues WHERE brand_id = (r->>'id')::uuid;
    WHEN 'venues' THEN
      lbl := r->>'venue_name';
      ctx := concat_ws(' · ', NULLIF(r->>'location', ''), NULLIF(r->>'added_by_name', ''));
    WHEN 'accounts' THEN
      lbl := r->>'name';
      SELECT full_name INTO ctx FROM public.profiles WHERE id = (r->>'created_by')::uuid;
    WHEN 'account_transactions' THEN
      lbl := COALESCE(NULLIF(r->>'particular', ''), initcap(r->>'kind'));
      SELECT concat_ws(' · ', a.name, '₹' || (r->>'amount'), to_char((r->>'txn_date')::date, 'DD Mon YYYY'))
        INTO ctx FROM (SELECT 1) one LEFT JOIN public.accounts a ON a.id = (r->>'account_id')::uuid;
    WHEN 'lead_banquets' THEN
      lbl := r->>'name';
      SELECT jsonb_build_object('leads.banquet_id', COALESCE(jsonb_agg(id), '[]'::jsonb))
        INTO lnk FROM public.leads WHERE banquet_id = (r->>'id')::uuid;
    WHEN 'leads' THEN
      lbl := COALESCE(NULLIF(r->>'name', ''), NULLIF(r->>'contact', ''), 'Lead');
      SELECT b.name INTO ctx FROM public.lead_banquets b WHERE b.id = (r->>'banquet_id')::uuid;
    WHEN 'departments' THEN
      lbl := r->>'name';
    WHEN 'department_members' THEN
      lbl := person;
    WHEN 'employee_documents' THEN
      lbl := r->>'name';
      ctx := person;
    WHEN 'employee_details' THEN
      lbl := person;
    WHEN 'work_log_remarks' THEN
      lbl := left(r->>'body', 200);
      ctx := concat_ws(' · ', person, CASE r->>'part' WHEN 'check_out' THEN 'Check-out' ELSE 'Check-in' END);
    WHEN 'announcements' THEN
      lbl := r->>'title';
      ctx := left(r->>'body', 120);
    ELSE
      lbl := NULL;
  END CASE;

  INSERT INTO public.recycle_bin (batch_id, table_name, row_data, cascaded, label, context, links, deleted_by, deleted_by_name)
  VALUES (
    batch, TG_TABLE_NAME, r, cascaded, left(lbl, 300), left(NULLIF(ctx, ''), 300), lnk, auth.uid(),
    (SELECT full_name FROM public.profiles WHERE id = auth.uid())
  );
  RETURN OLD;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_recycle_bin ON public.venue_brands;
CREATE TRIGGER trg_recycle_bin BEFORE DELETE ON public.venue_brands
  FOR EACH ROW EXECUTE FUNCTION public.recycle_bin_capture();

CREATE OR REPLACE FUNCTION public.restore_from_bin(p_batch BIGINT)
RETURNS JSONB AS $fn$
DECLARE
  item RECORD;
  cols TEXT;
  n INT;
  restored INT := 0;
  skipped INT := 0;
  touched TEXT[] := '{}';
  t TEXT;
  ids JSONB;
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can restore' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.recycle_bin WHERE batch_id = p_batch AND restored_at IS NULL) THEN
    RAISE EXCEPTION 'This was already restored';
  END IF;

  -- Put rows back as they were: no "added by me", no "new lead", no notices.
  FOR t IN
    SELECT DISTINCT x.table_name FROM public.recycle_bin x WHERE x.batch_id = p_batch AND x.restored_at IS NULL
    UNION SELECT 'venues' WHERE EXISTS (
      SELECT 1 FROM public.recycle_bin x
      WHERE x.batch_id = p_batch AND x.table_name IN ('venue_cities', 'venue_brands')
    )
    UNION SELECT 'leads' WHERE EXISTS (SELECT 1 FROM public.recycle_bin x WHERE x.batch_id = p_batch AND x.table_name = 'lead_banquets')
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
    touched := touched || t;
  END LOOP;

  FOR item IN
    SELECT * FROM public.recycle_bin WHERE batch_id = p_batch AND restored_at IS NULL ORDER BY id
  LOOP
    -- Today's columns that the saved row has (columns added since are left to their defaults).
    SELECT string_agg(quote_ident(a.attname), ', ' ORDER BY a.attnum) INTO cols
    FROM pg_attribute a
    WHERE a.attrelid = format('public.%I', item.table_name)::regclass
      AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
      AND item.row_data ? a.attname;

    BEGIN
      EXECUTE format(
        'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1) ON CONFLICT DO NOTHING',
        item.table_name, cols
      ) USING item.row_data;
      GET DIAGNOSTICS n = ROW_COUNT;
    EXCEPTION WHEN foreign_key_violation OR check_violation OR not_null_violation THEN
      IF NOT item.cascaded THEN
        RAISE EXCEPTION 'This belonged to something that is also deleted (for example its account, city, brand or person). Restore that first.';
      END IF;
      n := 0;
    END;
    IF n > 0 THEN restored := restored + 1; ELSE skipped := skipped + 1; END IF;

    -- Re-link what pointed at it, unless it has been linked elsewhere since.
    IF item.links ? 'venues.city_id' THEN
      ids := item.links->'venues.city_id';
      UPDATE public.venues SET city_id = (item.row_data->>'id')::uuid
      WHERE city_id IS NULL AND id IN (SELECT (jsonb_array_elements_text(ids))::uuid);
    END IF;
    IF item.links ? 'venues.brand_id' THEN
      ids := item.links->'venues.brand_id';
      UPDATE public.venues SET brand_id = (item.row_data->>'id')::uuid
      WHERE brand_id IS NULL AND id IN (SELECT (jsonb_array_elements_text(ids))::uuid);
    END IF;
    IF item.links ? 'leads.banquet_id' THEN
      ids := item.links->'leads.banquet_id';
      UPDATE public.leads SET banquet_id = (item.row_data->>'id')::uuid
      WHERE banquet_id IS NULL AND id IN (SELECT (jsonb_array_elements_text(ids))::uuid);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY touched LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
  END LOOP;

  UPDATE public.recycle_bin SET restored_at = now(), restored_by = auth.uid()
  WHERE batch_id = p_batch AND restored_at IS NULL;

  RETURN jsonb_build_object('restored', restored, 'skipped', skipped);
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.restore_from_bin(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.restore_from_bin(BIGINT) TO authenticated;
