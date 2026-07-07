// ============================================================================
// VEBOSSO EMS — TypeScript Database Types
// ============================================================================

export type UserRole = 'owner' | 'manager' | 'member';

export type WorkLogStatus = 'pending_approval' | 'working' | 'pending_checkout' | 'done' | 'rejected';

export type TaskStatus = 'pending' | 'in_progress' | 'done';

export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export type AnnouncementTarget = 'all' | 'manager' | 'member';

// ============================================================================
// Table Row Types
// ============================================================================

export interface Profile {
  id: string;
  full_name: string;
  employee_id: string;
  role: UserRole;
  department: string | null;
  manager_id: string | null;
  avatar_url: string | null;
  is_active: boolean;
  expo_push_token: string | null;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface WorkLog {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_in_plan: string | null;
  check_in_approved: boolean;
  check_in_approved_by: string | null;
  check_in_approved_at: string | null;
  check_out_time: string | null;
  day_report: string | null;
  check_out_approved: boolean;
  check_out_approved_by: string | null;
  status: WorkLogStatus;
  rejection_reason: string | null;
  total_hours: number | null;
  check_out_photos: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface BackfillPermission {
  id: string;
  user_id: string;
  date: string;
  allowed_by: string;
  created_at: string;
  is_used: boolean;
}

export interface Task {
  id: string;
  assigned_to: string;
  assigned_by: string;
  work_log_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  due_date: string | null;
  completion_note: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  created_by: string;
  title: string;
  body: string;
  target_role: AnnouncementTarget | null;
  target_user_id: string | null;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  date: string;
  reason: string;
  status: LeaveStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  supabase_session_token: string | null;
  device_info: string | null;
  last_active: string;
  is_active: boolean;
  created_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  updated_at: string;
  updated_by: string | null;
}

export interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}


// ============================================================================
// Insert Types (fields the client sends on create)
// ============================================================================

export interface WorkLogInsert {
  user_id: string;
  date?: string;
  check_in_time: string;
  check_in_plan: string;
  status?: WorkLogStatus;
}

export interface TaskInsert {
  assigned_to: string;
  assigned_by: string;
  work_log_id?: string | null;
  title: string;
  description?: string | null;
  status?: TaskStatus;
  due_date?: string | null;
}

export interface AnnouncementInsert {
  created_by: string;
  title: string;
  body: string;
  target_role?: AnnouncementTarget | null;
  target_user_id?: string | null;
}

export interface LeaveRequestInsert {
  user_id: string;
  date: string;
  reason: string;
}

// ============================================================================
// Update Types (partial updates)
// ============================================================================

export interface WorkLogUpdate {
  check_in_approved?: boolean;
  check_in_approved_by?: string;
  check_in_approved_at?: string;
  check_out_time?: string;
  day_report?: string;
  check_out_approved?: boolean;
  check_out_approved_by?: string;
  status?: WorkLogStatus;
  rejection_reason?: string;
  total_hours?: number;
  check_out_photos?: string[];
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  status?: TaskStatus;
  due_date?: string | null;
  assigned_to?: string;
  completion_note?: string | null;
  completed_at?: string | null;
}

// ============================================================================
// Joined / Enriched Types (for UI display)
// ============================================================================

export interface WorkLogWithProfile extends WorkLog {
  profiles: Pick<Profile, 'full_name' | 'employee_id' | 'avatar_url' | 'department' | 'role'>;
}

export interface TaskWithProfiles extends Task {
  assigned_to_profile: Pick<Profile, 'full_name' | 'employee_id'>;
  assigned_by_profile: Pick<Profile, 'full_name' | 'employee_id'>;
}

export interface AnnouncementWithCreator extends Announcement {
  creator: Pick<Profile, 'full_name' | 'role'>;
}

export interface LeaveRequestWithProfile extends LeaveRequest {
  profiles: Pick<Profile, 'full_name' | 'employee_id' | 'department' | 'role'>;
}

export interface SessionWithProfile extends Session {
  profiles: Pick<Profile, 'full_name' | 'employee_id'>;
}

// ============================================================================
// Supabase Database Type (for createClient<Database>)
// ============================================================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'created_at' | 'updated_at'>>;
      };
      work_logs: {
        Row: WorkLog;
        Insert: WorkLogInsert;
        Update: WorkLogUpdate;
      };
      tasks: {
        Row: Task;
        Insert: TaskInsert;
        Update: TaskUpdate;
      };
      announcements: {
        Row: Announcement;
        Insert: AnnouncementInsert;
        Update: Partial<AnnouncementInsert>;
      };
      leave_requests: {
        Row: LeaveRequest;
        Insert: LeaveRequestInsert;
        Update: Partial<LeaveRequest>;
      };
      sessions: {
        Row: Session;
        Insert: Omit<Session, 'id' | 'created_at'>;
        Update: Partial<Omit<Session, 'id' | 'created_at'>>;
      };
      app_settings: {
        Row: AppSetting;
        Insert: Omit<AppSetting, 'updated_at'>;
        Update: Partial<Omit<AppSetting, 'key'>>;
      };
      notifications: {
        Row: DbNotification;
        Insert: Omit<DbNotification, 'id' | 'created_at'>;
        Update: Partial<Omit<DbNotification, 'id' | 'user_id' | 'created_at'>>;
      };
    };
  };
}
