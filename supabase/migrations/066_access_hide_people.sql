-- ============================================================================
-- VEBOSSO EMS — Access: hide certain people's items (066)
--
-- Rules (062–064) only ever ADD access, so "Navgrah = see" showed every
-- Navgrah bill, whoever made it. A "hide" rule takes away: it names people,
-- and nothing they added (venues / bills / leads) can be seen or touched by
-- this person — even where another rule (all, a brand, a city…) allows it.
--
--   deny = true   only with scope 'people'; its ticks are ignored
--
-- The person's own items are never hidden (they can't be in their own list).
-- Run after 065. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.access_rules
  ADD COLUMN IF NOT EXISTS deny BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.access_rules DROP CONSTRAINT IF EXISTS chk_access_deny_people;
ALTER TABLE public.access_rules
  ADD CONSTRAINT chk_access_deny_people CHECK (NOT deny OR scope = 'people');

-- A hide rule alone gives no access: only real (allow) rules count.
CREATE OR REPLACE FUNCTION public.has_active_rule(p_feature TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.access_rules r
    WHERE r.user_id = auth.uid()
      AND r.feature = p_feature
      AND NOT r.deny
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.has_active_rule(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_active_rule(TEXT) TO authenticated;

-- 063's check, plus: nothing added by a hidden person, whatever else allows it.
CREATE OR REPLACE FUNCTION public.access_ok(
  p_feature TEXT,
  p_action TEXT,
  p_owner UUID,
  p_target UUID DEFAULT NULL,
  p_value TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR (
    NOT EXISTS (
      SELECT 1
      FROM public.access_rules d
      WHERE d.user_id = auth.uid()
        AND d.feature = p_feature
        AND d.deny
        AND d.starts_at <= now()
        AND (d.expires_at IS NULL OR d.expires_at > now())
        AND p_owner = ANY (d.scope_ids)
    )
    AND EXISTS (
      SELECT 1
      FROM public.access_rules r
      JOIN public.profiles pr ON pr.id = r.user_id
      WHERE r.user_id = auth.uid()
        AND pr.is_active
        AND r.feature = p_feature
        AND NOT r.deny
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
    )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_ok(TEXT, TEXT, UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_ok(TEXT, TEXT, UUID, UUID, TEXT) TO authenticated;

-- Cities / banquets shown, and whether one can be added / changed: allow rules only.
CREATE OR REPLACE FUNCTION public.access_list_visible(p_feature TEXT, p_id UUID)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = p_feature
      AND NOT r.deny
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (r.scope IN ('all', 'own', 'people', 'brands') OR p_id = ANY (r.scope_ids))
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_list_visible(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_list_visible(TEXT, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.access_list_ok(p_feature TEXT, p_action TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = p_feature
      AND NOT r.deny
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

-- Bill brand settings (064): allow rules only.
CREATE OR REPLACE FUNCTION public.access_brand_visible(p_brand TEXT)
RETURNS BOOLEAN AS $fn$
  SELECT public.is_owner() OR EXISTS (
    SELECT 1
    FROM public.access_rules r
    JOIN public.profiles pr ON pr.id = r.user_id
    WHERE r.user_id = auth.uid()
      AND pr.is_active
      AND r.feature = 'bills'
      AND NOT r.deny
      AND r.starts_at <= now()
      AND (r.expires_at IS NULL OR r.expires_at > now())
      AND (r.scope IN ('all', 'own', 'people') OR p_brand = ANY (r.scope_values))
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_brand_visible(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_brand_visible(TEXT) TO authenticated;
