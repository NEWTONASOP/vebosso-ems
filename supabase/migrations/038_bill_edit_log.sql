-- ============================================================================
-- VEBOSSO EMS — Bill edit history (038)
-- ============================================================================
-- Bills are shared by everyone given Bills, so every change to a saved bill is
-- written down: who made it, when, and what changed (old → new). The database
-- does this itself with a trigger, so it cannot be skipped by the app and
-- cannot be edited afterwards — people can read the history, nobody can change
-- or remove a line of it.
--
-- Drafts are left out (they autosave as you type). The first save out of a
-- draft is logged as "created"; every change after that is logged with its
-- fields. Services and photos are summarised (the list of services; the number
-- of photos) rather than stored in full.
-- Safe to run repeatedly.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bill_edits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- No foreign key: the history stays even if a bill is ever removed.
  bill_id UUID NOT NULL,
  bill_number TEXT,
  action TEXT NOT NULL CHECK (action IN ('created', 'edited')),
  edited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- The name at the time, so it still reads right after a person is removed.
  edited_by_name TEXT,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- [{ "field": "total", "from": 5000, "to": 6000 }, …]
  changes JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_bill_edits_bill ON public.bill_edits(bill_id, edited_at DESC);

ALTER TABLE public.bill_edits ENABLE ROW LEVEL SECURITY;

-- Read only, for everyone who can use Bills. No insert / update / delete
-- policy: only the trigger below writes.
DROP POLICY IF EXISTS "bill_edits_read" ON public.bill_edits;
CREATE POLICY "bill_edits_read" ON public.bill_edits
  FOR SELECT TO authenticated
  USING (public.can_manage_bills());

CREATE OR REPLACE FUNCTION public.bills_log_edit()
RETURNS TRIGGER AS $fn$
DECLARE
  o JSONB := to_jsonb(OLD);
  n JSONB := to_jsonb(NEW);
  f TEXT;
  changes JSONB := '[]'::jsonb;
  who TEXT;
  old_items TEXT;
  new_items TEXT;
  fields TEXT[] := ARRAY[
    'kind', 'brand', 'status', 'number', 'prepared_by', 'client_name', 'venue',
    'function_date', 'guests', 'hall_floor', 'event_type', 'timing', 'phone',
    'alt_phone', 'address', 'total', 'advance', 'balance', 'terms'
  ];
BEGIN
  -- Autosaving a draft is not an edit.
  IF OLD.status = 'draft' AND NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO who FROM public.profiles WHERE id = auth.uid();

  -- First save out of draft.
  IF OLD.status = 'draft' THEN
    INSERT INTO public.bill_edits (bill_id, bill_number, action, edited_by, edited_by_name, changes)
    VALUES (
      NEW.id, NEW.number, 'created', auth.uid(), who,
      jsonb_build_array(jsonb_build_object('field', 'number', 'from', NULL, 'to', NEW.number))
    );
    RETURN NEW;
  END IF;

  FOREACH f IN ARRAY fields LOOP
    IF o -> f IS DISTINCT FROM n -> f THEN
      changes := changes || jsonb_build_array(
        jsonb_build_object('field', f, 'from', o -> f, 'to', n -> f)
      );
    END IF;
  END LOOP;

  -- Services: the list of descriptions.
  IF o -> 'items' IS DISTINCT FROM n -> 'items' THEN
    SELECT coalesce(string_agg(e ->> 'description', ', '), '') INTO old_items
      FROM jsonb_array_elements(o -> 'items') e;
    SELECT coalesce(string_agg(e ->> 'description', ', '), '') INTO new_items
      FROM jsonb_array_elements(n -> 'items') e;
    changes := changes || jsonb_build_array(
      jsonb_build_object('field', 'items', 'from', to_jsonb(old_items), 'to', to_jsonb(new_items))
    );
  END IF;

  -- Photos: how many.
  IF o -> 'images' IS DISTINCT FROM n -> 'images' THEN
    changes := changes || jsonb_build_array(
      jsonb_build_object(
        'field', 'images',
        'from', to_jsonb(coalesce(array_length(OLD.images, 1), 0)),
        'to', to_jsonb(coalesce(array_length(NEW.images, 1), 0))
      )
    );
  END IF;

  -- Nothing a person would call a change (e.g. only the revised stamp moved).
  IF jsonb_array_length(changes) = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.bill_edits (bill_id, bill_number, action, edited_by, edited_by_name, changes)
  VALUES (NEW.id, NEW.number, 'edited', auth.uid(), who, changes);

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_bills_log_edit ON public.bills;
CREATE TRIGGER trg_bills_log_edit
  AFTER UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.bills_log_edit();
