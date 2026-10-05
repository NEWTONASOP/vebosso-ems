-- ============================================================================
-- VEBOSSO EMS — Navgrah Leads: several numbers per lead (046)
-- ============================================================================
-- A lead's contact can now hold more than one number, kept together as
-- "98xxxxxxxx, 97xxxxxxxx". 40 characters (042) fit only about two, so the
-- limit goes up. Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS chk_lead_contact;
ALTER TABLE public.leads
  ADD CONSTRAINT chk_lead_contact CHECK (contact IS NULL OR length(contact) <= 300);
