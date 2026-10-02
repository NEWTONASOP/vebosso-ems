// ============================================================================
// VEBOSSO EMS — Venue Form Sheet
// Add a venue (anyone with Venues access) or edit one (owner). Pick the city
// it is in, or add a new city. Warns when a venue with the same name is
// already on the list, so two people don't pitch the same place.
// ============================================================================
import { Feather } from '@expo/vector-icons';

import { addDays, format, isValid, parseISO } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { PaperOutlinedField } from './PaperOutlinedField';
import type { TextInput as RNTextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addVenue, isValidEmail, updateVenue, venueContacts } from '../lib/venues';
import { useAuthStore } from '../store/authStore';
import { Venue, VenueCity, VenueContact, VenueInput } from '../types/database';
import { DateField } from './DateTimeFields';
import { useFieldChain } from '../lib/useFieldChain';
import { SheetFrame } from './SheetFrame';

interface VenueFormSheetProps {
  onDismiss: () => void;
  onSaved: (message: string) => void;
  /** Present when editing (owner). */
  venue?: Venue | null;
  /** The current list, for the duplicate warning. */
  existing: Venue[];
  /** Cities to choose from (cities are added on the venues list). */
  cities: VenueCity[];
  /** Preselected city for a new venue (e.g. added from inside that city). */
  defaultCityId?: string | null;
}

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');
const newKey = () => Math.random().toString(36).slice(2, 10);

export function VenueFormSheet({
  onDismiss,
  onSaved,
  venue,
  existing,
  cities,
  defaultCityId = null,
}: VenueFormSheetProps) {
  const profile = useAuthStore((s) => s.profile);
  const chain = useFieldChain();
  const today = KEY(new Date());
  const yesterday = KEY(addDays(new Date(), -1));

  const [form, setForm] = useState<VenueInput>({
    met_on: venue?.met_on ?? today,
    venue_name: venue?.venue_name ?? '',
    location: venue?.location ?? '',
    contacts: [],
    city_id: venue ? venue.city_id : defaultCityId,
  });
  // Everyone met there, each with a steady key so removing one doesn't shuffle
  // the boxes. Always at least one (empty) person to fill in.
  const [people, setPeople] = useState<(VenueContact & { key: string })[]>(() => {
    const start = venue ? venueContacts(venue) : [];
    return (start.length ? start : [{}]).map((c) => ({ ...c, key: newKey() }));
  });

  const setPerson = (i: number, field: keyof VenueContact) => (value: string) => {
    setPeople((list) => list.map((p, j) => (j === i ? { ...p, [field]: value } : p)));
    if (error) setError('');
  };
  const addPerson = () => setPeople((list) => [...list, { key: newKey() }]);
  const removePerson = (i: number) =>
    setPeople((list) => (list.length === 1 ? [{ key: newKey() }] : list.filter((_, j) => j !== i)));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key: keyof VenueInput) => (value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError('');
  };

  const nameKey = form.venue_name.trim().toLowerCase();
  const duplicate = nameKey
    ? existing.find((v) => v.id !== venue?.id && v.venue_name.trim().toLowerCase() === nameKey)
    : undefined;

  const handleSave = async () => {
    if (!profile) return;
    if (!form.venue_name.trim()) return setError('Venue name is required');
    const badEmail = people.findIndex((p) => (p.email ?? '').trim() && !isValidEmail(p.email ?? ''));
    if (badEmail >= 0) {
      return setError(
        people.length > 1 ? `Person ${badEmail + 1}'s email doesn’t look right` : 'That email doesn’t look right',
      );
    }
    const parsed = parseISO(form.met_on);
    if (!isValid(parsed) || form.met_on > today) return setError('Pick a date that isn’t in the future');

    const input: VenueInput = { ...form, contacts: people.map(({ key: _key, ...c }) => c) };
    setSaving(true);
    const res = venue
      ? await updateVenue(venue.id, input)
      : await addVenue(input, profile.id, profile.role === 'owner');
    setSaving(false);

    if (res.success) {
      onSaved(venue ? 'Venue updated' : `${form.venue_name.trim()} added`);
      onDismiss();
    } else {
      setError(res.error);
    }
  };



  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={venue ? 'Edit venue' : 'Add a venue'}
      subtitle={venue ? venue.venue_name : 'A venue you met for VEBOSSO'}
      icon="map-pin"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.save} onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator color={T.white} />
            ) : (
              <Text style={styles.saveText}>{venue ? 'Save changes' : 'Add venue'}</Text>
            )}
          </Pressable>
        </View>
      }
    >
      <Text style={styles.group}>Venue</Text>
      <Field label="Venue name *" value={form.venue_name} onChange={set('venue_name')} placeholder="Hotel, banquet hall or farmhouse" inputRef={chain.reg('venue_name')} onNext={chain.next('location')} />
      {duplicate ? (
        <Text style={styles.warn}>
          Already on the list — added by {duplicate.added_by_name ?? 'someone'} on{' '}
          {format(parseISO(duplicate.met_on), 'd MMM yyyy')}.
        </Text>
      ) : null}
      <Field label="Location" value={form.location ?? ''} onChange={set('location')} placeholder="Area or address" inputRef={chain.reg('location')} onNext={chain.next('p0-role')} />

      <View style={styles.field}>
        <Text style={styles.label}>City</Text>
        <View style={styles.cities}>
          {cities.map((c) => {
            const on = form.city_id === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => setForm((f) => ({ ...f, city_id: on ? null : c.id }))}
                style={[styles.cityChip, on && styles.cityChipOn]}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
              >
                <Text style={[styles.cityText, on && styles.cityTextOn]}>{c.name}</Text>
              </Pressable>
            );
          })}
        </View>
        {cities.length === 0 ? (
          <Text style={styles.cityHint}>No cities yet — add one with “Add city” on the venues list.</Text>
        ) : null}
      </View>

      <DateField
        label="Date met"
        value={form.met_on}
        onChange={set('met_on')}
        quick={[
          { label: 'Today', value: today },
          { label: 'Yesterday', value: yesterday },
        ]}
        allow="past"
      />

      <Text style={[styles.group, { marginTop: 18 }]}>People you met</Text>
      {people.map((p, i) => {
        const last = i === people.length - 1;
        return (
          <View key={p.key} style={styles.person}>
            <View style={styles.personHead}>
              <Text style={styles.personTitle}>Person {i + 1}</Text>
              {people.length > 1 ? (
                <Pressable
                  onPress={() => removePerson(i)}
                  hitSlop={8}
                  style={styles.personRemove}
                  accessibilityLabel={`Remove person ${i + 1}`}
                >
                  <Feather name="x" size={14} color={T.coral} />
                  <Text style={styles.personRemoveText}>Remove</Text>
                </Pressable>
              ) : null}
            </View>
            <Field label="Their role" value={p.role ?? ''} onChange={setPerson(i, 'role')} placeholder="Their designation at the venue" inputRef={chain.reg(`p${i}-role`)} onNext={chain.next(`p${i}-name`)} />
            <Field label="Name" value={p.name ?? ''} onChange={setPerson(i, 'name')} placeholder="Full name" inputRef={chain.reg(`p${i}-name`)} onNext={chain.next(`p${i}-phone`)} />
            <Field
              label="Phone"
              value={p.phone ?? ''}
              onChange={setPerson(i, 'phone')}
              placeholder="Their phone number"
              keyboardType="phone-pad"
              inputRef={chain.reg(`p${i}-phone`)}
              onNext={chain.next(`p${i}-email`)}
            />
            <Field
              label="Email"
              value={p.email ?? ''}
              onChange={setPerson(i, 'email')}
              placeholder="Their email address"
              keyboardType="email-address"
              inputRef={chain.reg(`p${i}-email`)}
              onNext={last ? undefined : chain.next(`p${i + 1}-role`)}
            />
          </View>
        );
      })}
      <Pressable style={styles.addPerson} onPress={addPerson} accessibilityRole="button">
        <Feather name="user-plus" size={15} color={T.ink} />
        <Text style={styles.addPersonText}>Add another person</Text>
      </Pressable>
    </SheetFrame>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  inputRef,
  onNext,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'email-address' | 'phone-pad';
  inputRef?: (el: RNTextInput | null) => void;
  /** Where the keyboard's Next key goes. Without it the key reads Done. */
  onNext?: () => void;
}) {
  return (
    <View style={styles.field}>
      <PaperOutlinedField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType !== 'email-address'}
        maxLength={keyboardType === 'phone-pad' ? 30 : 200}
        ref={inputRef}
        returnKeyType={onNext ? 'next' : 'done'}
        submitBehavior={onNext ? 'submit' : 'blurAndSubmit'}
        onSubmitEditing={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  person: {
    borderRadius: 16,
    backgroundColor: T.soft,
    padding: 12,
    paddingBottom: 4,
    marginBottom: 10,
  },
  personHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  personTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.inkSoft },
  personRemove: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  personRemoveText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: T.coral },
  addPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: T.soft2,
    marginBottom: 8,
  },
  addPersonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  group: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  field: {
    marginBottom: 10,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
    marginBottom: 5,
  },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  cities: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cityChip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.soft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cityChipOn: { backgroundColor: T.charcoal },
  cityAdd: { backgroundColor: T.card, borderWidth: 1, borderColor: T.soft2, borderStyle: 'dashed' },
  cityText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  cityTextOn: { color: T.white },
  newCityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  cityHint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 6 },
  cityCancel: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  citySave: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  warn: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: T.amber,
    marginTop: -4,
    marginBottom: 10,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    marginBottom: 8,
  },
  save: {
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
  },
});
