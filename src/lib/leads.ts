// ============================================================================
// VEBOSSO EMS — Navgrah Leads
// Leads under banquets, one shared list for the owner and everyone given
// "Navgrah Leads" (RLS, migration 042). Anyone with access can add, edit and
// delete leads and banquets.
// ============================================================================

import { format, parseISO } from 'date-fns';
import { Lead, LeadBanquet, LeadInput } from '../types/database';
import { parseSupabaseError } from './errors';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

const opt = (v: string | null | undefined) => {
  const t = (v ?? '').trim();
  return t ? t : null;
};

/**
 * Every number in a lead's contact. Several are kept together as
 * "98xxxxxxxx, 97xxxxxxxx"; imported sheets may use / ; | or a new line, or
 * just spaces between two full numbers.
 */
export function leadPhones(contact: string | null | undefined): string[] {
  return (contact ?? '').split(/[,;/|\n]+/).flatMap((part) => {
    const t = part.trim();
    if (!t) return [];
    // "98373 07364" is one number; "9837307364 9412345678" is two.
    return t.replace(/\D/g, '').length >= 20 ? t.split(/\s+/).filter(Boolean) : [t];
  });
}

/** Back into one contact string. */
export const joinPhones = (phones: string[]) =>
  phones
    .map((p) => p.trim())
    .filter(Boolean)
    .join(', ');

/** Trimmed, empties to null, lengths within the database limits. */
export function cleanLead(input: LeadInput): LeadInput {
  return {
    banquet_id: input.banquet_id || null,
    dof: input.dof || null,
    name: opt(input.name)?.slice(0, 200) ?? null,
    function: opt(input.function)?.slice(0, 120) ?? null,
    contact: opt(joinPhones(leadPhones(input.contact)))?.slice(0, 300) ?? null,
    remarks: opt(input.remarks)?.slice(0, 2000) ?? null,
  };
}

/** "7 Dec 2026" — or "" with no date. */
export const leadDate = (dof: string | null) => (dof ? format(parseISO(dof), 'd MMM yyyy') : '');

/**
 * How the lead is saved in the phone's contacts:
 * "<name> <banquet> <dof> <function>", e.g. "Deepak Royal Palace 7 Dec engagement".
 */
export function contactName(lead: Pick<Lead, 'name' | 'dof' | 'function'>, banquetName: string | null): string {
  return [opt(lead.name), opt(banquetName), lead.dof ? format(parseISO(lead.dof), 'd MMM') : null, opt(lead.function)]
    .filter(Boolean)
    .join(' ');
}

export async function fetchBanquets(): Promise<Result<LeadBanquet[]>> {
  const { data, error } = await supabase.from('lead_banquets').select('*').order('name', { ascending: true });
  if (error) return fail(error);
  return { success: true, data: (data || []) as LeadBanquet[] };
}

/** Soonest function first; leads without a date last. */
export async function fetchLeads(): Promise<Result<Lead[]>> {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .order('dof', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true });
  if (error) return fail(error);
  return { success: true, data: (data || []) as Lead[] };
}

export async function addBanquet(name: string): Promise<Result<LeadBanquet>> {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 120);
  if (!clean) return { success: false, error: 'Type the banquet name' };
  const { data, error } = await supabase.from('lead_banquets').insert({ name: clean }).select().single();
  if (error) {
    const text = parseSupabaseError(error);
    return { success: false, error: /duplicate|unique/i.test(text) ? `${clean} is already on the list` : text };
  }
  return { success: true, data: data as LeadBanquet };
}

/** Its leads stay, with no banquet (ON DELETE SET NULL). */
export async function deleteBanquet(id: string): Promise<Result> {
  const { error } = await supabase.from('lead_banquets').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

export async function addLead(input: LeadInput): Promise<Result<Lead>> {
  const { data, error } = await supabase.from('leads').insert(cleanLead(input)).select().single();
  if (error) return fail(error);
  return { success: true, data: data as Lead };
}

export async function updateLead(id: string, input: LeadInput): Promise<Result<Lead>> {
  const { data, error } = await supabase.from('leads').update(cleanLead(input)).eq('id', id).select().single();
  if (error) return fail(error);
  return { success: true, data: data as Lead };
}

/**
 * A lead has been worked on (called, WhatsApped, saved to a phone) — it stops
 * showing as new (050). Only the first time is written; failures are ignored.
 */
export async function markLeadsTouched(ids: string[]): Promise<void> {
  if (!ids.length) return;
  try {
    await supabase.from('leads').update({ touched_at: new Date().toISOString() }).in('id', ids).is('touched_at', null);
  } catch {
    // Not worth bothering anyone about.
  }
}

/** Move many leads into one banquet (null = no banquet), in chunks. Returns how many moved. */
export async function moveLeads(ids: string[], banquetId: string | null): Promise<Result<number>> {
  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK);
    const { error } = await supabase.from('leads').update({ banquet_id: banquetId }).in('id', part);
    if (error) {
      return {
        success: false,
        error: done ? `${done} moved, then: ${parseSupabaseError(error)}` : parseSupabaseError(error),
      };
    }
    done += part.length;
  }
  return { success: true, data: done };
}

export async function deleteLead(id: string): Promise<Result> {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Many at once (import), in chunks so a big file doesn't time out. */
export async function addLeads(rows: LeadInput[]): Promise<Result<number>> {
  const CHUNK = 200;
  let done = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('leads').insert(rows.slice(i, i + CHUNK).map(cleanLead));
    if (error) {
      return {
        success: false,
        error: done ? `${done} imported, then: ${parseSupabaseError(error)}` : parseSupabaseError(error),
      };
    }
    done += Math.min(CHUNK, rows.length - i);
  }
  return { success: true, data: done };
}
