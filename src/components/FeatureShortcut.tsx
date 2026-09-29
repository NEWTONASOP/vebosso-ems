// ============================================================================
// VEBOSSO EMS — Bills / Accounts shortcut (member home / manager dashboard)
// Only shows for someone the owner gave that feature to.
// Bills: "+ New" starts an estimate.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { useHasFeature } from '../lib/featureAccess';

const CONFIG = {
  bills: {
    title: 'Bills',
    hint: 'Estimates and client bills',
    icon: 'file-text' as const,
    color: T.violet,
    soft: T.violetSoft,
    newPath: '/new?kind=estimate',
  },
  accounts: {
    title: 'Accounts',
    hint: 'Account books and entries',
    icon: 'book' as const,
    color: T.green,
    soft: T.greenSoft,
    newPath: null,
  },
};

export function FeatureShortcut({ feature, role }: { feature: 'bills' | 'accounts'; role: 'manager' | 'member' }) {
  const router = useRouter();
  const allowed = useHasFeature(feature);
  if (!allowed) return null;

  const c = CONFIG[feature];
  const path = `/(${role})/${feature}`;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.9 }]}
      onPress={() => router.push(path as any)}
      accessibilityRole="button"
      accessibilityLabel={c.title}
    >
      <View style={[styles.icon, { backgroundColor: c.soft }]}>
        <Feather name={c.icon} size={17} color={c.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{c.title}</Text>
        <Text style={styles.hint} numberOfLines={1}>{c.hint}</Text>
      </View>
      {c.newPath ? (
        <Pressable
          style={({ pressed }) => [styles.add, pressed && { opacity: 0.85 }]}
          onPress={() => router.push(`${path}${c.newPath}` as any)}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`New ${c.title.toLowerCase()}`}
        >
          <Feather name="plus" size={14} color={T.white} />
          <Text style={styles.addText}>New</Text>
        </Pressable>
      ) : (
        <Feather name="chevron-right" size={18} color={T.mute} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Stacked under the Venues shortcut; renders nothing without access, so it
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
