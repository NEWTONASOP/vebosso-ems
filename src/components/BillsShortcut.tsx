// ============================================================================
// VEBOSSO EMS — Bills Shortcut (member home / manager dashboard)
// Only shows for someone the owner gave Bills to. "+ New" starts an estimate.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { useCanManageBills } from '../lib/billsAccess';

export function BillsShortcut({ role }: { role: 'manager' | 'member' }) {
  const router = useRouter();
  const canManage = useCanManageBills();
  if (!canManage) return null;

  const path = role === 'manager' ? '/(manager)/bills' : '/(member)/bills';

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(path as any)}
      accessibilityRole="button"
      accessibilityLabel="Bills"
    >
      <View style={styles.icon}>
        <Feather name="file-text" size={17} color={T.violet} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Bills</Text>
        <Text style={styles.hint} numberOfLines={1}>Estimates and client bills</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.add, pressed && { opacity: 0.85 }]}
        onPress={() => router.push(`${path}/new?kind=estimate` as any)}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="New estimate"
      >
        <Feather name="plus" size={14} color={T.white} />
        <Text style={styles.addText}>New</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Sits under the Venues shortcut; renders nothing without access, so it
  // brings its own gap.
  card: {
    marginTop: 10,
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
    backgroundColor: T.violetSoft,
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
