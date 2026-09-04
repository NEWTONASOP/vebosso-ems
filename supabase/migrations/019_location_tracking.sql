-- ============================================================================
-- VEBOSSO EMS — Location Tracking (019)
-- ============================================================================
-- Two tables:
--
--   location_pings   append-only trail, one row per background fix. Drives the
--                    day map (the "Maps timeline" view).
--   member_locations one row per member, always the newest fix. The live view
--                    reads this instead of scanning the trail, and realtime
--                    pushes a single row per update.
--
-- Members write their own rows and can never write anyone else's; owners read
-- everyone, managers read their own reports. Nobody but the owner may delete,
-- so a member cannot erase their trail after the fact.
-- ============================================================================


-- ============================================================================
-- 1. Trail
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.location_pings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- The work log this fix belongs to. Tracking only runs between check-in and
  -- check-out, so every ping belongs to a day's log; kept nullable so a late
  -- ping can still land if the log row was removed.
  work_log_id UUID REFERENCES public.work_logs(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_at TIMESTAMPTZ NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  -- Metres of horizontal error reported by the OS; the map fades low-confidence
  -- fixes rather than drawing them as fact.
  accuracy DOUBLE PRECISION,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_level DOUBLE PRECISION,
  is_moving BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT location_pings_lat_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT location_pings_lng_range CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_location_pings_user_recorded
  ON public.location_pings(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_pings_user_date
  ON public.location_pings(user_id, date);
CREATE INDEX IF NOT EXISTS idx_location_pings_work_log
  ON public.location_pings(work_log_id);

-- Offline queues flush in bulk and can replay, so the same fix may be sent
-- twice. One row per user per timestamp keeps replays idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_location_pings_user_recorded
  ON public.location_pings(user_id, recorded_at);


-- ============================================================================
-- 2. Latest fix per member
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.member_locations (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  battery_level DOUBLE PRECISION,
  is_moving BOOLEAN,
  recorded_at TIMESTAMPTZ NOT NULL,
  -- False once the member checks out; the live view then shows a last-seen
  -- position rather than implying tracking is still running.
  is_tracking BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT member_locations_lat_range CHECK (latitude BETWEEN -90 AND 90),
  CONSTRAINT member_locations_lng_range CHECK (longitude BETWEEN -180 AND 180)
);

CREATE INDEX IF NOT EXISTS idx_member_locations_recorded
  ON public.member_locations(recorded_at DESC);


-- ============================================================================
-- 3. Keep the live row in step with the trail
-- ============================================================================
-- Done in the database so the client makes one write per fix, and so a stale
-- ping arriving late from an offline queue can never overwrite a newer fix.

CREATE OR REPLACE FUNCTION public.sync_member_location()
RETURNS TRIGGER AS $fn$
BEGIN
  INSERT INTO public.member_locations AS ml (
    user_id, latitude, longitude, accuracy, speed, heading,
    battery_level, is_moving, recorded_at, is_tracking, updated_at
  )
  VALUES (
    NEW.user_id, NEW.latitude, NEW.longitude, NEW.accuracy, NEW.speed,
    NEW.heading, NEW.battery_level, NEW.is_moving, NEW.recorded_at, true, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    latitude = EXCLUDED.latitude,
    longitude = EXCLUDED.longitude,
    accuracy = EXCLUDED.accuracy,
    speed = EXCLUDED.speed,
    heading = EXCLUDED.heading,
    battery_level = EXCLUDED.battery_level,
    is_moving = EXCLUDED.is_moving,
    recorded_at = EXCLUDED.recorded_at,
    is_tracking = true,
    updated_at = now()
  WHERE EXCLUDED.recorded_at > ml.recorded_at;

  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS sync_member_location ON public.location_pings;
CREATE TRIGGER sync_member_location
  AFTER INSERT ON public.location_pings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_member_location();


-- ============================================================================
-- 4. Stop the live marker when tracking ends
-- ============================================================================
-- Called by the client on check-out. A member may only end their own tracking,
-- and ending it never removes the trail.

CREATE OR REPLACE FUNCTION public.end_location_tracking()
RETURNS VOID AS $fn$
BEGIN
  UPDATE public.member_locations
  SET is_tracking = false, updated_at = now()
  WHERE user_id = auth.uid();
END;
$fn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.end_location_tracking() TO authenticated;


-- ============================================================================
-- 5. RLS
-- ============================================================================

ALTER TABLE public.location_pings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.member_locations ENABLE ROW LEVEL SECURITY;

-- Trail ----------------------------------------------------------------------

DROP POLICY IF EXISTS "owner_read_all_pings" ON public.location_pings;
CREATE POLICY "owner_read_all_pings" ON public.location_pings
  FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "read_own_or_managed_pings" ON public.location_pings;
CREATE POLICY "read_own_or_managed_pings" ON public.location_pings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager_of(user_id));

-- Insert only for yourself, and only around "now" — a member cannot fabricate a
-- past position to cover a day they were somewhere else. The lower bound still
-- allows an offline queue to flush a day later.
DROP POLICY IF EXISTS "insert_own_pings" ON public.location_pings;
CREATE POLICY "insert_own_pings" ON public.location_pings
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND recorded_at <= now() + INTERVAL '2 minutes'
    AND recorded_at >= now() - INTERVAL '24 hours'
  );

-- No UPDATE policy: a recorded position is never edited.
DROP POLICY IF EXISTS "owner_delete_pings" ON public.location_pings;
CREATE POLICY "owner_delete_pings" ON public.location_pings
  FOR DELETE TO authenticated
  USING (public.is_owner());

-- Live row -------------------------------------------------------------------

DROP POLICY IF EXISTS "owner_read_all_live" ON public.member_locations;
CREATE POLICY "owner_read_all_live" ON public.member_locations
  FOR SELECT TO authenticated
  USING (public.is_owner());

DROP POLICY IF EXISTS "read_own_or_managed_live" ON public.member_locations;
CREATE POLICY "read_own_or_managed_live" ON public.member_locations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_manager_of(user_id));

DROP POLICY IF EXISTS "owner_write_live" ON public.member_locations;
CREATE POLICY "owner_write_live" ON public.member_locations
  FOR ALL TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

-- No member-facing INSERT/UPDATE policy: the live row is maintained by the
-- trigger above, which runs as definer.


-- ============================================================================
-- 6. Realtime
-- ============================================================================

DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'member_locations'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.member_locations;
    END IF;
  END IF;
END;
$do$;

COMMENT ON TABLE public.location_pings IS
  'Background location trail, recorded only between check-in and check-out. Kept indefinitely — no automatic purge.';
COMMENT ON TABLE public.member_locations IS
  'Newest fix per member, maintained by trigger from location_pings.';
