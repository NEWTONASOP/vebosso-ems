-- ============================================================================
-- VEBOSSO EMS — Bills: brand access reaches settings and photos too (064)
--
-- 062 limited WHICH BILLS a person sees by brand. Two things around bills still
-- only checked "has any Bills access", so someone limited to Navgrah could read
-- and change VEBOSSO's business details and terms, and read or upload VEBOSSO
-- bill photos. Now:
--   bill_settings   read  → they can see bills of that brand
--                   write → they may change others' bills of that brand
--                           (an Edit rule on "everything" or on that brand)
--   bill photos     read  → they can see the bill the photo belongs to
--                   write → they may edit that bill, or it is their own draft
--
-- Run after 062 and 063. Safe to run repeatedly.
-- ============================================================================

-- Which brand a settings row is for (031): 1 = VEBOSSO, 2 = Navgrah.
CREATE OR REPLACE FUNCTION public.bill_settings_brand(p_id INT)
RETURNS TEXT AS $fn$
  SELECT CASE WHEN p_id = 2 THEN 'navgrah' ELSE 'vebosso' END;
$fn$ LANGUAGE sql IMMUTABLE;

-- Can the signed-in person see bills of this brand at all?
CREATE OR REPLACE FUNCTION public.access_brand_visible(p_brand TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = 'bills'
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (r.scope IN ('all', 'own', 'people') OR p_brand = ANY (r.scope_values))
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_brand_visible(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_brand_visible(TEXT) TO authenticated;

-- 1. Business details and terms --------------------------------------------------
DROP POLICY IF EXISTS "bill_settings_team_all" ON public.bill_settings;
DROP POLICY IF EXISTS "bill_settings_rule_read" ON public.bill_settings;
DROP POLICY IF EXISTS "bill_settings_rule_add" ON public.bill_settings;
DROP POLICY IF EXISTS "bill_settings_rule_edit" ON public.bill_settings;

CREATE POLICY "bill_settings_rule_read" ON public.bill_settings
  FOR SELECT TO authenticated
  USING (public.access_brand_visible(public.bill_settings_brand(id)));

CREATE POLICY "bill_settings_rule_add" ON public.bill_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.access_ok('bills', 'edit', NULL, NULL, public.bill_settings_brand(id)));

CREATE POLICY "bill_settings_rule_edit" ON public.bill_settings
  FOR UPDATE TO authenticated
  USING (public.access_ok('bills', 'edit', NULL, NULL, public.bill_settings_brand(id)))
  WITH CHECK (public.access_ok('bills', 'edit', NULL, NULL, public.bill_settings_brand(id)));

-- 2. Photos: img/<bill id>/<file> in the 'bills' bucket ---------------------------
DROP POLICY IF EXISTS "bills_team_all" ON storage.objects;
DROP POLICY IF EXISTS "bills_rule_read" ON storage.objects;
DROP POLICY IF EXISTS "bills_rule_add" ON storage.objects;
DROP POLICY IF EXISTS "bills_rule_edit" ON storage.objects;
DROP POLICY IF EXISTS "bills_rule_remove" ON storage.objects;

-- The bill sub-selects run with the person's own rights, so they only find
-- bills they can see.
CREATE POLICY "bills_rule_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'bills'
    AND (
      public.is_owner()
      OR EXISTS (SELECT 1 FROM public.bills b WHERE b.id::text = (storage.foldername(name))[2])
    )
  );

CREATE POLICY "bills_rule_add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'bills'
    AND (
      public.is_owner()
      OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND (
            public.access_ok('bills', 'edit', b.created_by, NULL, b.brand)
            OR (b.status = 'draft' AND b.created_by = auth.uid())
          )
      )
    )
  );

CREATE POLICY "bills_rule_edit" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'bills'
    AND (
      public.is_owner()
      OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND (
            public.access_ok('bills', 'edit', b.created_by, NULL, b.brand)
            OR (b.status = 'draft' AND b.created_by = auth.uid())
          )
      )
    )
  );

CREATE POLICY "bills_rule_remove" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'bills'
    AND (
      public.is_owner()
      OR EXISTS (
        SELECT 1 FROM public.bills b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND (
            public.access_ok('bills', 'edit', b.created_by, NULL, b.brand)
            OR (b.status = 'draft' AND b.created_by = auth.uid())
          )
      )
    )
  );
