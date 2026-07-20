-- ============================================================================
-- VEBOSSO EMS — UAT: Remaining Migrations (run in SQL Editor)
-- ============================================================================
-- Run this AFTER 001 and 002 were successfully applied via CLI.
-- This covers: 003_manager_assignment_updates, 003_profile_self_read,
--              004 through 016 (all remaining).
--
-- Safe to run: all statements use IF NOT EXISTS / OR REPLACE / ON CONFLICT.
-- ============================================================================


-- ============================================================================
-- 003_manager_assignment_updates
-- ============================================================================

COMMENT ON COLUMN public.profiles.manager_id IS 'References the manager assigned to this user. Only owner can modify this field.';

CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS chk_not_self_manager;
ALTER TABLE public.profiles ADD CONSTRAINT chk_not_self_manager CHECK (manager_id IS NULL OR manager_id != id);

CREATE OR REPLACE FUNCTION public.get_manager_name(user_id UUID)
RETURNS TEXT AS $$
  SELECT full_name
  FROM public.profiles
  WHERE id = (
    SELECT manager_id FROM public.profiles WHERE id = user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.get_manager_name(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_manager_name IS 'Returns the full name of the manager assigned to a user';


-- ============================================================================
-- 003_profile_self_read
-- ============================================================================

DROP POLICY IF EXISTS "user_read_own_profile" ON public.profiles;
CREATE POLICY "user_read_own_profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());


-- ============================================================================
-- 004_app_update_system
-- ============================================================================

-- app_settings table already created in 001; just upsert the extra keys
INSERT INTO public.app_settings (key, value) VALUES
  ('latest_version', '1.0.0'),
  ('download_url',   'https://github.com/newtane/vebosso-ems/releases/latest')
ON CONFLICT (key) DO NOTHING;

-- anyone_can_read_app_settings — will be replaced by 007, safe to create
DROP POLICY IF EXISTS "anyone_can_read_app_settings" ON public.app_settings;
CREATE POLICY "anyone_can_read_app_settings" ON public.app_settings
  FOR SELECT USING (true);


-- ============================================================================
-- 005_task_completion_notes
-- ============================================================================

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_note TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON public.tasks(completed_at);


-- ============================================================================
-- 006_fix_tasks_assigned_by_cascade
-- ============================================================================

ALTER TABLE public.tasks ALTER COLUMN assigned_by DROP NOT NULL;
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_assigned_by_fkey;
ALTER TABLE public.tasks
  ADD CONSTRAINT tasks_assigned_by_fkey
  FOREIGN KEY (assigned_by) REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ============================================================================
-- 007_security_hardening
-- ============================================================================

DROP POLICY IF EXISTS "anyone_can_read_app_settings" ON public.app_settings;

DROP POLICY IF EXISTS "authenticated_can_read_app_settings" ON public.app_settings;
CREATE POLICY "authenticated_can_read_app_settings" ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role IS DISTINCT FROM 'owner' THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'SECURITY: You are not allowed to change your own role. Contact your administrator.';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'SECURITY: You are not allowed to change your account active status. Contact your administrator.';
    END IF;
    IF NEW.employee_id IS DISTINCT FROM OLD.employee_id THEN
      RAISE EXCEPTION 'SECURITY: You are not allowed to change your employee ID. Contact your administrator.';
    END IF;
    IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
      RAISE EXCEPTION 'SECURITY: You are not allowed to change the creator field.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();

COMMENT ON FUNCTION public.prevent_privilege_escalation IS
  'Security trigger: blocks non-owners from self-escalating role, toggling is_active, or changing employee_id.';

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER AS $$
DECLARE
  caller_role TEXT;
BEGIN
  SELECT role INTO caller_role FROM public.profiles WHERE id = auth.uid();

  IF caller_role = 'member' THEN
    IF NEW.check_in_approved IS DISTINCT FROM OLD.check_in_approved THEN
      RAISE EXCEPTION 'SECURITY: Members cannot approve their own check-in.';
    END IF;
    IF NEW.check_out_approved IS DISTINCT FROM OLD.check_out_approved THEN
      RAISE EXCEPTION 'SECURITY: Members cannot approve their own check-out.';
    END IF;
    IF NEW.check_in_approved_by IS DISTINCT FROM OLD.check_in_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-in approval metadata.';
    END IF;
    IF NEW.check_out_approved_by IS DISTINCT FROM OLD.check_out_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-out approval metadata.';
    END IF;
    IF NEW.check_in_approved_at IS DISTINCT FROM OLD.check_in_approved_at THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set approval timestamps.';
    END IF;
    IF NEW.status IN ('working', 'done') AND OLD.status NOT IN ('working', 'done') THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set status to approved values directly.';
    END IF;
    IF NEW.total_hours IS DISTINCT FROM OLD.total_hours THEN
      RAISE EXCEPTION 'SECURITY: Members cannot manually set total hours.';
    END IF;
    IF OLD.rejection_reason IS NOT NULL AND NEW.rejection_reason IS NULL THEN
      RAISE EXCEPTION 'SECURITY: Members cannot clear rejection reasons.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_prevent_self_approval ON public.work_logs;
CREATE TRIGGER trg_prevent_self_approval
  BEFORE UPDATE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_approval();

COMMENT ON FUNCTION public.prevent_self_approval IS
  'Security trigger: blocks members from self-approving check-ins, check-outs, or setting approval metadata on their own work logs.';

ALTER TABLE public.work_logs DROP CONSTRAINT IF EXISTS chk_total_hours_non_negative;
ALTER TABLE public.work_logs ADD CONSTRAINT chk_total_hours_non_negative
  CHECK (total_hours IS NULL OR total_hours >= 0);

ALTER TABLE public.work_logs DROP CONSTRAINT IF EXISTS chk_check_in_plan_length;
ALTER TABLE public.work_logs ADD CONSTRAINT chk_check_in_plan_length
  CHECK (check_in_plan IS NULL OR length(check_in_plan) <= 2000);

ALTER TABLE public.work_logs DROP CONSTRAINT IF EXISTS chk_day_report_length;
ALTER TABLE public.work_logs ADD CONSTRAINT chk_day_report_length
  CHECK (day_report IS NULL OR length(day_report) <= 3000);

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS chk_announcement_body_length;
ALTER TABLE public.announcements ADD CONSTRAINT chk_announcement_body_length
  CHECK (length(body) <= 2000);

ALTER TABLE public.announcements DROP CONSTRAINT IF EXISTS chk_announcement_title_length;
ALTER TABLE public.announcements ADD CONSTRAINT chk_announcement_title_length
  CHECK (length(title) <= 200);


-- ============================================================================
-- 008_fix_total_hours_security (replaces prevent_self_approval with fixed version)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.prevent_self_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'member' THEN

    IF NEW.check_in_approved_by IS DISTINCT FROM OLD.check_in_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-in approval metadata.';
    END IF;
    IF NEW.check_out_approved_by IS DISTINCT FROM OLD.check_out_approved_by THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set check-out approval metadata.';
    END IF;
    IF NEW.check_in_approved_at IS DISTINCT FROM OLD.check_in_approved_at THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set approval timestamps.';
    END IF;
    IF NEW.status IN ('working', 'done') AND OLD.status NOT IN ('working', 'done') THEN
      RAISE EXCEPTION 'SECURITY: Members cannot set status to approved values directly.';
    END IF;
    -- Allow total_hours change ONLY when check_out_time is also changing (auto-computed)
    IF NEW.total_hours IS DISTINCT FROM OLD.total_hours THEN
      IF NEW.check_out_time IS NOT DISTINCT FROM OLD.check_out_time THEN
        RAISE EXCEPTION 'SECURITY: Members cannot manually set total hours.';
      END IF;
    END IF;
    IF OLD.rejection_reason IS NOT NULL AND NEW.rejection_reason IS NULL THEN
      RAISE EXCEPTION 'SECURITY: Members cannot clear rejection reasons.';
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 009_notifications
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  data       JSONB DEFAULT '{}'::jsonb,
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_read       ON public.notifications(read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications"   ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications"   ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ============================================================================
-- 010_add_checkout_photos
-- ============================================================================

ALTER TABLE public.work_logs ADD COLUMN IF NOT EXISTS check_out_photos TEXT[] DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('checkouts', 'checkouts', false, 10485760, '{"image/jpeg","image/png","image/gif","image/webp"}')
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow users to upload checkout photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow users to read checkout photos"  ON storage.objects;

CREATE POLICY "Allow users to upload checkout photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'checkouts' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Allow users to read checkout photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'checkouts' AND (
      (storage.foldername(name))[1] = auth.uid()::text OR
      public.get_user_role() = 'manager' OR
      public.is_owner()
    )
  );


-- ============================================================================
-- 011_attendance_backfills
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.backfill_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date       DATE NOT NULL,
  allowed_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_used    BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT unique_user_date_permission UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_backfill_permissions_user      ON public.backfill_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_backfill_permissions_date      ON public.backfill_permissions(date);
CREATE INDEX IF NOT EXISTS idx_backfill_permissions_user_date ON public.backfill_permissions(user_id, date);

ALTER TABLE public.backfill_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "owner_full_access_backfills" ON public.backfill_permissions;
DROP POLICY IF EXISTS "user_read_own_backfills"     ON public.backfill_permissions;

CREATE POLICY "owner_full_access_backfills" ON public.backfill_permissions
  FOR ALL TO authenticated USING (public.is_owner());

CREATE POLICY "user_read_own_backfills" ON public.backfill_permissions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS compute_work_log_hours ON public.work_logs;
CREATE TRIGGER compute_work_log_hours
  BEFORE INSERT OR UPDATE ON public.work_logs
  FOR EACH ROW EXECUTE FUNCTION public.compute_total_hours();


-- ============================================================================
-- 011_force_logout_rpc
-- ============================================================================

CREATE OR REPLACE FUNCTION public.force_logout_user(target_user_id UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM auth.sessions      WHERE user_id::text = target_user_id::text;
  DELETE FROM auth.refresh_tokens WHERE user_id::text = target_user_id::text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 012_storage_cleanup_trigger
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_user_storage_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM storage.objects
  WHERE bucket_id = 'checkouts'
  AND (storage.foldername(name))[1] = OLD.id::text;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_delete_cleanup_storage ON public.profiles;
CREATE TRIGGER on_profile_delete_cleanup_storage
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_user_storage_on_delete();


-- ============================================================================
-- 013_announcements_permissions
-- ============================================================================

DROP POLICY IF EXISTS "manager_insert_announcements"  ON public.announcements;
DROP POLICY IF EXISTS "owner_insert_announcements"    ON public.announcements;
DROP POLICY IF EXISTS "owner_delete_announcements"    ON public.announcements;

CREATE POLICY "owner_insert_announcements" ON public.announcements
  FOR INSERT WITH CHECK (public.is_owner() AND created_by = auth.uid());

CREATE POLICY "owner_delete_announcements" ON public.announcements
  FOR DELETE USING (public.is_owner());


-- ============================================================================
-- 014_app_settings_anon_read
-- ============================================================================

DROP POLICY IF EXISTS "anon_read_version_controls" ON public.app_settings;
CREATE POLICY "anon_read_version_controls" ON public.app_settings
  FOR SELECT USING (
    auth.role() = 'anon'
    AND key IN ('latest_version', 'download_url')
  );


-- ============================================================================
-- 016_schedule_checkout_reminders_cron
-- (pg_cron may not be enabled on free-tier UAT — skip gracefully)
-- ============================================================================

DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE '⚠️  pg_cron not available on this plan — skipping cron job setup. Checkout reminders will not fire automatically on UAT.';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('daily-checkout-reminder')
    FROM cron.job WHERE jobname = 'daily-checkout-reminder';

    PERFORM cron.schedule(
      'daily-checkout-reminder',
      '0 15 * * *',
      $cron$
        SELECT net.http_post(
          url := 'https://etojpskxcygjarostjio.supabase.co/functions/v1/send-checkout-reminders',
          headers := '{"Content-Type": "application/json"}'
        );
      $cron$
    );
    RAISE NOTICE '✅ Cron job scheduled for UAT.';
  END IF;
END;
$$;


-- ============================================================================
-- Done
-- ============================================================================
DO $$ BEGIN
  RAISE NOTICE '✅ All remaining UAT migrations applied successfully.';
END $$;
