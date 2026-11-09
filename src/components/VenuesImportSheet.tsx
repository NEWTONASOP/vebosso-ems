// ============================================================================
// VEBOSSO EMS — Import venues from Excel / CSV
// One row per venue (see venuesFile.ts for the columns). Cities and brands are
// matched by name; ones not on the list yet are added (if this person may add
// them). Opened from a city or brand, every venue goes into it. A venue
// already on the list (same name, same city) is left out, so importing the
// same file twice doesn't double it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import type { RuleRow } from '../lib/accessRules';
import { addBrand, addCity, addVenues, fetchBrands, fetchCities } from '../lib/venues';
import type { ParsedVenue, ParsedVenueFile } from '../lib/venuesFile';
import { useAuthStore } from '../store/authStore';
import { Venue, VenueBrand, VenueCity, VenueInput } from '../types/database';
import { SheetFrame } from './SheetFrame';
// Loaded on first use: the spreadsheet code is big and slowed down app start.
const venuesFile = () => import('../lib/venuesFile');

const key = (s: string | null | undefined) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
const NOTES_SHOWN = 6;

export function VenuesImportSheet({
  cities,
  brands,
  existing,
  target,
  canAdd,
  canAddLists,
  onDismiss,
  onDone,
}: {
  cities: VenueCity[];
  brands: VenueBrand[];
  /** The venues already on the list, to leave out the same ones again. */
  existing: Venue[];
  /** Opened from this city or brand: every venue goes in here. */
  target?: { kind: 'city' | 'brand'; id: string; name: string } | null;
  /** May they add a venue in this city / brand (access rules)? */
  canAdd: (row: RuleRow) => boolean;
  /** May they add a new city or brand? */
  canAddLists: boolean;
  onDismiss: () => void;
  onDone: (message: string) => void;
}) {
  const profile = useAuthStore((s) => s.profile);
  const [file, setFile] = useState<ParsedVenueFile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'pick' | 'import' | null>(null);

  // What will happen: which venues go in, which cities / brands are new, and
  // which rows are left out (and why).
  const plan = useMemo(() => {
    if (!file) return null;
    const cityId = new Map(cities.map((c) => [key(c.name), c.id]));
    const brandId = new Map(brands.map((b) => [key(b.name), b.id]));
    const cityName = new Map(cities.map((c) => [c.id, c.name]));
    const seen = new Set(existing.map((v) => `${key(v.venue_name)}|${key(cityName.get(v.city_id ?? ''))}`));
    const newCities = new Map<string, string>();
    const newBrands = new Map<string, string>();
    const ready: ParsedVenue[] = [];
    const notes = [...file.notes];
    let already = 0;

    for (const v of file.venues) {
      const city = target?.kind === 'city' ? target.name : v.city;
      const brand = target?.kind === 'brand' ? target.name : v.brand;
      const cityNew = !!city && !cityId.has(key(city));
      const brandNew = !!brand && !brandId.has(key(brand));
      if ((cityNew || brandNew) && !canAddLists) {
        notes.push(`${v.at}: the ${cityNew ? `city “${city}”` : `brand “${brand}”`} isn’t on your list, left out`);
        continue;
      }
      // New cities / brands can only be added by people who may add anywhere.
      if (!cityNew && !brandNew && !canAdd({ target: [cityId.get(key(city)) ?? null, brandId.get(key(brand)) ?? null] })) {
        notes.push(`${v.at}: you can’t add venues ${city ? `in ${city}` : 'without a city'}, left out`);
        continue;
      }
      const k = `${key(v.venue_name)}|${key(city)}`;
      if (seen.has(k)) {
        already++;
        continue;
      }
      seen.add(k);
      if (cityNew) newCities.set(key(city), city!);
      if (brandNew) newBrands.set(key(brand), brand!);
      ready.push({ ...v, city, brand });
    }
    return { ready, newCities: [...newCities.values()], newBrands: [...newBrands.values()], notes, already };
  }, [file, cities, brands, existing, target, canAdd, canAddLists]);

  const pick = async () => {
    setError('');
    setBusy('pick');
    try {
      const res = await (await venuesFile()).pickAndParseVenuesFile();
      if (!res) return;
      if (!res.venues.length && !res.notes.length) {
        setError('No venues found. The first row should name the columns, with at least a “venue” column.');
        return;
      }
      setFile(res);
    } catch (e: any) {
      setError(e?.message || 'Could not read that file');
    } finally {
      setBusy(null);
    }
  };

  /** The id of a city / brand by name, adding it if needed. */
  const idFor = async (kind: 'city' | 'brand', name: string): Promise<string | null> => {
    const res = kind === 'city' ? await addCity(name) : await addBrand(name);
    if (res.success) return res.data.id;
    // Added by someone else in the meantime: look again.
    const again = kind === 'city' ? await fetchCities() : await fetchBrands();
    return again.success ? (again.data as { id: string; name: string }[]).find((x) => key(x.name) === key(name))?.id ?? null : null;
  };

  const run = async () => {
    if (!plan || !profile || !plan.ready.length) return;
    setError('');
    setBusy('import');
    try {
      const cityId = new Map(cities.map((c) => [key(c.name), c.id]));
      const brandId = new Map(brands.map((b) => [key(b.name), b.id]));
      for (const [kind, names, ids] of [
        ['city', plan.newCities, cityId],
        ['brand', plan.newBrands, brandId],
      ] as const) {
        for (const name of names) {
          const id = await idFor(kind, name);
          if (!id) return setError(`Couldn’t add the ${kind} ${name}`);
          ids.set(key(name), id);
        }
      }
      const inputs: VenueInput[] = plan.ready.map((v) => ({
        met_on: v.met_on,
        venue_name: v.venue_name,
        location: v.location,
        contacts: v.contacts,
        city_id: v.city ? cityId.get(key(v.city)) ?? null : null,
        brand_id: v.brand ? brandId.get(key(v.brand)) ?? null : null,
      }));
      const res = await addVenues(inputs, profile.id, profile.role === 'owner');
      if (!res.success) return setError(res.error);
      onDone(`${res.data} ${res.data === 1 ? 'venue' : 'venues'} imported`);
      onDismiss();
    } finally {
      setBusy(null);
    }
  };

  const count = plan?.ready.length ?? 0;
  const list = (names: string[]) => (names.length > 4 ? `${names.slice(0, 4).join(', ')} and ${names.length - 4} more` : names.join(', '));

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Import venues"
      subtitle={target ? `Into ${target.name}` : 'From an Excel or CSV file'}
      icon="download"
      iconColor={T.ink}
      iconBg={T.soft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {file ? (
            <Pressable
              style={[styles.primary, count === 0 && styles.primaryOff]}
              onPress={() => void run()}
              disabled={busy !== null || count === 0}
            >
              {busy === 'import' ? (
                <ActivityIndicator color={T.white} />
              ) : (
                <Text style={styles.primaryText}>
                  {count === 0 ? 'Nothing to import' : `Import ${count} ${count === 1 ? 'venue' : 'venues'}`}
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.primary} onPress={() => void pick()} disabled={busy !== null}>
              {busy === 'pick' ? <ActivityIndicator color={T.white} /> : <Text style={styles.primaryText}>Choose file</Text>}
            </Pressable>
          )}
        </View>
      }
    >
      {!file || !plan ? (
        <View style={styles.formatBox}>
          <Text style={styles.formatTitle}>The file’s columns, one row per venue</Text>
          <Text style={styles.formatCols}>date · venue · location · city · brand · role · name · phone · email</Text>
          <Text style={styles.formatHint}>
            Every row needs the venue’s name; all other columns can be left out or empty. Role, name, phone and email
            are the person you met there; for a second person add columns like “name 2”, “phone 2”. Dates like
            “7 Dec 2026” or “07-12-2026”; an empty date means today. Blank rows are skipped.
            {target
              ? ` Every venue goes into ${target.name}.`
              : canAddLists
                ? ' Cities and brands not on the list yet are added.'
                : ''}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.fileRow}>
            <Feather name="file-text" size={16} color={T.inkSoft} />
            <Text style={styles.fileName} numberOfLines={1}>
              {file.fileName}
            </Text>
            <Text style={styles.change} onPress={() => void pick()}>
              Change
            </Text>
          </View>

          <Line icon="check-circle" color={T.green} text={`${count} ${count === 1 ? 'venue' : 'venues'} to add`} />
          {plan.newCities.length ? (
            <Line icon="map-pin" color={T.blue} text={`New ${plan.newCities.length === 1 ? 'city' : 'cities'}: ${list(plan.newCities)}`} />
          ) : null}
          {plan.newBrands.length ? (
            <Line icon="award" color={T.blue} text={`New ${plan.newBrands.length === 1 ? 'brand' : 'brands'}: ${list(plan.newBrands)}`} />
          ) : null}
          {plan.already ? (
            <Line
              icon="copy"
              color={T.mute}
              text={`${plan.already} already on the list (same name and city), left out`}
            />
          ) : null}

          {plan.notes.length ? (
            <View style={styles.notesBox}>
              <Text style={styles.notesTitle}>Check these rows</Text>
              {plan.notes.slice(0, NOTES_SHOWN).map((n, i) => (
                <Text key={i} style={styles.note}>
                  {n}
                </Text>
              ))}
              {plan.notes.length > NOTES_SHOWN ? (
                <Text style={styles.note}>and {plan.notes.length - NOTES_SHOWN} more</Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </SheetFrame>
  );
}

function Line({ icon, color, text }: { icon: keyof typeof Feather.glyphMap; color: string; text: string }) {
  return (
    <View style={styles.line}>
      <Feather name={icon} size={15} color={color} style={{ marginTop: 2 }} />
      <Text style={styles.lineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  formatBox: { backgroundColor: T.soft, borderRadius: 14, padding: 14 },
  formatTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.ink },
  formatCols: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink, marginTop: 6, lineHeight: 20 },
  formatHint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 6, lineHeight: 18 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fileName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  change: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.blue },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  lineText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 14, color: T.ink, lineHeight: 20 },
  notesBox: { backgroundColor: T.soft, borderRadius: 14, padding: 12, marginTop: 10, gap: 4 },
  notesTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.ink, marginBottom: 2 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.inkSoft, lineHeight: 18 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  primary: { height: 48, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  primaryOff: { opacity: 0.5 },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
