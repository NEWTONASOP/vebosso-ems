-- ============================================================================
-- VEBOSSO EMS — Access rules: separate ticks for other people's items (063)
--
-- In 062 the Edit / Delete ticks applied to everything a rule let the person
-- see. Now they split in two:
--   can_edit, can_delete                 → rows the person added themselves
--   others_can_edit, others_can_delete   → rows someone else added, inside what
--                                          the rule lets them see
-- So "see everyone's, but change only my own" is one rule. Adding stays
-- can_add. Rules that already exist keep what they allowed: the new "others"
-- ticks start equal to the old ones.
--
-- Run after 062. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.access_rules
  ADD COLUMN IF NOT EXISTS others_can_edit BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS others_can_delete BOOLEAN NOT NULL DEFAULT false;

-- Carry over once: only rules that have never had the new ticks set.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.access_rules WHERE others_can_edit OR others_can_delete
  ) THEN
    UPDATE public.access_rules
    SET others_can_edit = can_edit,
        others_can_delete = can_delete
    WHERE scope <> 'own';
  END IF;
END
$do$;

-- May the signed-in person do p_action to one row? (see 062 for the arguments)
-- Edit / delete use the "own" ticks for rows they added, the "others" ticks
-- for everyone else's.
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
        OR (p_action = 'edit' AND (
              CASE WHEN p_owner = auth.uid() THEN r.can_edit ELSE r.others_can_edit END))
        OR (p_action = 'delete' AND (
              CASE WHEN p_owner = auth.uid() THEN r.can_delete ELSE r.others_can_delete END))
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

-- Cities and banquets themselves have no "added by" that matters: either kind
-- of edit / delete tick lets someone change or remove one.
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
        OR (p_action = 'edit' AND (r.can_edit OR r.others_can_edit))
        OR (p_action = 'delete' AND (r.can_delete OR r.others_can_delete))
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_list_ok(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_list_ok(TEXT, TEXT) TO authenticated;
