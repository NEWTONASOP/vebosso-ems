// ============================================================================
// VEBOSSO EMS — Remarks on a check-in / check-out (migration 053)
// The owner, or the person's manager, leaves a remark on a day's check-in or
// check-out — approved or not. The person replies once. Whoever left it (or
// any owner) can remove it. Plus the owner's private note on employee details.
// ============================================================================

import { format, parseISO } from 'date-fns';
import { parseSupabaseError } from './errors';
import { sendPushNotification } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => {
  const text = parseSupabaseError(error);
  return {
    success: false,
    error: /work_log_remarks|reply_work_log_remark|employee_owner_notes/.test(text)
      ? 'This needs a database update (053) first.'
      : text,
  };
};

export type RemarkPart = 'check_in' | 'check_out';

export interface WorkLogRemark {
  id: string;
  work_log_id: string;
  user_id: string;
  part: RemarkPart;
  body: string;
  author_id: string | null;
  author_name: string | null;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
}

/** A remark waiting for the person's reply, with its day — for their home screen. */
export interface OpenRemark extends WorkLogRemark {
  date: string | null;
}

export const PART_LABEL: Record<RemarkPart, string> = { check_in: 'check-in', check_out: 'check-out' };

export async function fetchRemarks(workLogId: string): Promise<Result<WorkLogRemark[]>> {
  const { data, error } = await supabase
    .from('work_log_remarks')
    .select('*')
    .eq('work_log_id', workLogId)
    .order('created_at', { ascending: true });
  if (error) return fail(error);
  return { success: true, data: (data || []) as WorkLogRemark[] };
}

/** Remarks on my own days that I haven't answered yet. */
export async function fetchMyOpenRemarks(userId: string): Promise<Result<OpenRemark[]>> {
  const { data, error } = await supabase
    .from('work_log_remarks')
    .select('*, work_log:work_logs(date)')
    .eq('user_id', userId)
    .is('reply', null)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) return fail(error);
  return {
    success: true,
    data: ((data || []) as any[]).map(({ work_log, ...r }) => ({ ...r, date: work_log?.date ?? null })),
  };
}

const dayLabel = (date: string | null | undefined) => (date ? format(parseISO(date), 'd MMM') : '');

/** Owner / manager: leave a remark. Tells the person. */
export async function addRemark(
  workLogId: string,
  part: RemarkPart,
  body: string,
  personId: string,
  date?: string | null,
): Promise<Result> {
  const { error } = await supabase.from('work_log_remarks').insert({ work_log_id: workLogId, part, body: body.trim() });
  if (error) return fail(error);
  const when = dayLabel(date);
  sendPushNotification(
    personId,
    `A remark on your ${PART_LABEL[part]}`,
    `${when ? `${when}: ` : ''}${body.trim()}`,
    { type: 'work_log_remark', work_log_id: workLogId },
  );
  return { success: true, data: undefined };
}

/** The person's one reply. Tells whoever left the remark. */
export async function replyToRemark(remark: WorkLogRemark, reply: string, myName?: string | null): Promise<Result> {
  const { error } = await supabase.rpc('reply_work_log_remark', { p_remark_id: remark.id, p_reply: reply.trim() });
  if (error) return fail(error);
  if (remark.author_id) {
    sendPushNotification(
      remark.author_id,
      `${myName ?? 'They'} replied to your remark`,
      reply.trim(),
      { type: 'work_log_remark_reply', work_log_id: remark.work_log_id },
    );
  }
  return { success: true, data: undefined };
}

/** Whoever left it, or an owner. */
export async function removeRemark(id: string): Promise<Result> {
  const { error } = await supabase.from('work_log_remarks').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Owner's private note on employee details

export async function fetchOwnerNote(userId: string): Promise<Result<string>> {
  const { data, error } = await supabase.from('employee_owner_notes').select('note').eq('user_id', userId).maybeSingle();
  if (error) return fail(error);
  return { success: true, data: (data?.note as string) ?? '' };
}

export async function saveOwnerNote(userId: string, note: string): Promise<Result> {
  const { error } = await supabase
    .from('employee_owner_notes')
    .upsert({ user_id: userId, note: note.trim().slice(0, 3000) }, { onConflict: 'user_id' });
  if (error) return fail(error);
  return { success: true, data: undefined };
}
