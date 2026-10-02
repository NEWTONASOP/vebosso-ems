// ============================================================================
// VEBOSSO EMS — Venues
// Anyone can add a venue and read the list; only the owner can edit or delete
// (RLS, migration 024). The adder's name is filled in by the database.
// Anyone can mark a venue "in business"; only the owner can unmark it (029).
// Since 033 all of it needs Venues access; venues sit under cities, which
// anyone with access can add.
// ============================================================================

import { Venue, VenueCity, VenueContact, VenueInput } from '../types/database';
import { parseSupabaseError } from './errors';
import { sendPushNotificationToRole } from './notifications';
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

/** One person, trimmed; empty fields left out. Null when nothing was filled in. */
function cleanContact(c: VenueContact): VenueContact | null {
  const out: VenueContact = {};
  const role = opt(c.role)?.slice(0, 120);
  const name = opt(c.name)?.slice(0, 120);
  const phone = opt(c.phone)?.slice(0, 30);
  const email = opt(c.email)?.toLowerCase();
  if (role) out.role = role;
  if (name) out.name = name;
  if (phone) out.phone = phone;
  if (email) out.email = email;
  return Object.keys(out).length ? out : null;
}

/** Trim, drop empties to null, drop people with nothing filled in. */
function clean(input: VenueInput): VenueInput {
  return {
    met_on: input.met_on,
    venue_name: input.venue_name.trim(),
    location: opt(input.location),
    contacts: (input.contacts ?? []).map(cleanContact).filter((c): c is VenueContact => !!c),
    city_id: input.city_id || null,
  };
}

export const isValidEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

/**
 * Everyone met at a venue. Falls back to the single old-style person for a
 * venue saved before the list existed (or before migration 040 ran).
 */
export function venueContacts(v: Venue): VenueContact[] {
  if (Array.isArray(v.contacts) && v.contacts.length) return v.contacts;
  const legacy = cleanContact({ role: v.contact_role, name: v.contact_name, phone: v.contact_phone, email: v.contact_email });
  return legacy ? [legacy] : [];
}

/** A phone number as the dialler wants it: digits and a leading +. */
export const telUrl = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

/** One email to several people at once. */
export const mailtoUrl = (emails: string[]) => `mailto:${emails.map((e) => e.trim()).join(',')}`;

/** Owner only (RLS). Venues in it stay, with no city (ON DELETE SET NULL). */
export async function deleteCity(id: string): Promise<Result> {
  const { error } = await supabase.from('venue_cities').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}

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

export async function fetchCities(): Promise<Result<VenueCity[]>> {
  const { data, error } = await supabase.from('venue_cities').select('*').order('name', { ascending: true });
  if (error) return fail(error);
  return { success: true, data: (data || []) as VenueCity[] };
}

export async function addCity(name: string): Promise<Result<VenueCity>> {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, 80);
  if (!clean) return { success: false, error: 'Type the city name' };
  const { data, error } = await supabase.from('venue_cities').insert({ name: clean }).select().single();
  if (error) {
    const text = parseSupabaseError(error);
    return { success: false, error: /duplicate|unique/i.test(text) ? `${clean} is already on the list` : text };
  }
  return { success: true, data: data as VenueCity };
}

/** Anyone can mark; only the owner can unmark (checked by the database). */
export async function setVenueInBusiness(id: string, value: boolean): Promise<Result> {
  const { error } = await supabase.rpc('set_venue_in_business', { p_venue_id: id, p_value: value });
  if (error) return fail(error);
  return { success: true, data: undefined };
}

/** Owner only (RLS). */
export async function deleteVenue(id: string): Promise<Result> {
  const { error } = await supabase.from('venues').delete().eq('id', id);
  if (error) return fail(error);
  return { success: true, data: undefined };
}
