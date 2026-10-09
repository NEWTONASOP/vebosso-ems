// ============================================================================
// VEBOSSO EMS — Recycle bin (owner only, migration 056)
// Everything deleted anywhere in the app is kept here. Nothing in it can be
// deleted — only restored, exactly as it was. Bills keep their own Trash.
// ============================================================================

import { parseSupabaseError } from './errors';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

export type BinTable =
  | 'venue_cities'
  | 'venues'
  | 'accounts'
  | 'account_transactions'
  | 'lead_banquets'
  | 'leads'
  | 'departments'
  | 'department_members'
  | 'employee_documents'
  | 'employee_details'
  | 'work_log_remarks'
  | 'announcements';

/** One delete: what was deleted, and what went with it. */
export interface BinItem {
  batch: number;
  deletedAt: string;
  deletedBy: string | null;
  items: { table: BinTable; label: string | null; context: string | null }[];
  /** Deleted along with it, by kind: { account_transactions: 23 }. */
  extra: Partial<Record<BinTable, number>>;
}

export type BinGroup = 'venues' | 'accounts' | 'leads' | 'team' | 'other';

export const BIN_KINDS: Record<BinTable, { one: string; many: string; icon: string; group: BinGroup }> = {
  venue_cities: { one: 'City', many: 'cities', icon: 'map', group: 'venues' },
  venues: { one: 'Venue', many: 'venues', icon: 'map-pin', group: 'venues' },
  accounts: { one: 'Account', many: 'accounts', icon: 'book', group: 'accounts' },
  account_transactions: { one: 'Account entry', many: 'entries', icon: 'list', group: 'accounts' },
  lead_banquets: { one: 'Banquet', many: 'banquets', icon: 'home', group: 'leads' },
  leads: { one: 'Lead', many: 'leads', icon: 'phone', group: 'leads' },
  departments: { one: 'Department', many: 'departments', icon: 'users', group: 'team' },
  department_members: { one: 'Member', many: 'members', icon: 'user', group: 'team' },
  employee_documents: { one: 'Document', many: 'documents', icon: 'file-text', group: 'team' },
  employee_details: { one: 'Employee details', many: 'employee details', icon: 'user', group: 'team' },
  work_log_remarks: { one: 'Check-in remark', many: 'remarks', icon: 'message-square', group: 'other' },
  announcements: { one: 'Announcement', many: 'announcements', icon: 'bell', group: 'other' },
};

const kindOf = (table: string) =>
  BIN_KINDS[table as BinTable] ?? { one: 'Item', many: 'items', icon: 'archive', group: 'other' as BinGroup };

/** "Venue", or "12 leads" when several went at once. */
export function binKind(item: BinItem): string {
  const first = kindOf(item.items[0]?.table ?? '');
  return item.items.length > 1 ? `${item.items.length} ${first.many}` : first.one;
}

export function binTitle(item: BinItem): string {
  const first = item.items[0];
  const name = first?.label?.trim() || kindOf(first?.table ?? '').one;
  return item.items.length > 1 ? `${name} and ${item.items.length - 1} more` : name;
}

/** "with 23 entries" — what comes back along with it. */
export function binExtra(item: BinItem): string | null {
  const parts = Object.entries(item.extra)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([t, n]) => `${n} ${n === 1 ? kindOf(t).one.toLowerCase() : kindOf(t).many}`);
  return parts.length ? `with ${parts.join(', ')}` : null;
}

export const binGroup = (item: BinItem): BinGroup => kindOf(item.items[0]?.table ?? '').group;
export const binIcon = (item: BinItem): string => kindOf(item.items[0]?.table ?? '').icon;

export async function fetchBin(): Promise<Result<BinItem[]>> {
  const { data, error } = await supabase.rpc('recycle_bin_list', { p_limit: 1000 });
  if (error) return fail(error);
  return {
    success: true,
    data: ((data || []) as any[]).map((r) => ({
      batch: Number(r.batch_id),
      deletedAt: r.deleted_at,
      deletedBy: r.deleted_by_name ?? null,
      items: r.items ?? [],
      extra: r.extra ?? {},
    })),
  };
}

/** Puts it back. `restored` 0 means it (or a newer copy) was already there. */
export async function restoreFromBin(batch: number): Promise<Result<{ restored: number; skipped: number }>> {
  const { data, error } = await supabase.rpc('restore_from_bin', { p_batch: batch });
  if (error) return fail(error);
  const d = (data ?? {}) as { restored?: number; skipped?: number };
  return { success: true, data: { restored: d.restored ?? 0, skipped: d.skipped ?? 0 } };
}
