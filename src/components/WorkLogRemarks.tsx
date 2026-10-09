// ============================================================================
// VEBOSSO EMS — Remarks under a check-in / check-out card (migration 053)
// "review" (owner, or the person's manager): read, add a remark, remove one.
// "answer" (the person whose day it is): read, and reply once to each.
// Sits inside the day timeline card, under the plan / report.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  addRemark,
  fetchRemarks,
  PART_LABEL,
  RemarkPart,
  removeRemark,
  replyToRemark,
  WorkLogRemark,
} from '../lib/workLogRemarks';
import { useAuthStore } from '../store/authStore';
import { ReasonSheet } from './ReasonSheet';

export type RemarksMode = 'review' | 'answer';

export function WorkLogRemarks({
  workLogId,
  part,
  mode,
  personId,
  personName,
  date,
}: {
  workLogId: string;
  part: RemarkPart;
  mode: RemarksMode;
  /** Whose day it is. */
  personId: string;
  personName?: string | null;
  /** The day, for the notification text ("8 Oct: …"). */
  date?: string | null;
}) {
  const me = useAuthStore((s) => s.profile);
  const [remarks, setRemarks] = useState<WorkLogRemark[]>([]);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [replyingTo, setReplyingTo] = useState<WorkLogRemark | null>(null);

  const load = useCallback(async () => {
    const res = await fetchRemarks(workLogId);
    if (res.success) setRemarks(res.data.filter((r) => r.part === part));
  }, [workLogId, part]);

  useEffect(() => {
    void load();
  }, [load]);

  const first = personName?.split(' ')[0] ?? 'They';

  const remove = (r: WorkLogRemark) =>
    Alert.alert('Remove this remark?', r.reply ? `${first}'s reply goes with it.` : undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await removeRemark(r.id);
          if (!res.success) return setError(res.error);
          setError('');
          await load();
        },
      },
    ]);

  // Nothing to show the person until there's a remark.
  if (mode === 'answer' && remarks.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {remarks.map((r) => {
        const canRemove = mode === 'review' && (me?.role === 'owner' || r.author_id === me?.id);
        return (
          <View key={r.id} style={styles.remark}>
            <View style={styles.head}>
              <Feather name="flag" size={12} color={T.amber} />
              <Text style={styles.who} numberOfLines={1}>
                {mode === 'answer' ? `Remark from ${r.author_name ?? 'the boss'}` : `Remark by ${r.author_name ?? 'someone'}`}
                <Text style={styles.when}>{`  ·  ${format(parseISO(r.created_at), 'd MMM, h:mm a')}`}</Text>
              </Text>
              {canRemove ? (
                <Pressable onPress={() => remove(r)} hitSlop={8} accessibilityLabel="Remove remark">
                  <Feather name="trash-2" size={14} color={T.mute} />
                </Pressable>
              ) : null}
            </View>
            <Text style={styles.body} selectable>
              {r.body}
            </Text>

            {r.reply ? (
              <View style={styles.reply}>
                <Text style={styles.replyWho}>
                  {mode === 'answer' ? 'Your reply' : `${first}'s reply`}
                  {r.replied_at ? <Text style={styles.when}>{`  ·  ${format(parseISO(r.replied_at), 'd MMM, h:mm a')}`}</Text> : null}
                </Text>
                <Text style={styles.body} selectable>
                  {r.reply}
                </Text>
              </View>
            ) : mode === 'answer' ? (
              <Pressable style={styles.replyBtn} onPress={() => setReplyingTo(r)} accessibilityRole="button">
                <Feather name="corner-down-right" size={13} color={T.white} />
                <Text style={styles.replyBtnText}>Reply</Text>
              </Pressable>
            ) : (
              <Text style={styles.waiting}>Waiting for {first}'s reply</Text>
            )}
          </View>
        );
      })}

      {mode === 'review' ? (
        <Pressable style={styles.add} onPress={() => setAdding(true)} accessibilityRole="button" hitSlop={4}>
          <Feather name="plus" size={13} color={T.inkSoft} />
          <Text style={styles.addText}>Add remark</Text>
        </Pressable>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {adding ? (
        <ReasonSheet
          title={`Remark on the ${PART_LABEL[part]}`}
          subtitle={personName ?? undefined}
          label="Your remark"
          placeholder="Write your remark"
          hint={`${first} will see this and can reply. You can remove it later.`}
          confirmLabel="Add remark"
          onConfirm={async (text) => {
            const res = await addRemark(workLogId, part, text, personId, date);
            if (!res.success) return setError(res.error);
            setError('');
            await load();
          }}
          onDismiss={() => setAdding(false)}
        />
      ) : null}

      {replyingTo ? (
        <ReasonSheet
          title="Reply to the remark"
          subtitle={replyingTo.body}
          label="Your reply"
          placeholder="Explain what happened"
          hint="You can reply once. The boss will see it."
          confirmLabel="Send reply"
          onConfirm={async (text) => {
            const res = await replyToRemark(replyingTo, text, me?.full_name);
            if (!res.success) return setError(res.error);
            setError('');
            await load();
          }}
          onDismiss={() => setReplyingTo(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 10, gap: 8 },
  remark: { backgroundColor: T.amberSoft, borderRadius: 12, padding: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  who: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.ink },
  when: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.mute },
  body: { fontFamily: 'Inter_400Regular', fontSize: 13.5, color: T.ink, marginTop: 4, lineHeight: 19 },
  reply: { marginTop: 8, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.12)' },
  replyWho: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.inkSoft },
  waiting: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.inkSoft, marginTop: 6, fontStyle: 'italic' },
  replyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    marginTop: 8,
  },
  replyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.white },
  add: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', paddingVertical: 4 },
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: T.inkSoft },
  error: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: T.coral },
});
