// ============================================================================
// VEBOSSO EMS — Travel expenses
// submitted → paid (owner, paid outside the app) → received (employee).
// Who may do what is enforced by RLS + a trigger (migration 025).
// ============================================================================

import { uploadCheckoutPhoto } from '../store/workStore';
import { ExpenseClaim } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotification, sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

const BUCKET = 'expenses';
export const MAX_RECEIPTS = 5;

/** "₹1,250" — or null when no amount was given. */
export function formatAmount(amount: ExpenseClaim['amount']): string | null {
  if (amount === null || amount === undefined || amount === '') return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  return `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

/** Short one-line label for notifications. */
function claimLabel(claim: Pick<ExpenseClaim, 'description' | 'amount'>): string {
  const amount = formatAmount(claim.amount);
  const text = claim.description?.trim() ? claim.description.split('\n')[0].slice(0, 60) : 'receipts';
  return amount ? `${amount} · ${text}` : text;
}

async function nameOf(userId: string): Promise<string> {
  const { data } = await supabase.from('profiles').select('full_name').eq('id', userId).single();
  return data?.full_name || 'Someone';
}

export async function fetchExpenses(userId: string): Promise<Result<ExpenseClaim[]>> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  return { success: true, data: (data || []) as ExpenseClaim[] };
}

/** Signed URLs for receipt photos, keyed by path. */
export async function signReceiptUrls(paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const out: Record<string, string> = {};
  for (const item of data || []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

export async function submitExpense(params: {
  userId: string;
  description: string;
  amount: number;
  spentOn: string;
  photoUris: string[];
}): Promise<Result> {
  const { userId, description, amount, spentOn, photoUris } = params;
  const uploaded: string[] = [];
  try {
    for (let i = 0; i < photoUris.length && i < MAX_RECEIPTS; i++) {
      const path = `${userId}/${Date.now()}_${i}.jpg`;
      await uploadCheckoutPhoto(path, photoUris[i], 'jpg', BUCKET, false, 'image/jpeg');
      uploaded.push(path);
    }

    const note = description.trim().slice(0, 2000);
    const claim = { description: note || null, amount };
    const { error } = await supabase.from('expense_claims').insert({
      user_id: userId,
      spent_on: spentOn,
      photos: uploaded,
      ...claim,
    });

    if (error) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
      return fail(error);
    }

    sendPushNotificationToRole(
      'owner',
      'Travel Expense 🧾',
      `${await nameOf(userId)} submitted: ${claimLabel(claim)}`,
      { type: 'expense_submitted', user_id: userId },
      [userId],
    );
    return { success: true, data: undefined };
  } catch (err) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    return fail(err);
  }
}

/** Owner only (RLS). */
export async function markExpensePaid(claim: ExpenseClaim, ownerId: string): Promise<Result> {
  const { error } = await supabase
    .from('expense_claims')
    .update({ status: 'paid', paid_at: new Date().toISOString(), paid_by: ownerId })
    .eq('id', claim.id);

  if (error) return fail(error);

  sendPushNotification(
    claim.user_id,
    'Expense Paid ✅',
    `${claimLabel(claim)} has been paid. Tap Received once it reaches you.`,
    { type: 'expense_paid' },
  );
  return { success: true, data: undefined };
}

export async function markExpenseReceived(claim: ExpenseClaim): Promise<Result> {
  const { error } = await supabase
    .from('expense_claims')
    .update({ status: 'received' })
    .eq('id', claim.id);

  if (error) return fail(error);

  sendPushNotificationToRole(
    'owner',
    'Expense Received 👍',
    `${await nameOf(claim.user_id)} confirmed receiving: ${claimLabel(claim)}`,
    { type: 'expense_received', user_id: claim.user_id },
    [claim.user_id],
  );
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Owner inbox

type PersonRef = { full_name: string; employee_id: string; avatar_url: string | null };
export type WaitingExpense = ExpenseClaim & { person: PersonRef | null };

/** Owner only (RLS). Claims not yet paid, oldest first. */
export async function fetchAllSubmittedExpenses(): Promise<Result<WaitingExpense[]>> {
  const { data, error } = await supabase
    .from('expense_claims')
    .select('*, person:profiles!expense_claims_user_id_fkey(full_name, employee_id, avatar_url)')
    .eq('status', 'submitted')
    .order('created_at', { ascending: true });

  if (error) return fail(error);
  return { success: true, data: (data || []) as unknown as WaitingExpense[] };
}
