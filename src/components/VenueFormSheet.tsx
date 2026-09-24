// ============================================================================
// VEBOSSO EMS — Venue Form Sheet
// Add a venue (anyone) or edit one (owner). Warns when a venue with the same
// name is already on the list, so two people don't pitch the same place.
// ============================================================================

import { addDays, format, isValid, parseISO } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addVenue, isValidEmail, updateVenue } from '../lib/venues';
import { useAuthStore } from '../store/authStore';
import { Venue, VenueInput } from '../types/database';
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
}

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

export function VenueFormSheet({ onDismiss, onSaved, venue, existing }: VenueFormSheetProps) {
  const profile = useAuthStore((s) => s.profile);
  const chain = useFieldChain();
  const today = KEY(new Date());
  const yesterday = KEY(addDays(new Date(), -1));

  const [form, setForm] = useState<VenueInput>({
    met_on: venue?.met_on ?? today,
    venue_name: venue?.venue_name ?? '',
    location: venue?.location ?? '',
    contact_role: venue?.contact_role ?? '',
    contact_name: venue?.contact_name ?? '',
    contact_email: venue?.contact_email ?? '',
  });
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
    const email = (form.contact_email ?? '').trim();
    if (email && !isValidEmail(email)) return setError('That email doesn’t look right');
    const parsed = parseISO(form.met_on);
    if (!isValid(parsed) || form.met_on > today) return setError('Pick a date that isn’t in the future');

    setSaving(true);
    const res = venue
      ? await updateVenue(venue.id, form)
      : await addVenue(form, profile.id, profile.role === 'owner');
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
      <Field label="Location" value={form.location ?? ''} onChange={set('location')} placeholder="Area and city" inputRef={chain.reg('location')} onNext={chain.next('contact_role')} />

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

      <Text style={[styles.group, { marginTop: 18 }]}>Person you met</Text>
      <Field label="Their role" value={form.contact_role ?? ''} onChange={set('contact_role')} placeholder="Their designation at the venue" inputRef={chain.reg('contact_role')} onNext={chain.next('contact_name')} />
      <Field label="Name" value={form.contact_name ?? ''} onChange={set('contact_name')} placeholder="Full name" inputRef={chain.reg('contact_name')} onNext={chain.next('contact_email')} />
      <Field
        label="Email"
        value={form.contact_email ?? ''}
        onChange={set('contact_email')}
        placeholder="Their email address"
        keyboardType="email-address"
        inputRef={chain.reg('contact_email')}
      />
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
  keyboardType?: 'email-address';
  inputRef?: (el: TextInput | null) => void;
  /** Where the keyboard's Next key goes. Without it the key reads Done. */
  onNext?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.mute}
        style={styles.input}
        keyboardType={keyboardType}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
        autoCorrect={keyboardType !== 'email-address'}
        maxLength={200}
        ref={inputRef}
        returnKeyType={onNext ? 'next' : 'done'}
        submitBehavior={onNext ? 'submit' : 'blurAndSubmit'}
        onSubmitEditing={onNext}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
