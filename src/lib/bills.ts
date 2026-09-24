// ============================================================================
// VEBOSSO EMS — Bills (owner only; RLS in migration 027)
// Estimates and client bills. A new bill is written as a draft as soon as
// anything is typed; "Save" moves it out of draft and the database gives it a
// number (E-0001 / B-0001).
// ============================================================================

import * as ImageManipulator from 'expo-image-manipulator';
import { uploadCheckoutPhoto } from '../store/workStore';
import { AppTheme as T } from '../constants/theme';
import { Bill, BillFields, BillItem, BillKind, BillSettings, BillStatus } from '../types/database';
import { num } from './accounts';
import { parseSupabaseError } from './errors';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

export const BUCKET = 'bills';

export const KIND_LABEL: Record<BillKind, string> = { estimate: 'Estimate', client: 'Client bill' };

export const STATUS_LABEL: Record<BillStatus, string> = {
  draft: 'Draft',
  pending: 'Pending',
  done: 'Done',
  completed: 'Completed',
  trash: 'Trash',
};

export const BILL_STATUS_TONE: Record<BillStatus, { color: string; bg: string }> = {
  draft: { color: T.inkSoft, bg: T.soft },
  pending: { color: T.amber, bg: T.amberSoft },
  done: { color: T.blue, bg: T.blueSoft },
  completed: { color: T.green, bg: T.greenSoft },
  trash: { color: T.coral, bg: T.coralSoft },
};

// ---------------------------------------------------------------------------
// Money

const blank = (v: unknown) => v === null || v === undefined || v === '';

/** Total, advance and balance as typed; balance falls back to total − advance when left empty. */
export function billTotals(b: Pick<Bill, 'total' | 'advance' | 'balance'>) {
  const total = num(b.total);
  const advance = num(b.advance);
  const balance = blank(b.balance) ? total - advance : num(b.balance);
  return { total, advance, balance };
}

// ---------------------------------------------------------------------------
// Read

export async function fetchBills(): Promise<Result<Bill[]>> {
  const { data, error } = await supabase.from('bills').select('*').order('updated_at', { ascending: false });
  if (error) return fail(error);
  return { success: true, data: (data || []) as Bill[] };
}

export async function fetchBill(id: string): Promise<Result<Bill>> {
  const { data, error } = await supabase.from('bills').select('*').eq('id', id).single();
  if (error) return fail(error);
  return { success: true, data: data as Bill };
}

// ---------------------------------------------------------------------------
// Write

/** Blank text → null, items trimmed, empty rows dropped. */
function cleanFields(f: Partial<BillFields>): Partial<BillFields> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    if (k === 'items') {
      out.items = ((v as BillItem[]) ?? [])
        .map((i) => ({ description: (i.description ?? '').trim() }))
        .filter((i) => i.description);
    } else if (k === 'images') {
      out.images = v;
    } else if (k === 'total' || k === 'advance' || k === 'balance') {
      out[k] = blank(v) ? null : num(v as number);
    } else if (typeof v === 'string') {
      out[k] = v.trim() ? v.trim() : null;
    } else {
      out[k] = v ?? null;
    }
  }
  return out as Partial<BillFields>;
}

/** Create a draft the first time something is typed. */
export async function createDraft(fields: Partial<BillFields>): Promise<Result<Bill>> {
  const { data, error } = await supabase
    .from('bills')
    .insert({ ...cleanFields(fields), status: 'draft' })
    .select()
    .single();
  if (error) return fail(error);
  return { success: true, data: data as Bill };
}

export async function updateBill(
  id: string,
  fields: Partial<BillFields> & { status?: BillStatus },
): Promise<Result<Bill>> {
  const { status, ...rest } = fields;
  const { data, error } = await supabase
    .from('bills')
    .update({ ...cleanFields(rest), ...(status ? { status } : {}) })
    .eq('id', id)
    .select()
    .single();
  if (error) return fail(error);
  return { success: true, data: data as Bill };
}

/** Leave draft (a number is assigned) — or just save changes to a saved bill. */
export async function saveBill(id: string, fields: Partial<BillFields>, currentStatus: BillStatus) {
  return updateBill(id, { ...fields, status: currentStatus === 'draft' ? 'pending' : currentStatus });
}

export const setBillStatus = (id: string, status: BillStatus) => updateBill(id, { status });

/** Back to where it was before it was trashed. */
export const restoreBill = (b: Bill) => updateBill(b.id, { status: b.prev_status && b.prev_status !== 'trash' ? b.prev_status : 'pending' });

/** Estimate → client bill (gets a B- number; E- number kept). */
export const convertToClientBill = (id: string) => updateBill(id, { kind: 'client', status: 'pending' });

/** For good: the row, its images and its PDF. */
export async function deleteBillForever(b: Bill): Promise<Result> {
  const { error } = await supabase.from('bills').delete().eq('id', b.id);
  if (error) return fail(error);
  const paths = [...(b.images ?? []), `pdf/${b.id}.pdf`];
  await supabase.storage.from(BUCKET).remove(paths);
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Images

/** Shrink to 1600px wide JPEG before upload so bills and PDFs stay light. */
export async function uploadBillImage(billId: string, uri: string): Promise<Result<string>> {
  try {
    const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const path = `img/${billId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.jpg`;
    await uploadCheckoutPhoto(path, small.uri, 'jpg', BUCKET, false, 'image/jpeg');
    return { success: true, data: path };
  } catch (err) {
    return fail(err);
  }
}

export async function removeBillImage(path: string) {
  await supabase.storage.from(BUCKET).remove([path]);
}

export async function signBillImages(paths: string[], seconds = 3600): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, seconds);
  const out: Record<string, string> = {};
  for (const item of data || []) if (item.path && item.signedUrl) out[item.path] = item.signedUrl;
  return out;
}

// ---------------------------------------------------------------------------
// Settings

export async function fetchBillSettings(): Promise<Result<BillSettings>> {
  const { data, error } = await supabase.from('bill_settings').select('*').eq('id', 1).maybeSingle();
  if (error) return fail(error);
  return {
    success: true,
    data: (data as BillSettings) ?? {
      id: 1,
      business_name: 'VEBOSSO',
      tagline: 'Venue Booking Service Solutions',
      address: null,
      phone: null,
      email: null,
      website: null,
      default_terms: null,
      updated_at: '',
    },
  };
}

export async function saveBillSettings(s: Partial<BillSettings>): Promise<Result> {
  const clean: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'id' || k === 'updated_at') continue;
    clean[k] = typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  if (!clean.business_name) clean.business_name = 'VEBOSSO';
  const { error } = await supabase.from('bill_settings').upsert({ id: 1, ...clean, updated_at: new Date().toISOString() });
  if (error) return fail(error);
  return { success: true, data: undefined };
}
