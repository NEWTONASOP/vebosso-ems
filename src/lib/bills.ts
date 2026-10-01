// ============================================================================
// VEBOSSO EMS — Bills (owner, and people the owner gave Bills to; RLS 027/030)
// Estimates and client bills. A new bill is written as a draft as soon as
// anything is typed; "Save" moves it out of draft and the database gives it a
// number (E-0001 / B-0001).
// ============================================================================

import * as ImageManipulator from 'expo-image-manipulator';
import { uploadCheckoutPhoto } from '../store/workStore';
import { AppTheme as T } from '../constants/theme';
import { Bill, BillBrand, BillEdit, BillFields, BillItem, BillKind, BillSettings, BillStatus } from '../types/database';
import { BRANDS } from './billBrands';
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
  completed: 'Completed',
  trash: 'Trash',
};

export const BILL_STATUS_TONE: Record<BillStatus, { color: string; bg: string }> = {
  draft: { color: T.inkSoft, bg: T.soft },
  pending: { color: T.amber, bg: T.amberSoft },
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
// History (038)

/** Newest first. */
export async function fetchBillEdits(billId: string): Promise<Result<BillEdit[]>> {
  const { data, error } = await supabase
    .from('bill_edits')
    .select('*')
    .eq('bill_id', billId)
    .order('edited_at', { ascending: false })
    .limit(100);
  if (error) return fail(error);
  return { success: true, data: (data || []) as BillEdit[] };
}

const EDIT_FIELD_LABEL: Record<string, string> = {
  kind: 'Type',
  brand: 'Brand',
  status: 'Status',
  number: 'Bill number',
  prepared_by: 'Prepared by',
  client_name: 'Bride and Groom',
  venue: 'Venue',
  function_date: 'Function date',
  guests: 'Guests',
  hall_floor: 'Hall / floor',
  event_type: 'Event',
  timing: 'Timing',
  phone: 'Phone',
  alt_phone: 'Alternate phone',
  address: 'Address',
  total: 'Total',
  advance: 'Advance',
  balance: 'Balance',
  terms: 'Terms',
  items: 'Services',
  images: 'Photos',
};

/** One changed field as a label and readable old / new values. */
export function describeEdit(change: BillEdit['changes'][number]): { label: string; from: string; to: string } {
  const show = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return 'empty';
    if (change.field === 'total' || change.field === 'advance' || change.field === 'balance') {
      const n = Number(v);
      return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : String(v);
    }
    if (change.field === 'status') return STATUS_LABEL[v as BillStatus] ?? String(v);
    if (change.field === 'kind') return KIND_LABEL[v as BillKind] ?? String(v);
    if (change.field === 'images') return `${v} photo${Number(v) === 1 ? '' : 's'}`;
    return String(v);
  };
  return {
    label: EDIT_FIELD_LABEL[change.field] ?? change.field,
    from: show(change.from),
    to: show(change.to),
  };
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
  fields: Partial<BillFields> & { status?: BillStatus; edited_at?: string },
): Promise<Result<Bill>> {
  const { status, edited_at, ...rest } = fields;
  const { data, error } = await supabase
    .from('bills')
    .update({ ...cleanFields(rest), ...(status ? { status } : {}), ...(edited_at ? { edited_at } : {}) })
    .eq('id', id)
    .select()
    .single();
  if (error) return fail(error);
  return { success: true, data: data as Bill };
}

/**
 * Leave draft (a number is assigned) — or save changes to a saved bill, which
 * marks it as revised on the PDF.
 */
export async function saveBill(id: string, fields: Partial<BillFields>, currentStatus: BillStatus) {
  return currentStatus === 'draft'
    ? updateBill(id, { ...fields, status: 'pending' })
    : updateBill(id, { ...fields, status: currentStatus, edited_at: new Date().toISOString() });
}

export const setBillStatus = (id: string, status: BillStatus) => updateBill(id, { status });

/** Back to where it was before it was trashed. */
export const restoreBill = (b: Bill) => updateBill(b.id, { status: b.prev_status && b.prev_status !== 'trash' ? b.prev_status : 'pending' });

/** Estimate → client bill (gets a B- number; E- number kept). */
export const convertToClientBill = (id: string) => updateBill(id, { kind: 'client', status: 'pending' });

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

/** The brand's business details (bill_settings row 1 = VEBOSSO, 2 = Navgrah). */
export async function fetchBillSettings(brand: BillBrand = 'vebosso'): Promise<Result<BillSettings>> {
  const id = BRANDS[brand].settingsId;
  const { data, error } = await supabase.from('bill_settings').select('*').eq('id', id).maybeSingle();
  if (error) return fail(error);
  return {
    success: true,
    data: (data as BillSettings) ?? {
      id,
      business_name: BRANDS[brand].label,
      tagline: brand === 'navgrah' ? 'imagination to reality' : 'Venue Booking Service Solutions',
      address: null,
      phone: null,
      email: null,
      website: null,
      default_terms: null,
      updated_at: '',
    },
  };
}

export async function saveBillSettings(brand: BillBrand, s: Partial<BillSettings>): Promise<Result> {
  const clean: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(s)) {
    if (k === 'id' || k === 'updated_at') continue;
    clean[k] = typeof v === 'string' && v.trim() ? v.trim() : null;
  }
  if (!clean.business_name) clean.business_name = BRANDS[brand].label;
  const { error } = await supabase
    .from('bill_settings')
    .upsert({ id: BRANDS[brand].settingsId, ...clean, updated_at: new Date().toISOString() });
  if (error) return fail(error);
  return { success: true, data: undefined };
}
