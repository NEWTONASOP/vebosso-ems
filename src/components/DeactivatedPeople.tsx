// ============================================================================
// VEBOSSO EMS — Deactivated people (owner's Dashboard)
// People the owner has deactivated are kept out of the team everywhere else.
// They are listed here, folded away, as ordinary member cards: tap one to open
// the same sheet as for anyone else (attendance, tasks, documents, salary, chat…),
// or reactivate them. Shows nothing when nobody is deactivated.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { Profile } from '../types/database';
import { MemberCard } from './MemberCard';

export function DeactivatedPeople({
  onChanged,
  onOpen,
}: {
  onChanged: (message: string) => void;
  /** Open this person's sheet, like tapping anyone in the team. */
  onOpen: (member: Profile) => void;
}) {
  const [people, setPeople] = useState<Profile[]>([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_active', false)
      .neq('role', 'owner')
      .order('full_name');
    setPeople((data ?? []) as Profile[]);
  }, []);

  // On opening the Dashboard, and on coming back from a person's profile.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      supabase
        .from('profiles')
        .select('*')
        .eq('is_active', false)
        .neq('role', 'owner')
        .order('full_name')
        .then(({ data }) => {
          if (active) setPeople((data ?? []) as Profile[]);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const reactivate = (member: Profile) =>
    Alert.alert(
      `Reactivate ${member.full_name}?`,
      'They can sign in again and show up in the team, tasks and reminders.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reactivate',
          onPress: async () => {
            setBusyId(member.id);
            const { error } = await supabase.from('profiles').update({ is_active: true }).eq('id', member.id);
            setBusyId(null);
            if (error) return onChanged(error.message);
            onChanged(`${member.full_name} is active again`);
            await load();
          },
        },
      ]
    );

  if (people.length === 0) return null;

  return (
    <View style={styles.card}>
      <Pressable
        style={styles.head}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={styles.headIcon}>
          <Feather name="user-x" size={17} color={T.coral} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Deactivated</Text>
          <Text style={styles.hint}>
            {people.length} {people.length === 1 ? 'person' : 'people'} · cannot sign in
          </Text>
        </View>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={T.mute} />
      </Pressable>

      {open
        ? people.map((m) => (
            <View key={m.id} style={styles.person}>
              <MemberCard
                member={m}
                currentStatus="offline"
                onPress={() => onOpen(m)}
                actions={
                  <Pressable
                    style={styles.btn}
                    onPress={() => reactivate(m)}
                    disabled={busyId === m.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Reactivate ${m.full_name}`}
                  >
                    {busyId === m.id ? (
                      <ActivityIndicator size="small" color={T.white} />
                    ) : (
                      <Text style={styles.btnText}>Reactivate</Text>
                    )}
                  </Pressable>
                }
              />
            </View>
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 10,
    borderRadius: 18,
    backgroundColor: T.card,
    paddingHorizontal: 14,
    paddingVertical: 4,
    ...appSoftShadow,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  headIcon: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: T.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 1 },
  person: { opacity: 0.9, marginBottom: 2 },
  btn: {
    alignSelf: 'stretch',
    height: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.white },
});
