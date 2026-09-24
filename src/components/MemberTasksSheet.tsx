// ============================================================================
// VEBOSSO EMS — Member Tasks Sheet ("Tasks by Boss")
// The owner's view of one person's tasks: what's open, what's finished (with
// their note), and a message box to give a new one.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { supabase } from '../lib/supabase';
import { useWorkStore } from '../store/workStore';
import { Task } from '../types/database';
import { SheetFrame } from './SheetFrame';

const fetchMemberTasks = async (memberId: string) =>
  await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', memberId)
    .order('created_at', { ascending: false })
    .limit(40);

interface MemberTasksSheetProps {
  visible: boolean;
  onDismiss: () => void;
  memberId: string;
  memberName: string;
  assignerId: string;
  onMessage?: (message: string) => void;
}

export function MemberTasksSheet({
  visible,
  onDismiss,
  memberId,
  memberName,
  assignerId,
  onMessage,
}: MemberTasksSheetProps) {
  const addTask = useWorkStore((s) => s.addTask);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [text, setText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchMemberTasks>>) => {
    if (res.error) setError(res.error.message);
    setTasks((res.data || []) as Task[]);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await fetchMemberTasks(memberId)), [apply, memberId]);

  // Mounted only while open, so this loads once on open.
  useEffect(() => {
    let active = true;
    fetchMemberTasks(memberId).then((res) => active && apply(res));
    return () => {
      active = false;
    };
  }, [apply, memberId]);

  const handleSend = async () => {
    const message = text.trim();
    if (!message) return;
    setIsSending(true);
    setError('');
    const res = await addTask({
      assigned_to: memberId,
      assigned_by: assignerId,
      title: message.slice(0, 2000),
      description: null,
      due_date: null,
      status: 'pending',
    });
    setIsSending(false);
    if (res.success) {
      setText('');
      onMessage?.(`Task given to ${memberName}`);
      await load();
    } else {
      setError(res.error || 'Failed to give task');
    }
  };

  const open = tasks.filter((t) => t.status !== 'done');
  const done = tasks.filter((t) => t.status === 'done');

  const composer = (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={`Give ${memberName.split(' ')[0]} a task…`}
          placeholderTextColor={T.mute}
          style={styles.input}
          multiline
          maxLength={2000}
          editable={!isSending}
        />
        <Pressable
          style={[styles.sendBtn, !text.trim() && { opacity: 0.4 }]}
          onPress={handleSend}
          disabled={isSending || !text.trim()}
          accessibilityLabel="Give task"
        >
          {isSending ? (
            <ActivityIndicator size="small" color={T.white} />
          ) : (
            <Feather name="send" size={16} color={T.white} />
          )}
        </Pressable>
      </View>
    </View>
  );

  return (
    <SheetFrame
      visible={visible}
      onDismiss={onDismiss}
      title="Tasks by Boss"
      subtitle={memberName}
      icon="clipboard"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={composer}
    >
      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : tasks.length === 0 ? (
        <Text style={styles.empty}>No tasks yet. Write one below.</Text>
      ) : (
        <>
          <Text style={styles.group}>Open · {open.length}</Text>
          {open.length === 0 ? <Text style={styles.groupEmpty}>Nothing open — all caught up.</Text> : null}
          {open.map((t) => (
            <TaskLine key={t.id} task={t} />
          ))}
          {done.length > 0 ? <Text style={[styles.group, { marginTop: 14 }]}>Done · {done.length}</Text> : null}
          {done.map((t) => (
            <TaskLine key={t.id} task={t} />
          ))}
        </>
      )}
    </SheetFrame>
  );
}

function TaskLine({ task }: { task: Task }) {
  const isDone = task.status === 'done';
  return (
    <View style={styles.line}>
      <View style={[styles.dot, { backgroundColor: isDone ? T.greenSoft : T.amberSoft }]}>
        <Feather name={isDone ? 'check' : 'circle'} size={12} color={isDone ? T.green : T.amber} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.lineText, isDone && styles.lineTextDone]}>{task.title}</Text>
        {task.description ? <Text style={styles.lineSub}>{task.description}</Text> : null}
        {isDone && task.completion_note ? (
          <Text style={styles.note}>“{task.completion_note}”</Text>
        ) : null}
        <Text style={styles.lineMeta}>
          {isDone && task.completed_at
            ? `Done ${format(new Date(task.completed_at), 'd MMM, h:mm a')}`
            : `Given ${format(new Date(task.created_at), 'd MMM, h:mm a')}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    textAlign: 'center',
    paddingVertical: 20,
  },
  group: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  groupEmpty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginBottom: 4,
  },
  line: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  lineText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.ink,
    lineHeight: 20,
  },
  lineTextDone: {
    color: T.inkSoft,
  },
  lineSub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginTop: 2,
  },
  note: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.green,
    marginTop: 3,
  },
  lineMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11.5,
    color: T.mute,
    marginTop: 3,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    marginBottom: 8,
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 16,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.ink,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
