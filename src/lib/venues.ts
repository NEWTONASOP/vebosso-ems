// ============================================================================
// VEBOSSO EMS — Venues
// Anyone can add a venue and read the list; only the owner can edit or delete
// (RLS, migration 024). The adder's name is filled in by the database.
// ============================================================================

import { Venue, VenueInput } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotificationToRole } from './notifications';
import { supabase } from './supabase';

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };

const fail = (error: unknown): { success: false; error: string } => ({
  success: false,
  error: parseSupabaseError(error),
});

/** Trim, drop empties to null, lowercase the email. */
function clean(input: VenueInput): VenueInput {
  const opt = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t ? t : null;
  };
  return {
    met_on: input.met_on,
    venue_name: input.venue_name.trim(),
    location: opt(input.location),
    contact_role: opt(input.contact_role),
    contact_name: opt(input.contact_name),
    contact_email: opt(input.contact_email)?.toLowerCase() ?? null,
  };
}

export const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

export async function fetchVenues(): Promise<Result<Venue[]>> {
  const { data, error } = await supabase
    .from('venues')
    .select('*')
    .order('met_on', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return fail(error);
  return { success: true, data: (data || []) as Venue[] };
}

export async function addVenue(input: VenueInput, adderId: string, isOwner: boolean): Promise<Result> {
  const row = clean(input);
  const { error } = await supabase.from('venues').insert({ ...row, added_by: adderId });
  if (error) return fail(error);

  if (!isOwner) {
    const { data: me } = await supabase.from('profiles').select('full_name').eq('id', adderId).single();
    sendPushNotificationToRole(
      'owner',
      'New Venue 🏨',
      `${me?.full_name ?? 'Someone'} onboarded ${row.venue_name}${row.location ? `, ${row.location}` : ''}`,
      { type: 'venue_added' },
      [adderId],
    );
  }

  return { success: true, data: undefined };
}

/** Owner only (RLS). */
export async function updateVenue(id: string, input: VenueInput): Promise<Result> {
  const { error } = await supabase.from('venues').update(clean(input)).eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Owner only (RLS). */
export async function deleteVenue(id: string): Promise<Result> {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}
