// ============================================================================
// VEBOSSO EMS — Backfill Grant Bar (owner's member sheet)
// Under the attendance calendar for a past day: let this person fill in (or
// correct) that day's attendance once. Mirrors the History screen's
// "Allow edit" — past days only, one open permission per day — and tells the
// person they can now do it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { sendPushNotification } from '../lib/notifications';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { useWorkStore } from '../store/workStore';

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

const fetchOpenGrants = async (memberId: string) =>
  await supabase
    .from('backfill_permissions')
    .select('date')
    .eq('user_id', memberId)
    .eq('is_used', false);

interface BackfillGrantBarProps {
  memberId: string;
  memberName: string;
  date: Date;
}

export function BackfillGrantBar({ memberId, memberName, date }: BackfillGrantBarProps) {
  const ownerId = useAuthStore((s) => s.profile?.id);
  const grantBackfillPermission = useWorkStore((s) => s.grantBackfillPermission);
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchOpenGrants>>) => {
    setOpenDates(new Set((res.data || []).map((r: { date: string }) => r.date)));
  }, []);

  useEffect(() => {
    let active = true;
    fetchOpenGrants(memberId).then((res) => active && apply(res));
    return () => {
      active = false;
    };
  }, [apply, memberId]);

  const key = KEY(date);
  // Only a finished day can be backfilled.
  if (key >= KEY(new Date())) return null;

  const firstName = memberName.split(' ')[0];
  const dayLabel = format(date, 'd MMM');
  const isAllowed = openDates.has(key);

  const handleGrant = async () => {
    if (!ownerId || busy) return;
    setBusy(true);
    setError('');
    const res = await grantBackfillPermission(memberId, key, ownerId);
    if (res.success) {
      sendPushNotification(
        memberId,
        'You can fill in attendance ✏️',
        `The boss allowed you to add your attendance for ${format(date, 'EEE, d MMM')}. Open History to fill it in.`,
        { type: 'backfill_granted', date: key },
      );
      apply(await fetchOpenGrants(memberId));
    } else {
      setError(res.error || 'Could not allow the edit');
    }
    setBusy(false);
  };

  if (isAllowed) {
    return (
      <View style={[styles.bar, styles.barAllowed]}>
        <Feather name="check-circle" size={15} color={T.green} />
        <Text style={[styles.text, { color: T.green }]}>
          {firstName} can fill in {dayLabel}
          <Text style={styles.textMute}> · waiting for them</Text>
        </Text>
      </View>
    );
  }

  return (
    <View>
      <Pressable
        style={({ pressed }) => [styles.bar, styles.barAction, pressed && { opacity: 0.8 }]}
        onPress={handleGrant}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Allow ${memberName} to fill in ${dayLabel}`}
      >
        <View style={styles.icon}>
          <Feather name="edit-2" size={14} color={T.amber} />
        </View>
        <Text style={[styles.text, { flex: 1 }]} numberOfLines={2}>
          Allow {firstName} to fill in {dayLabel}
        </Text>
        {busy ? (
          <ActivityIndicator size="small" color={T.amber} />
        ) : (
          <Text style={styles.cta}>Allow</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  barAction: {
    backgroundColor: T.amberSoft,
  },
  barAllowed: {
    backgroundColor: T.greenSoft,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: T.ink,
  },
  textMute: {
    fontFamily: 'Inter_400Regular',
    color: T.inkSoft,
  },
  cta: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    color: T.amber,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12.5,
    color: T.coral,
    marginTop: -8,
    marginBottom: 12,
    marginLeft: 4,
  },
});
