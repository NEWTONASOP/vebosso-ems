-- ============================================================================
-- VEBOSSO EMS — Remove old access policies that bypass the access rules (067)
--
-- Postgres lets a row through if ANY policy allows it. 062 added the new rule
-- policies, but three older ones from 033 were never dropped:
--   bills_team_read / bills_team_add / bills_team_edit  (anyone with Bills)
-- so anyone with Bills access could still see and change EVERY bill — hidden
-- people's, other brands', trashed ones. This drops them, and to be safe drops
-- any other policy on these tables that isn't part of the access rules (e.g.
-- one added by hand in the dashboard). The owner-only policies stay.
--
-- Run after 066. Safe to run repeatedly.
-- ============================================================================

DO $do$
DECLARE
  p RECORD;
  keep TEXT[] := ARRAY[
    -- bills
    'bills_rule_read', 'bills_rule_add', 'bills_rule_edit', 'bills_rule_delete',
    -- bill history and brand settings
    'bill_edits_read',
    'bill_settings_rule_read', 'bill_settings_rule_add', 'bill_settings_rule_edit',
    -- venues and cities
    'venues_rule_read', 'venues_rule_add', 'venues_rule_edit', 'venues_rule_delete',
    'venue_cities_rule_read', 'venue_cities_rule_add',
    -- leads and banquets
    'leads_rule_read', 'leads_rule_add', 'leads_rule_edit', 'leads_rule_delete',
    'lead_banquets_rule_read', 'lead_banquets_rule_add', 'lead_banquets_rule_edit', 'lead_banquets_rule_delete',
    -- owner-only (is_owner()): harmless, and the owner removes cities this way
    'owner_all_venues', 'owner_all_venue_cities', 'owner_all_bills', 'owner_all_bill_settings'
  ];
BEGIN
  FOR p IN
    SELECT tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('bills', 'bill_edits', 'bill_settings', 'venues', 'venue_cities', 'leads', 'lead_banquets')
      AND NOT (policyname = ANY (keep))
  LOOP
    RAISE NOTICE 'Dropping old policy % on %', p.policyname, p.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END
$do$;
