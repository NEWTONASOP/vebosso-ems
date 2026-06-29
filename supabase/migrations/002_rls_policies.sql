-- ============================================================================
-- VEBOSSO EMS — Row Level Security Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Helper function: get current user's role
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'owner'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: check if user manages another user
CREATE OR REPLACE FUNCTION public.is_manager_of(target_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = target_user_id AND manager_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Owner can do everything
CREATE POLICY "owner_full_access_profiles" ON public.profiles
  FOR ALL USING (public.is_owner());

-- Manager can view their own profile and their team members
CREATE POLICY "manager_read_profiles" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() = 'manager' AND (
      id = auth.uid() OR manager_id = auth.uid()
    )
  );

-- Manager can update their own profile (limited fields handled in app)
CREATE POLICY "manager_update_own_profile" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role() = 'manager' AND id = auth.uid()
  );

-- Member can view their own profile
CREATE POLICY "member_read_own_profile" ON public.profiles
  FOR SELECT USING (
    public.get_user_role() = 'member' AND id = auth.uid()
  );

-- Member can update their own profile (limited fields)
CREATE POLICY "member_update_own_profile" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role() = 'member' AND id = auth.uid()
  );

-- ============================================================================
-- WORK_LOGS POLICIES
-- ============================================================================

-- Owner can do everything with work_logs
CREATE POLICY "owner_full_access_work_logs" ON public.work_logs
  FOR ALL USING (public.is_owner());

-- Manager can view work_logs for their team
CREATE POLICY "manager_read_team_work_logs" ON public.work_logs
  FOR SELECT USING (
    public.get_user_role() = 'manager' AND (
      user_id = auth.uid() OR public.is_manager_of(user_id)
    )
  );

-- Manager can update work_logs for their team (for approvals)
CREATE POLICY "manager_update_team_work_logs" ON public.work_logs
  FOR UPDATE USING (
    public.get_user_role() = 'manager' AND (
      user_id = auth.uid() OR public.is_manager_of(user_id)
    )
  );

-- Manager can insert their own work_logs
CREATE POLICY "manager_insert_own_work_logs" ON public.work_logs
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'manager' AND user_id = auth.uid()
  );

-- Member can view their own work_logs
CREATE POLICY "member_read_own_work_logs" ON public.work_logs
  FOR SELECT USING (
    public.get_user_role() = 'member' AND user_id = auth.uid()
  );

-- Member can insert their own work_logs
CREATE POLICY "member_insert_own_work_logs" ON public.work_logs
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'member' AND user_id = auth.uid()
  );

-- Member can update their own work_logs (for checkout)
CREATE POLICY "member_update_own_work_logs" ON public.work_logs
  FOR UPDATE USING (
    public.get_user_role() = 'member' AND user_id = auth.uid()
  );

-- ============================================================================
-- TASKS POLICIES
-- ============================================================================

-- Owner can do everything with tasks
CREATE POLICY "owner_full_access_tasks" ON public.tasks
  FOR ALL USING (public.is_owner());

-- Manager can manage tasks for their team
CREATE POLICY "manager_full_access_team_tasks" ON public.tasks
  FOR ALL USING (
    public.get_user_role() = 'manager' AND (
      assigned_to = auth.uid() OR 
      assigned_by = auth.uid() OR
      public.is_manager_of(assigned_to)
    )
  );

-- Member can read their own tasks
CREATE POLICY "member_read_own_tasks" ON public.tasks
  FOR SELECT USING (
    public.get_user_role() = 'member' AND assigned_to = auth.uid()
  );

-- Member can update their own tasks (status changes)
CREATE POLICY "member_update_own_tasks" ON public.tasks
  FOR UPDATE USING (
    public.get_user_role() = 'member' AND assigned_to = auth.uid()
  );

-- ============================================================================
-- ANNOUNCEMENTS POLICIES
-- ============================================================================

-- Owner can do everything with announcements
CREATE POLICY "owner_full_access_announcements" ON public.announcements
  FOR ALL USING (public.is_owner());

-- Manager can create announcements and view relevant ones
CREATE POLICY "manager_read_announcements" ON public.announcements
  FOR SELECT USING (
    public.get_user_role() = 'manager' AND (
      target_role IN ('all', 'manager') OR
      target_user_id = auth.uid() OR
      created_by = auth.uid()
    )
  );

CREATE POLICY "manager_insert_announcements" ON public.announcements
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'manager' AND created_by = auth.uid()
  );

-- Member can only view announcements targeted to them
CREATE POLICY "member_read_announcements" ON public.announcements
  FOR SELECT USING (
    public.get_user_role() = 'member' AND (
      target_role IN ('all', 'member') OR
      target_user_id = auth.uid()
    )
  );

-- ============================================================================
-- LEAVE_REQUESTS POLICIES
-- ============================================================================

-- Owner can do everything
CREATE POLICY "owner_full_access_leave_requests" ON public.leave_requests
  FOR ALL USING (public.is_owner());

-- Manager can view and update team leave requests
CREATE POLICY "manager_read_team_leaves" ON public.leave_requests
  FOR SELECT USING (
    public.get_user_role() = 'manager' AND (
      user_id = auth.uid() OR public.is_manager_of(user_id)
    )
  );

CREATE POLICY "manager_update_team_leaves" ON public.leave_requests
  FOR UPDATE USING (
    public.get_user_role() = 'manager' AND public.is_manager_of(user_id)
  );

CREATE POLICY "manager_insert_own_leaves" ON public.leave_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'manager' AND user_id = auth.uid()
  );

-- Member can view and create their own leave requests
CREATE POLICY "member_read_own_leaves" ON public.leave_requests
  FOR SELECT USING (
    public.get_user_role() = 'member' AND user_id = auth.uid()
  );

CREATE POLICY "member_insert_own_leaves" ON public.leave_requests
  FOR INSERT WITH CHECK (
    public.get_user_role() = 'member' AND user_id = auth.uid()
  );

-- ============================================================================
-- SESSIONS POLICIES
-- ============================================================================

-- Owner can do everything with sessions
CREATE POLICY "owner_full_access_sessions" ON public.sessions
  FOR ALL USING (public.is_owner());

-- Users can view and update their own sessions
CREATE POLICY "user_read_own_sessions" ON public.sessions
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_insert_own_sessions" ON public.sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_update_own_sessions" ON public.sessions
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================================
-- APP_SETTINGS POLICIES
-- ============================================================================

-- Owner can read and update all settings
CREATE POLICY "owner_full_access_settings" ON public.app_settings
  FOR ALL USING (public.is_owner());

-- Everyone else can read settings
CREATE POLICY "authenticated_read_settings" ON public.app_settings
  FOR SELECT USING (auth.role() = 'authenticated');
