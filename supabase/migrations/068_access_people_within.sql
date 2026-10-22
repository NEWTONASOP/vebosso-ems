-- ============================================================================
-- VEBOSSO EMS — Access: a person's row stays inside the allowed brands /
-- cities / banquets (068)
--
-- "VEBOSSO = see, Ayushi = see" gave Ayushi's bills in EVERY brand, so her
-- Navgrah bills showed although Navgrah was off. Now a 'people' rule can carry
-- where it applies:
--   within_ids      city / banquet ids   (venues, leads)
--   within_values   brand keys           (bills)
-- Empty = everywhere (no brand / city / banquet was picked). The owner's sheet
-- fills these from the brands / cities / banquets it allows.
--
-- Run after 067. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.access_rules
  ADD COLUMN IF NOT EXISTS within_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS within_values TEXT[] NOT NULL DEFAULT '{}';

-- 066's check; a 'people' rule now only reaches its people's items inside its
-- within lists (when it has any).
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
          OR (r.scope = 'own' AND (p_action = 'add' OR p_owner = auth.uid()))
          OR (r.scope = 'people' AND (
                p_action = 'add'
                OR p_owner = auth.uid()
                OR (
                  p_owner = ANY (r.scope_ids)
                  AND (
                    (cardinality(r.within_ids) = 0 AND cardinality(r.within_values) = 0)
                    OR p_target = ANY (r.within_ids)
                    OR p_value = ANY (r.within_values)
                  )
                )
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

-- Cities / banquets listed: a people rule kept within some shows only those.
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
      AND (
        r.scope IN ('all', 'own', 'brands')
        OR (r.scope = 'people' AND (cardinality(r.within_ids) = 0 OR p_id = ANY (r.within_ids)))
        OR (r.scope IN ('cities', 'banquets') AND p_id = ANY (r.scope_ids))
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_list_visible(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_list_visible(TEXT, UUID) TO authenticated;

-- Bill brand settings: a people rule kept within some brands sees only those.
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
      AND (
        r.scope IN ('all', 'own')
        OR (r.scope = 'people' AND (cardinality(r.within_values) = 0 OR p_brand = ANY (r.within_values)))
        OR (r.scope = 'brands' AND p_brand = ANY (r.scope_values))
      )
  );
$fn$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.access_brand_visible(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.access_brand_visible(TEXT) TO authenticated;
