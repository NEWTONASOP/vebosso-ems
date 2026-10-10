-- ============================================================================
-- VEBOSSO EMS — Bill videos (058)
-- ============================================================================
-- A bill can carry any number of videos. The files live in Cloudinary (not in
-- Supabase storage); the bill keeps one entry per video:
--   [{ "url": "https://res.cloudinary.com/…", "public_id": "vebosso-bills/…",
--      "name": "clip.mp4", "bytes": 12345678, "duration": 42.5 }, …]
-- The edit history (038) counts them like photos.
-- Safe to run repeatedly.
-- ============================================================================

ALTER TABLE public.bills
  ADD COLUMN IF NOT EXISTS videos JSONB NOT NULL DEFAULT '[]'::jsonb;

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

  -- Videos: how many.
  IF o -> 'videos' IS DISTINCT FROM n -> 'videos' THEN
    changes := changes || jsonb_build_array(
      jsonb_build_object(
        'field', 'videos',
        'from', to_jsonb(jsonb_array_length(coalesce(o -> 'videos', '[]'::jsonb))),
        'to', to_jsonb(jsonb_array_length(coalesce(n -> 'videos', '[]'::jsonb)))
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
