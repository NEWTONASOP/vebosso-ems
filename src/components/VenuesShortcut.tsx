// ============================================================================
// VEBOSSO EMS — Venues Shortcut (member home / manager dashboard)
// Opens the venues table; "+ Add" jumps straight into the add form, since the
// moment someone needs this is right after meeting a venue.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { supabase } from '../lib/supabase';

const countVenues = async () =>
  await supabase.from('venues').select('id', { count: 'exact', head: true });

export function VenuesShortcut({ role }: { role: 'manager' | 'member' }) {
  const router = useRouter();
  const [count, setCount] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      countVenues().then((res) => active && setCount(res.count ?? null));
      return () => {
        active = false;
      };
    }, [])
  );

  const path = role === 'manager' ? '/(manager)/venues' : '/(member)/venues';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(path as any)}
      accessibilityRole="button"
      accessibilityLabel="Venues"
    >
      <View style={styles.icon}>
        <Feather name="map-pin" size={17} color={T.blue} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Venues</Text>
        <Text style={styles.hint} numberOfLines={1}>
          {count === null ? 'Venues onboarded to VEBOSSO' : `${count} onboarded · add one you met`}
        </Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`${path}?add=1` as any)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Add a venue"
      >
        <Feather name="plus" size={14} color={T.white} />
        <Text style={styles.addText}>Add</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...appSoftShadow,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: T.mute,
    marginTop: 1,
  },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.charcoal,
  },
  addText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.white,
  },
});
