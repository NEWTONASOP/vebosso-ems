// ============================================================================
// VEBOSSO EMS — Task comments (072)
// Under a task someone added for themselves: the owner and their manager
// write comments, the person reads them. Shown inside the task popup.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addTaskComment, deleteTaskComment, fetchTaskComments } from '../lib/selfTasks';
import { TaskComment } from '../types/database';
import { PaperOutlinedField } from './PaperOutlinedField';
import { UserAvatar } from './UserAvatar';

interface TaskCommentsProps {
  task: { id: string; title: string; assigned_to: string };
  viewer: { id: string; name: string; isOwner: boolean };
}

export function TaskComments({ task, viewer }: TaskCommentsProps) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  // The box keeps its own text (not fed back each key); a new key empties it after sending.
  const textRef = useRef('');
  const [hasText, setHasText] = useState(false);
  const [boxKey, setBoxKey] = useState(0);

  const load = useCallback(async () => {
    const res = await fetchTaskComments(task.id);
    if (res.success) setComments(res.data);
    setLoading(false);
  }, [task.id]);

  useEffect(() => {
    let active = true;
    fetchTaskComments(task.id).then((res) => {
      if (!active) return;
      if (res.success) setComments(res.data);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [task.id]);

  const send = async () => {
    if (!textRef.current.trim() || sending) return;
    setSending(true);
    setError('');
    const res = await addTaskComment(task, { id: viewer.id, name: viewer.name }, textRef.current);
    setSending(false);
    if (!res.success) return setError(res.error);
    textRef.current = '';
    setHasText(false);
    setBoxKey((k) => k + 1);
    await load();
  };

  // The person whose task it is only reads.
  const canWrite = viewer.id !== task.assigned_to;

  const remove = async (c: TaskComment) => {
    const res = await deleteTaskComment(c.id);
    if (!res.success) return setError(res.error);
    setComments((prev) => prev.filter((x) => x.id !== c.id));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Feather name="message-circle" size={16} color={T.mute} />
        <Text style={styles.label}>Comments{comments.length ? ` · ${comments.length}` : ''}</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color={T.charcoal} style={{ marginVertical: 10 }} />
      ) : comments.length === 0 ? (
        <Text style={styles.empty}>{canWrite ? 'No comments yet' : 'No comments from your manager or the boss yet'}</Text>
      ) : (
        comments.map((c) => {
          const mine = c.author_id === viewer.id;
          const name = c.author?.full_name || 'Someone';
          return (
            <View key={c.id} style={styles.item}>
              <UserAvatar
                uri={c.author?.avatar_url}
                size={28}
                label={name.substring(0, 2).toUpperCase()}
                style={styles.avatar}
                labelStyle={styles.avatarLabel}
              />
              <View style={[styles.bubble, mine && styles.bubbleMine]}>
                <View style={styles.bubbleTop}>
                  <Text style={styles.name} numberOfLines={1}>
                    {mine ? 'You' : name}
                    {!mine && c.author?.role && c.author.role !== 'member' ? ` · ${c.author.role === 'owner' ? 'Boss' : 'Manager'}` : ''}
                  </Text>
                  <Text style={styles.time}>{format(new Date(c.created_at), 'd MMM, h:mm a')}</Text>
                </View>
                <Text style={styles.body}>{c.body}</Text>
                {mine || viewer.isOwner ? (
                  <Pressable onPress={() => remove(c)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Delete comment">
                    <Text style={styles.delete}>Delete</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {canWrite ? (
      <View style={styles.composer}>
        <View style={{ flex: 1 }}>
          <PaperOutlinedField
            key={boxKey}
            label="Write a comment"
            defaultValue=""
            onChangeText={(t) => {
              textRef.current = t;
              setHasText(!!t.trim());
            }}
            multiline
            maxLength={1000}
            dense
          />
        </View>
        <Pressable
          style={[styles.send, (!hasText || sending) && styles.sendOff]}
          onPress={send}
          disabled={!hasText || sending}
          accessibilityRole="button"
          accessibilityLabel="Send comment"
        >
          {sending ? <ActivityIndicator size="small" color={T.white} /> : <Feather name="send" size={16} color={T.white} />}
        </Pressable>
      </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  empty: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.mute, marginBottom: 10 },
  item: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  avatar: { backgroundColor: T.soft },
  avatarLabel: { fontSize: 11, fontFamily: 'Inter_700Bold', color: T.inkSoft },
  bubble: { flex: 1, backgroundColor: T.soft, borderRadius: 14, padding: 10 },
  bubbleMine: { backgroundColor: T.blueSoft },
  bubbleTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1, fontFamily: 'Inter_700Bold', fontSize: 12.5, color: T.ink },
  time: { fontFamily: 'Inter_400Regular', fontSize: 11, color: T.mute },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink, lineHeight: 20, marginTop: 3 },
  delete: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: T.coral, marginTop: 6 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  composer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: { opacity: 0.4 },
});
