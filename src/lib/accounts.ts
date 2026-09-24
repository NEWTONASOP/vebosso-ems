// ============================================================================
// VEBOSSO EMS — Accounts ledger (owner only; RLS in migration 026)
// Balance convention everywhere: balance = credit − debit.
// ============================================================================

import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Account, AccountSummary, AccountTransaction, TxnKind } from '../types/database';
import { parseSupabaseError } from './errors';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

// ---------------------------------------------------------------------------
// Periods & money

/** null = all time; otherwise any date inside the month. */
export type Period = Date | null;

export function periodRange(period: Period): { from: string | null; to: string | null } {
  if (!period) return { from: null, to: null };
  return {
    from: format(startOfMonth(period), 'yyyy-MM-dd'),
    to: format(endOfMonth(period), 'yyyy-MM-dd'),
  };
}

export const periodLabel = (period: Period) => (period ? format(period, 'MMMM yyyy') : 'All time');

export const num = (v: number | string | null | undefined) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** "10,000" / "1,250.50" — Indian grouping, no currency sign. */
export function money(v: number | string | null | undefined): string {
  return num(v).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** "₹10,000" with a leading minus for negatives. */
export function rupees(v: number | string | null | undefined): string {
  const n = num(v);
  return `${n < 0 ? '−' : ''}₹${money(Math.abs(n))}`;
}

// ---------------------------------------------------------------------------
// Accounts

export async function fetchAccounts(): Promise<Result<Account[]>> {
  const { data, error } = await supabase.from('accounts').select('*').order('name');
  if (error) return fail(error);
  return { success: true, data: (data || []) as Account[] };
}

export async function fetchAccount(id: string): Promise<Result<Account>> {
  const { data, error } = await supabase.from('accounts').select('*').eq('id', id).single();
  if (error) return fail(error);
  return { success: true, data: data as Account };
}

export async function fetchSummaries(period: Period): Promise<Result<Record<string, AccountSummary>>> {
  const { from, to } = periodRange(period);
  const { data, error } = await supabase.rpc('account_summaries', { p_from: from, p_to: to });
  if (error) return fail(error);
  const map: Record<string, AccountSummary> = {};
  for (const row of (data || []) as AccountSummary[]) map[row.account_id] = row;
  return { success: true, data: map };
}

export async function createAccount(name: string, note?: string | null): Promise<Result<Account>> {
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name: name.trim().slice(0, 120), note: note?.trim() || null })
    .select()
    .single();
  if (error) return fail(error);
  return { success: true, data: data as Account };
}

export async function updateAccount(id: string, name: string, note?: string | null): Promise<Result> {
  const { error } = await supabase
    .from('accounts')
    .update({ name: name.trim().slice(0, 120), note: note?.trim() || null })
    .eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Deletes the account and every entry in it. */
export async function deleteAccount(id: string): Promise<Result> {
  const { error } = await supabase.from('accounts').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Entries

const PAGE = 1000;

/** Every entry for one account in the period, newest first (paged past 1000). */
export async function fetchTransactions(
  accountId: string,
  period: Period,
): Promise<Result<AccountTransaction[]>> {
  const { from, to } = periodRange(period);
  const all: AccountTransaction[] = [];
  for (let page = 0; ; page++) {
    let q = supabase
      .from('account_transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('txn_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (from) q = q.gte('txn_date', from);
    if (to) q = q.lte('txn_date', to);
    const { data, error } = await q;
    if (error) return fail(error);
    all.push(...((data || []) as AccountTransaction[]));
    if (!data || data.length < PAGE) break;
  }
  return { success: true, data: all };
}

export interface TxnInput {
  txn_date: string;
  kind: TxnKind;
  amount: number;
  particular: string | null;
}

const cleanTxn = (t: TxnInput) => ({
  txn_date: t.txn_date,
  kind: t.kind,
  amount: Math.round(t.amount * 100) / 100,
  particular: t.particular?.trim().slice(0, 500) || null,
});

export async function addTransaction(accountId: string, t: TxnInput): Promise<Result> {
  const { error } = await supabase.from('account_transactions').insert({ account_id: accountId, ...cleanTxn(t) });
  if (error) return fail(error);
  return { success: true, data: undefined };
}

export async function updateTransaction(id: string, t: TxnInput): Promise<Result> {
  const { error } = await supabase.from('account_transactions').update(cleanTxn(t)).eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

export async function deleteTransaction(id: string): Promise<Result> {
  const { error } = await supabase.from('account_transactions').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Imports: insert many entries in chunks. Returns how many were saved. */
export async function addTransactionsBulk(
  accountId: string,
  rows: TxnInput[],
  onProgress?: (done: number) => void,
): Promise<Result<number>> {
  const CHUNK = 500;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((t) => ({ account_id: accountId, ...cleanTxn(t) }));
    const { error } = await supabase.from('account_transactions').insert(batch);
    if (error) {
      return {
        success: false,
        error: `${parseSupabaseError(error)}${done ? ` (${done} entries were saved before this)` : ''}`,
      };
    }
    done += batch.length;
    onProgress?.(done);
  }
  return { success: true, data: done };
}
