// ============================================================================
// VEBOSSO EMS — TypeScript Database Types
// ============================================================================

export type UserRole = 'owner' | 'manager' | 'member';

export type WorkLogStatus = 'pending_approval' | 'working' | 'pending_checkout' | 'done' | 'rejected';

/** 'review' = finished by the assignee, waiting for the person who gave it to approve or reject. */
export type TaskStatus = 'pending' | 'in_progress' | 'review' | 'done';

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
  /** Get the 11:30 AM check-in reminder on Sundays too (default on). */
  sunday_checkin_reminder?: boolean;
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
  check_in_photos: string[] | null;
  check_out_photos: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface LocationPing {
  id: string;
  user_id: string;
  work_log_id: string | null;
  date: string;
  recorded_at: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  is_moving: boolean | null;
  created_at: string;
}

/** Newest fix per member, maintained by trigger from location_pings. */
export interface MemberLocation {
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  battery_level: number | null;
  is_moving: boolean | null;
  recorded_at: string;
  /** False once the member checked out — the marker is a last-seen position. */
  is_tracking: boolean;
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
  /** Optional voice note from whoever gave the task (voice-notes bucket). */
  voice_path?: string | null;
  voice_ms?: number | null;
  /** Why the last attempt was rejected; the task is back to pending until redone. */
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
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
  /** Filled in by the database on insert (members can't read others' profiles). */
  author_name?: string | null;
  author_role?: UserRole | null;
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

export type DocumentStatus = 'pending' | 'approved' | 'rejected';

export interface EmployeeDocument {
  id: string;
  user_id: string;
  name: string;
  /** Path inside the private `documents` bucket, "<user_id>/<file>". */
  file_path: string;
  mime_type: string | null;
  uploaded_by: string | null;
  /** Set by the database: owner uploads start approved, others pending. */
  status: DocumentStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type SalaryStatus = 'requested' | 'paid' | 'received';

export interface SalaryRequest {
  id: string;
  user_id: string;
  /** First day of the month the salary is for, "yyyy-MM-01". */
  month: string;
  status: SalaryStatus;
  requested_at: string | null;
  paid_at: string | null;
  paid_by: string | null;
  received_at: string | null;
  /** Rupees paid for this month, set by the owner when marking it paid. */
  amount: number | string | null;
  /** The day the owner says it will be paid, "yyyy-MM-dd" (041). */
  expected_on?: string | null;
  created_at: string;
  updated_at: string;
}

/** The person's monthly salary, set by the owner. */
/** One person in an employee's family (employee_details.family). */
export interface FamilyMember {
  name?: string;
  relation?: string;
  phone?: string;
  occupation?: string;
}

/** Filled in once by the person, then owner-only (migration 045). */
export interface EmployeeDetails {
  user_id: string;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  marital_status: string | null;
  phone: string | null;
  alt_phone: string | null;
  personal_email: string | null;
  current_address: string | null;
  permanent_address: string | null;
  emergency_name: string | null;
  emergency_relation: string | null;
  emergency_phone: string | null;
  family: FamilyMember[];
  joining_date: string | null;
  /** "HH:mm" */
  work_start: string | null;
  /** "HH:mm" */
  work_end: string | null;
  /** e.g. ['Sun'] */
  weekly_off: string[];
  qualification: string | null;
  experience: string | null;
  submitted_at: string;
  updated_by: string | null;
  updated_at: string;
}

export type EmployeeDetailsInput = Omit<EmployeeDetails, 'user_id' | 'submitted_at' | 'updated_by' | 'updated_at'>;

export interface SalarySetting {
  user_id: string;
  monthly_amount: number | string;
  updated_by: string | null;
  updated_at: string;
}

/** One message in the owner ↔ person chat. member_id is the non-owner side. */
export interface ChatMessage {
  id: string;
  member_id: string;
  sender_id: string | null;
  /** Text; null for a voice-only message. */
  body: string | null;
  /** Voice note (voice-notes bucket), with its length. */
  audio_path?: string | null;
  audio_ms?: number | null;
  created_at: string;
  /** When the other side read it. */
  read_at: string | null;
}

export interface Department {
  id: string;
  name: string;
  created_at: string;
}

export interface DepartmentMember {
  user_id: string;
  department_id: string;
  added_at: string;
}

export interface BossMessage {
  id: string;
  sender_id: string;
  body: string;
  status: 'open' | 'done';
  done_at: string | null;
  created_at: string;
}

export interface BossMessageWithSender extends BossMessage {
  sender: Pick<Profile, 'full_name' | 'employee_id' | 'role'>;
}

export interface Venue {
  id: string;
  /** The day the venue was met, "yyyy-MM-dd". */
  met_on: string;
  venue_name: string;
  location: string | null;
  /** Everyone met at the venue (040). The contact_* fields below mirror the first one. */
  contacts: VenueContact[];
  /** The first person met — kept in step with contacts[0] by the database. */
  contact_role: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  /** The city it is in (venue_cities); null = not set. */
  city_id: string | null;
  /** Given permission and working with VEBOSSO. Anyone marks; only the owner unmarks. */
  in_business: boolean;
  in_business_by_name: string | null;
  in_business_at: string | null;
  added_by: string | null;
  /** Filled in by the database from added_by. */
  added_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/** A banquet hall that Navgrah leads come from (042). */
export interface LeadBanquet {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

/** A Navgrah lead: someone with a function coming up at a banquet (042). */
export interface Lead {
  id: string;
  banquet_id: string | null;
  /** Date of function, "yyyy-MM-dd". */
  dof: string | null;
  name: string | null;
  /** Function type: wedding, engagement, cocktail… */
  function: string | null;
  contact: string | null;
  remarks: string | null;
  created_by: string | null;
  /** Who added it, filled in by the database (047). */
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export type LeadInput = Pick<Lead, 'banquet_id' | 'dof' | 'name' | 'function' | 'contact' | 'remarks'>;

/** One person met at a venue. */
export interface VenueContact {
  role?: string | null;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
}

export type VenueInput = Pick<Venue, 'met_on' | 'venue_name' | 'location' | 'contacts' | 'city_id'>;

/** A city venues are grouped under. Anyone with Venues access can add one. */
export interface VenueCity {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
}

export type ExpenseStatus = 'submitted' | 'paid' | 'received';

export interface ExpenseClaim {
  id: string;
  user_id: string;
  /** "yyyy-MM-dd" */
  spent_on: string;
  /** Optional when there are receipt photos. */
  description: string | null;
  /** Rupees; required. Comes back from Postgres NUMERIC as a string or number. */
  amount: number | string;
  /** Paths in the private `expenses` bucket. */
  photos: string[];
  status: ExpenseStatus;
  /** The day the owner says it will be paid, "yyyy-MM-dd" (041). */
  expected_on?: string | null;
  paid_at: string | null;
  paid_by: string | null;
  received_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  name: string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type TxnKind = 'credit' | 'debit';

export interface AccountTransaction {
  id: string;
  account_id: string;
  /** "yyyy-MM-dd" */
  txn_date: string;
  kind: TxnKind;
  /** Postgres NUMERIC — may arrive as a string. */
  amount: number | string;
  particular: string | null;
  /** Optional receipt photos — paths in the private `account-receipts` bucket. */
  receipts: string[];
  created_at: string;
  updated_at: string;
}

/** From the account_summaries() RPC. Balance = credit − debit. */
export interface AccountSummary {
  account_id: string;
  period_credit: number | string;
  period_debit: number | string;
  total_credit: number | string;
  total_debit: number | string;
  entry_count: number;
  last_txn_date: string | null;
}

export type BillKind = 'estimate' | 'client';
export type BillBrand = 'vebosso' | 'navgrah';
export type BillStatus = 'draft' | 'pending' | 'completed' | 'trash';

/** A service provided — description only; bills carry one total. */
export interface BillItem {
  description: string;
}

export interface Bill {
  id: string;
  kind: BillKind;
  /** Which brand the bill is made for — its logo, colours and details. */
  brand: BillBrand;
  status: BillStatus;
  prev_status: BillStatus | null;
  /** E-0001 / B-0001 — assigned by the database on first save. */
  number: string | null;
  /** The E- number a client bill was converted from. */
  estimate_number: string | null;
  prepared_by: string | null;
  client_name: string | null;
  venue: string | null;
  /** "yyyy-MM-dd" */
  function_date: string | null;
  guests: string | null;
  hall_floor: string | null;
  event_type: string | null;
  timing: string | null;
  phone: string | null;
  alt_phone: string | null;
  address: string | null;
  items: BillItem[];
  total: number | string | null;
  advance: number | string | null;
  balance: number | string | null;
  terms: string | null;
  images: string[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  /** Set when a saved bill is changed again; the PDF shows it as revised. */
  edited_at: string | null;
}

/** One line of a bill's history (038): who changed it, when, and what. */
export interface BillEdit {
  id: string;
  bill_id: string;
  bill_number: string | null;
  action: 'created' | 'edited';
  edited_by: string | null;
  edited_by_name: string | null;
  edited_at: string;
  changes: { field: string; from: unknown; to: unknown }[];
}

/** Everything the bill form edits. */
export type BillFields = Pick<
  Bill,
  | 'kind'
  | 'brand'
  | 'prepared_by'
  | 'client_name'
  | 'venue'
  | 'function_date'
  | 'guests'
  | 'hall_floor'
  | 'event_type'
  | 'timing'
  | 'phone'
  | 'alt_phone'
  | 'address'
  | 'items'
  | 'total'
  | 'advance'
  | 'balance'
  | 'terms'
  | 'images'
>;

export interface BillSettings {
  id: number;
  business_name: string;
  tagline: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  default_terms: string | null;
  updated_at: string;
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
  voice_path?: string | null;
  voice_ms?: number | null;
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
  check_in_photos?: string[];
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
  rejection_reason?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
}

// ============================================================================
// Joined / Enriched Types (for UI display)
// ============================================================================

export interface MemberLocationWithProfile extends MemberLocation {
  profiles: Pick<Profile, 'full_name' | 'employee_id' | 'role' | 'department'>;
}

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
