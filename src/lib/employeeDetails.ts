// ============================================================================
// VEBOSSO EMS — Employee details (migration 045)
// The person fills theirs in once; after that only the owner can change it,
// unless the person asks to edit and the owner approves — then they get one
// edit, and it locks again (049). All checked by the database.
// ============================================================================

import { EmployeeDetails, EmployeeDetailsInput, FamilyMember } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotification, sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

export const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const MARITAL = ['Single', 'Married'];
export const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−'];
export const RELATIONS = ['Father', 'Mother', 'Spouse', 'Son', 'Daughter', 'Brother', 'Sister'];

export const emptyDetails = (): EmployeeDetailsInput => ({
  date_of_birth: null,
  gender: null,
  blood_group: null,
  marital_status: null,
  phone: null,
  alt_phone: null,
  personal_email: null,
  current_address: null,
  permanent_address: null,
  emergency_name: null,
  emergency_relation: null,
  emergency_phone: null,
  family: [],
  joining_date: null,
  work_start: null,
  work_end: null,
  weekly_off: [],
  qualification: null,
  experience: null,
});

const opt = (v: string | null | undefined, max = 200) => {
  const t = (v ?? '').trim();
  return t ? t.slice(0, max) : null;
};

function cleanFamily(f: FamilyMember): FamilyMember | null {
  const out: FamilyMember = {};
  const name = opt(f.name, 120);
  const relation = opt(f.relation, 60);
  const phone = opt(f.phone, 30);
  const occupation = opt(f.occupation, 120);
  if (name) out.name = name;
  if (relation) out.relation = relation;
  if (phone) out.phone = phone;
  if (occupation) out.occupation = occupation;
  return Object.keys(out).length ? out : null;
}

/** Trimmed, empties to null, people with nothing filled in dropped. */
export function cleanDetails(d: EmployeeDetailsInput): EmployeeDetailsInput {
  return {
    date_of_birth: d.date_of_birth || null,
    gender: opt(d.gender, 30),
    blood_group: opt(d.blood_group, 10),
    marital_status: opt(d.marital_status, 30),
    phone: opt(d.phone, 30),
    alt_phone: opt(d.alt_phone, 30),
    personal_email: opt(d.personal_email, 200)?.toLowerCase() ?? null,
    current_address: opt(d.current_address, 500),
    permanent_address: opt(d.permanent_address, 500),
    emergency_name: opt(d.emergency_name, 120),
    emergency_relation: opt(d.emergency_relation, 60),
    emergency_phone: opt(d.emergency_phone, 30),
    family: (d.family ?? []).map(cleanFamily).filter((f): f is FamilyMember => !!f),
    joining_date: d.joining_date || null,
    work_start: d.work_start || null,
    work_end: d.work_end || null,
    weekly_off: WEEK_DAYS.filter((day) => (d.weekly_off ?? []).includes(day)),
    qualification: opt(d.qualification, 500),
    experience: opt(d.experience, 1000),
  };
}

/** null when nothing has been filled in yet. */
export async function fetchEmployeeDetails(userId: string): Promise<Result<EmployeeDetails | null>> {
  const { data, error } = await supabase.from('employee_details').select('*').eq('user_id', userId).maybeSingle();
  if (error) return fail(error);
  return { success: true, data: (data as EmployeeDetails) ?? null };
}

/** The person's one-time submit. Tells the owners. */
export async function submitOwnDetails(userId: string, userName: string, input: EmployeeDetailsInput): Promise<Result> {
  const { error } = await supabase.from('employee_details').insert({ user_id: userId, ...cleanDetails(input) });
  if (error) {
    const text = parseSupabaseError(error);
    return {
      success: false,
      error: /duplicate|unique/i.test(text) ? 'Your details are already saved. Ask the boss to change anything.' : text,
    };
  }
  sendPushNotificationToRole(
    'owner',
    'Employee details 🪪',
    `${userName} filled in their details`,
    { type: 'employee_details', user_id: userId },
    [userId],
  );
  return { success: true, data: undefined };
}

/** The person asks to edit their submitted details again (049). Tells the owners. */
export async function requestDetailsEdit(userId: string, userName: string): Promise<Result> {
  const { error } = await supabase.rpc('request_details_edit');
  if (error) {
    const text = parseSupabaseError(error);
    return {
      success: false,
      error: /request_details_edit/.test(text) ? 'Asking to edit needs a database update (049). Tell the boss.' : text,
    };
  }
  sendPushNotificationToRole(
    'owner',
    'Edit request 🪪',
    `${userName} wants to edit their employee details`,
    { type: 'employee_details_edit_request', user_id: userId },
    [userId],
  );
  return { success: true, data: undefined };
}

/** Owner: approve (the person can edit once) or turn down a request. */
export async function answerDetailsEdit(userId: string, approve: boolean): Promise<Result> {
  const { error } = await supabase
    .from('employee_details')
    .update({ edit_unlocked: approve, edit_requested_at: null })
    .eq('user_id', userId);
  if (error) return fail(error);
  sendPushNotification(
    userId,
    approve ? 'You can edit your details' : 'Edit request',
    approve
      ? 'The boss approved — open Profile → My details to make your changes.'
      : 'The boss kept your details as they are for now.',
    { type: 'employee_details_edit_answer' },
  );
  return { success: true, data: undefined };
}

/** The person's one approved edit; locks again once saved (049). Tells the owners. */
export async function updateOwnDetails(userId: string, userName: string, input: EmployeeDetailsInput): Promise<Result> {
  const { data, error } = await supabase
    .from('employee_details')
    .update(cleanDetails(input))
    .eq('user_id', userId)
    .select('user_id');
  if (error) return fail(error);
  if (!data?.length) return { success: false, error: 'Editing is locked again. Ask the boss to approve another edit.' };
  sendPushNotificationToRole(
    'owner',
    'Employee details 🪪',
    `${userName} updated their details`,
    { type: 'employee_details', user_id: userId },
    [userId],
  );
  return { success: true, data: undefined };
}

/** Owner only (RLS): fill in or change anyone's. */
export async function saveDetailsAsOwner(userId: string, input: EmployeeDetailsInput): Promise<Result> {
  const { error } = await supabase
    .from('employee_details')
    .upsert({ user_id: userId, ...cleanDetails(input) }, { onConflict: 'user_id' });
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Owner only (RLS): wipe them so the person can fill them in again. */
export async function clearDetails(userId: string): Promise<Result> {
  const { error } = await supabase.from('employee_details').delete().eq('user_id', userId);
  if (error) return fail(error);
  return { success: true, data: undefined };
}
