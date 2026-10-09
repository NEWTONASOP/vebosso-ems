// ============================================================================
// VEBOSSO EMS — "Remark from the boss" on the person's home (migration 053)
// Lists remarks on their own check-ins / check-outs that they haven't replied
// to yet, each with Reply. Hidden when there are none. Replies also work from
// the day in History.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { fetchMyOpenRemarks, OpenRemark, PART_LABEL, replyToRemark } from '../lib/workLogRemarks';
import { useAuthStore } from '../store/authStore';
import { ReasonSheet } from './ReasonSheet';

export function MyRemarksCard({ style }: { style?: object }) {
  const me = useAuthStore((s) => s.profile);
  const [open, setOpen] = useState<OpenRemark[]>([]);
  const [replying, setReplying] = useState<OpenRemark | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!me?.id) return;
    const res = await fetchMyOpenRemarks(me.id);
    if (res.success) setOpen(res.data);
  }, [me?.id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (!open.length) return null;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Feather name="flag" size={15} color={T.amber} />
        </View>
        <Text style={styles.title}>
          {open.length === 1 ? 'A remark from the boss' : `${open.length} remarks from the boss`}
        </Text>
      </View>

      {open.map((r) => (
        <View key={r.id} style={styles.item}>
          <Text style={styles.meta}>
            On your {PART_LABEL[r.part]}
            {r.date ? ` · ${format(parseISO(r.date), 'EEE, d MMM')}` : ''}
            {r.author_name ? ` · ${r.author_name}` : ''}
          </Text>
          <Text style={styles.body}>{r.body}</Text>
          <Pressable style={styles.reply} onPress={() => setReplying(r)} accessibilityRole="button">
            <Feather name="corner-down-right" size={13} color={T.white} />
            <Text style={styles.replyText}>Reply</Text>
          </Pressable>
        </View>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {replying ? (
        <ReasonSheet
          title="Reply to the remark"
          subtitle={replying.body}
          label="Your reply"
          placeholder="Explain what happened"
          hint="You can reply once. The boss will see it."
          confirmLabel="Send reply"
          onConfirm={async (text) => {
            const res = await replyToRemark(replying, text, me?.full_name);
            if (!res.success) return setError(res.error);
            setError('');
            await load();
          }}
          onDismiss={() => setReplying(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: T.card, borderRadius: 20, padding: 14, gap: 10, ...appSoftShadow },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 30, height: 30, borderRadius: 10, backgroundColor: T.amberSoft, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: 'Inter_700Bold', fontSize: 15, color: T.ink },
  item: { backgroundColor: T.amberSoft, borderRadius: 14, padding: 12 },
  meta: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.inkSoft },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink, marginTop: 4, lineHeight: 20 },
  reply: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    height: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    marginTop: 10,
  },
  replyText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.white },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: T.coral },
});
