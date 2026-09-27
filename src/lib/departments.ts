// ============================================================================
// VEBOSSO EMS — Departments
// The owner groups people into departments, one department per person
// (department_members is keyed by user). Owner only (RLS, migration 029).
// ============================================================================

import { Department, DepartmentMember } from '../types/database';
import { parseSupabaseError } from './errors';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

export interface DepartmentData {
  departments: Department[];
  /** user id → department id */
  memberOf: Record<string, string>;
}

export async function fetchDepartments(): Promise<Result<DepartmentData>> {
  const [deps, members] = await Promise.all([
    supabase.from('departments').select('*').order('name', { ascending: true }),
    supabase.from('department_members').select('*'),
  ]);
  if (deps.error) return fail(deps.error);
  if (members.error) return fail(members.error);

  const memberOf: Record<string, string> = {};
  for (const m of (members.data || []) as DepartmentMember[]) memberOf[m.user_id] = m.department_id;
  return { success: true, data: { departments: (deps.data || []) as Department[], memberOf } };
}

const nameError = (error: unknown) => {
  const text = parseSupabaseError(error);
  return /duplicate|unique/i.test(text) ? 'There is already a department with that name' : text;
};

export async function createDepartment(name: string): Promise<Result<Department>> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { success: false, error: 'Give the department a name' };
  const { data, error } = await supabase.from('departments').insert({ name: clean }).select().single();
  if (error) return { success: false, error: nameError(error) };
  return { success: true, data: data as Department };
}

export async function renameDepartment(id: string, name: string): Promise<Result> {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { success: false, error: 'Give the department a name' };
  const { error } = await supabase.from('departments').update({ name: clean }).eq('id', id);
  if (error) return { success: false, error: nameError(error) };
  return { success: true, data: undefined };
}

/** People in it become unassigned (rows cascade). */
export async function deleteDepartment(id: string): Promise<Result> {
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/**
 * Makes `userIds` exactly the department's people. Adding someone who is in
 * another department moves them here.
 */
export async function setDepartmentMembers(departmentId: string, userIds: string[]): Promise<Result> {
  const removal = supabase.from('department_members').delete().eq('department_id', departmentId);
  const { error: removeError } = userIds.length
    ? await removal.not('user_id', 'in', `(${userIds.join(',')})`)
    : await removal;
  if (removeError) return fail(removeError);

  if (userIds.length) {
    const { error } = await supabase
      .from('department_members')
      .upsert(
        userIds.map((user_id) => ({ user_id, department_id: departmentId })),
        { onConflict: 'user_id' },
      );
    if (error) return fail(error);
  }
  return { success: true, data: undefined };
}
