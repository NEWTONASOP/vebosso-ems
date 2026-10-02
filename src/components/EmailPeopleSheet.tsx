// ============================================================================
// VEBOSSO EMS — Email people met at venues
// Everyone with an email, venue by venue, with tick boxes. Tick who to write
// to (or "Select all") and "Write email" opens one email to all of them.
// Uses the venues currently shown, so a search on the list narrows this too.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { mailtoUrl, venueContacts } from '../lib/venues';
import { Venue } from '../types/database';
import { SheetFrame } from './SheetFrame';

type Row = { key: string; email: string; name: string | null; role: string | null };

export function EmailPeopleSheet({
  venues,
  searching,
  onDismiss,
  onMessage,
}: {
  venues: Venue[];
  /** The venues list is filtered by a search. */
  searching: boolean;
  onDismiss: () => void;
  onMessage: (message: string) => void;
}) {
  // Venue by venue, only people with an email.
  const groups = useMemo(
    () =>
      venues
        .map((v) => ({
          venue: v,
          people: venueContacts(v)
            .filter((c) => (c.email ?? '').trim())
            .map(
              (c, i): Row => ({
                key: `${v.id}-${i}`,
                email: (c.email ?? '').trim().toLowerCase(),
                name: c.name ?? null,
                role: c.role ?? null,
              }),
            ),
        }))
        .filter((g) => g.people.length > 0),
    [venues],
  );

  const allEmails = useMemo(
    () => [...new Set(groups.flatMap((g) => g.people.map((p) => p.email)))],
    [groups],
  );

  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const allPicked = allEmails.length > 0 && allEmails.every((e) => picked.has(e));

  const toggle = (email: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });

  const write = () => {
    if (!picked.size) return;
    Linking.openURL(mailtoUrl([...picked])).catch(() => onMessage('Could not open an email app'));
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Email people"
      subtitle={searching ? 'From the venues in your search' : 'Tick who to write to'}
      icon="mail"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={
        <Pressable
          style={[styles.write, !picked.size && styles.writeOff]}
          onPress={write}
          disabled={!picked.size}
          accessibilityRole="button"
        >
          <Feather name="send" size={16} color={T.white} />
          <Text style={styles.writeText}>
            {picked.size
              ? `Write email to ${picked.size} ${picked.size === 1 ? 'person' : 'people'}`
              : 'Tick people to write to'}
          </Text>
        </Pressable>
      }
    >
      {groups.length === 0 ? (
        <Text style={styles.empty}>
          {searching ? 'No one with an email in these venues.' : 'No one with an email yet.'}
        </Text>
      ) : (
        <>
          <Pressable
            style={styles.selectAll}
            onPress={() => setPicked(allPicked ? new Set() : new Set(allEmails))}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: allPicked }}
          >
            <Feather name={allPicked ? 'check-square' : 'square'} size={20} color={allPicked ? T.blue : T.mute} />
            <Text style={styles.selectAllText}>
              {allPicked ? 'Clear all' : `Select all (${allEmails.length})`}
            </Text>
          </Pressable>

          {groups.map((g) => (
            <View key={g.venue.id} style={styles.group}>
              <Text style={styles.venue} numberOfLines={1}>
                {g.venue.venue_name}
              </Text>
              {g.people.map((p) => {
                const on = picked.has(p.email);
                return (
                  <Pressable
                    key={p.key}
                    style={({ pressed }) => [styles.person, on && styles.personOn, pressed && { opacity: 0.8 }]}
                    onPress={() => toggle(p.email)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={`${p.name ?? p.email}, ${p.email}`}
                  >
                    <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? T.blue : T.mute} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>
                        {p.name ?? p.email}
                        {p.role ? <Text style={styles.role}>{`  ·  ${p.role}`}</Text> : null}
                      </Text>
                      {p.name ? (
                        <Text style={styles.email} numberOfLines={1}>
                          {p.email}
                        </Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </>
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute, textAlign: 'center', paddingVertical: 24 },
  selectAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  selectAllText: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  group: { marginTop: 10 },
  venue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  personOn: { backgroundColor: T.blueSoft },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  role: { fontFamily: 'Inter_400Regular', color: T.mute },
  email: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.inkSoft, marginTop: 1 },
  write: {
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  writeOff: { opacity: 0.45 },
  writeText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
