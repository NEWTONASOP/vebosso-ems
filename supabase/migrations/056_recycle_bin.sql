-- ============================================================================
-- VEBOSSO EMS — Recycle bin (056)
-- ============================================================================
-- Whatever is deleted anywhere in the app is copied here first, as it was
-- (venues, cities, accounts and their entries, leads, banquets, departments,
-- documents, employee details, check-in remarks, announcements). Bills keep
-- their own Trash.
--
-- Only the owner sees it, and nothing in it can be deleted — only restored.
-- Restoring puts the rows back exactly as they were (same id, same "added
-- by"), with the triggers that would stamp them as new switched off.
--
-- Things deleted together (an account and its entries, a department and its
-- members) share a batch, and come back together. Rows removed because a
-- person was removed from the team are not kept (they can't come back).
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.recycle_bin (
  id BIGSERIAL PRIMARY KEY,
  -- The transaction that deleted it; one delete = one batch.
  batch_id BIGINT NOT NULL,
  table_name TEXT NOT NULL,
  row_data JSONB NOT NULL,
  -- Deleted along with something else (an account's entries).
  cascaded BOOLEAN NOT NULL DEFAULT false,
  label TEXT,
  context TEXT,
  -- Rows that pointed at it and lost the link (a city's venues), to re-link.
  links JSONB,
  deleted_by UUID,
  deleted_by_name TEXT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at TIMESTAMPTZ,
  restored_by UUID
);

CREATE INDEX IF NOT EXISTS idx_recycle_bin_batch ON public.recycle_bin(batch_id);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_open ON public.recycle_bin(deleted_at DESC) WHERE restored_at IS NULL;

ALTER TABLE public.recycle_bin ENABLE ROW LEVEL SECURITY;

-- Owner reads. No insert / update / delete policies: the trigger and the
-- restore function write it, and nobody can empty it.
DROP POLICY IF EXISTS "recycle_bin_owner_read" ON public.recycle_bin;
CREATE POLICY "recycle_bin_owner_read" ON public.recycle_bin
  FOR SELECT USING (public.is_owner());

-- ----------------------------------------------------------------------------
-- Capture
-- ----------------------------------------------------------------------------

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

DO $do$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'venue_cities', 'venues', 'accounts', 'account_transactions', 'lead_banquets', 'leads',
    'departments', 'employee_documents', 'employee_details', 'work_log_remarks', 'announcements'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_recycle_bin ON public.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_recycle_bin BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.recycle_bin_capture()',
      t
    );
  END LOOP;
END;
$do$;

DROP TRIGGER IF EXISTS trg_recycle_bin ON public.department_members;
CREATE TRIGGER trg_recycle_bin BEFORE DELETE ON public.department_members
  FOR EACH ROW EXECUTE FUNCTION public.recycle_bin_capture('cascade_only');

-- ----------------------------------------------------------------------------
-- List (owner): one item per delete, newest first
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.recycle_bin_list(p_limit INT DEFAULT 500)
RETURNS TABLE (
  batch_id BIGINT,
  deleted_at TIMESTAMPTZ,
  deleted_by_name TEXT,
  items JSONB,
  extra JSONB
) AS $fn$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Only the owner can open the recycle bin' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    b.batch_id,
    max(b.deleted_at),
    max(b.deleted_by_name),
    COALESCE(
      jsonb_agg(jsonb_build_object('table', b.table_name, 'label', b.label, 'context', b.context) ORDER BY b.id)
        FILTER (WHERE NOT b.cascaded),
      '[]'::jsonb
    ),
    COALESCE(
      (SELECT jsonb_object_agg(c.table_name, c.n) FROM (
        SELECT x.table_name, count(*) AS n FROM public.recycle_bin x
        WHERE x.batch_id = b.batch_id AND x.cascaded AND x.restored_at IS NULL GROUP BY x.table_name
      ) c),
      '{}'::jsonb
    )
  FROM public.recycle_bin b
  WHERE b.restored_at IS NULL
  GROUP BY b.batch_id
  HAVING bool_or(NOT b.cascaded)
  ORDER BY max(b.deleted_at) DESC
  LIMIT GREATEST(1, LEAST(p_limit, 2000));
END;
$fn$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ----------------------------------------------------------------------------
-- Restore (owner): the whole batch, parents first
-- ----------------------------------------------------------------------------

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
    UNION SELECT 'venues' WHERE EXISTS (SELECT 1 FROM public.recycle_bin x WHERE x.batch_id = p_batch AND x.table_name = 'venue_cities')
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
        RAISE EXCEPTION 'This belonged to something that is also deleted (for example its account, city or person). Restore that first.';
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

REVOKE ALL ON FUNCTION public.recycle_bin_list(INT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.restore_from_bin(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recycle_bin_list(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_from_bin(BIGINT) TO authenticated;
