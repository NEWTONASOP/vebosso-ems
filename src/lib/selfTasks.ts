// ============================================================================
// VEBOSSO EMS — Self-added tasks and task comments (072)
// An employee adds a task for themselves; it follows the normal task review
// (the owner / their manager approves or sends it back). Anyone who can see a
// task can comment on it.
// ============================================================================

import { TaskComment } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotification, sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

/** Tell the people who review this person's work: their manager, and the owner. */
export async function notifyReviewers(
  personId: string,
  title: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  try {
    const { data: person } = await supabase.from('profiles').select('manager_id').eq('id', personId).single();
    if (person?.manager_id) sendPushNotification(person.manager_id, title, body, data);
    sendPushNotificationToRole('owner', title, body, data);
  } catch {
    // A missed notification must never fail the action itself.
  }
}

/** The employee adds a task for themselves. */
export async function addMyTask(userId: string, userName: string, title: string): Promise<Result> {
  const text = title.trim();
  if (!text) return { success: false, error: 'Write the task' };
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        assigned_to: userId,
        assigned_by: userId,
        self_added: true,
        title: text.slice(0, 2000),
      })
      .select('id')
      .single();
    if (error) return fail(error);
    void notifyReviewers(userId, 'New task added 📝', `${userName} added: "${text.slice(0, 100)}"`, {
      type: 'task_self_added',
      task_id: data.id,
    });
    return { success: true, data: undefined };
  } catch (err) {
    return fail(err);
  }
}

/** Reword a task while it is still open (the database refuses it once it is in review). */
export async function editMyTask(taskId: string, title: string, description: string): Promise<Result> {
  const text = title.trim();
  if (!text) return { success: false, error: 'Write the task' };
  const { error } = await supabase
    .from('tasks')
    .update({ title: text.slice(0, 2000), description: description.trim().slice(0, 2000) || null })
    .eq('id', taskId);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Remove a task still being worked on. */
export async function deleteMyTask(taskId: string): Promise<Result> {
  const { error } = await supabase.from('tasks').delete().eq('id', taskId);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Comment counts per task, for the little badge on a card. */
export async function fetchCommentCounts(taskIds: string[]): Promise<Record<string, number>> {
  if (taskIds.length === 0) return {};
  const { data } = await supabase.from('task_comments').select('task_id').in('task_id', taskIds);
  const counts: Record<string, number> = {};
  for (const row of data || []) counts[row.task_id] = (counts[row.task_id] || 0) + 1;
  return counts;
}

export async function fetchTaskComments(taskId: string): Promise<Result<TaskComment[]>> {
  const { data, error } = await supabase
    .from('task_comments')
    .select('*, author:profiles!task_comments_author_id_fkey(full_name, avatar_url, role)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) return fail(error);
  return { success: true, data: (data || []) as unknown as TaskComment[] };
}

/** Owner / manager comments on someone's self-added task; that person is told. */
export async function addTaskComment(
  task: { id: string; title: string; assigned_to: string },
  author: { id: string; name: string },
  body: string,
): Promise<Result> {
  const text = body.trim();
  if (!text) return { success: false, error: 'Write a comment' };
  const { error } = await supabase
    .from('task_comments')
    .insert({ task_id: task.id, author_id: author.id, body: text.slice(0, 1000) });
  if (error) return fail(error);

  sendPushNotification(
    task.assigned_to,
    'New comment 💬',
    `${author.name} on "${task.title.slice(0, 60)}": ${text.slice(0, 100)}`,
    { type: 'task_comment', task_id: task.id },
  );
  return { success: true, data: undefined };
}

export async function deleteTaskComment(commentId: string): Promise<Result> {
  const { error } = await supabase.from('task_comments').delete().eq('id', commentId);
  if (error) return fail(error);
  return { success: true, data: undefined };
}
