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
import { TaskDetailModal, TaskManage } from './TaskDetailModal';
import { RecordingBar, useVoiceRecorder, VoiceNote } from './VoiceNote';
import { uploadVoiceNote, VoiceClip } from '../lib/voice';

/** Title for a task given only as a voice note. */
export const VOICE_TASK_TITLE = '🎤 Voice task';

const fetchMemberTasks = async (memberId: string) =>
  await supabase
    .from('tasks')
    .select('*')
    .eq('assigned_to', memberId)
    .order('created_at', { ascending: false })
    .limit(40);

interface MemberTasksSheetProps {
  /** Show in place (e.g. a dropdown in the member sheet) instead of as a sheet. */
  inline?: boolean;
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
  inline,
}: MemberTasksSheetProps) {
  const addTask = useWorkStore((s) => s.addTask);
  const updateTask = useWorkStore((s) => s.updateTask);
  const approveTask = useWorkStore((s) => s.approveTask);
  const rejectTask = useWorkStore((s) => s.rejectTask);
  const [selected, setSelected] = useState<Task | null>(null);
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

  const voice = useVoiceRecorder();

  /** Text, a voice note, or both (the text becomes the title). */
  const handleSend = async (clip?: VoiceClip | null) => {
    const message = text.trim();
    if (!message && !clip) return;
    setIsSending(true);
    setError('');
    let voiceFields: { voice_path: string; voice_ms: number } | null = null;
    if (clip) {
      const up = await uploadVoiceNote('task', memberId, clip);
      if (!up.success) {
        setIsSending(false);
        return setError(up.error);
      }
      voiceFields = { voice_path: up.data, voice_ms: Math.round(clip.durationMs) };
    }
    const res = await addTask({
      assigned_to: memberId,
      assigned_by: assignerId,
      title: (message || VOICE_TASK_TITLE).slice(0, 2000),
      description: null,
      due_date: null,
      status: 'pending',
      ...(voiceFields ?? {}),
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

  // Finished work waiting for approval comes first.
  const open = [
    ...tasks.filter((t) => t.status === 'review'),
    ...tasks.filter((t) => t.status !== 'done' && t.status !== 'review'),
  ];
  const done = tasks.filter((t) => t.status === 'done');

  /** Edit, approve or reject from the task popup; reloads the list on success. */
  const manage: TaskManage | undefined = selected
    ? {
        onSave: async (changes) => {
          const res = await updateTask(selected.id, changes);
          if (!res.success) return res.error || 'Could not save';
          onMessage?.('Task updated');
          await load();
          return null;
        },
        onApprove: async () => {
          const res = await approveTask(selected.id, assignerId);
          if (!res.success) return res.error || 'Could not approve';
          onMessage?.('Task approved');
          await load();
          return null;
        },
        onReject: async (reason) => {
          const res = await rejectTask(selected.id, assignerId, reason);
          if (!res.success) return res.error || 'Could not reject';
          onMessage?.('Task sent back');
          await load();
          return null;
        },
      }
    : undefined;

  const sendVoice = async () => {
    const clip = await voice.stop();
    if (clip) await handleSend(clip);
  };

  const composer = voice.recording || (isSending && !text.trim()) ? (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <RecordingBar
        durationMs={voice.durationMs}
        sending={isSending}
        onCancel={() => void voice.cancel()}
        onSend={() => void sendVoice()}
      />
    </View>
  ) : (
    <View>
      {error || voice.error ? <Text style={styles.error}>{error || voice.error}</Text> : null}
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
        {text.trim() ? (
          <Pressable
            style={styles.sendBtn}
            onPress={() => void handleSend()}
            disabled={isSending}
            accessibilityLabel="Give task"
          >
            {isSending ? (
              <ActivityIndicator size="small" color={T.white} />
            ) : (
              <Feather name="send" size={16} color={T.white} />
            )}
          </Pressable>
        ) : (
          <Pressable
            style={styles.sendBtn}
            // At the length limit, what was recorded is sent as the task.
            onPress={() => void voice.start(() => void sendVoice())}
            accessibilityLabel="Give a task as a voice note"
          >
            <Feather name="mic" size={16} color={T.white} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <>
    <SheetFrame
      inline={inline}
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
          {open.length === 0 ? <Text style={styles.groupEmpty}>Nothing open. All caught up.</Text> : null}
          {open.map((t) => (
            <TaskLine key={t.id} task={t} onPress={() => setSelected(t)} />
          ))}
          {done.length > 0 ? <Text style={[styles.group, { marginTop: 14 }]}>Done · {done.length}</Text> : null}
          {done.map((t) => (
            <TaskLine key={t.id} task={t} onPress={() => setSelected(t)} />
          ))}
        </>
      )}
    </SheetFrame>

    <TaskDetailModal
      visible={!!selected}
      onDismiss={() => setSelected(null)}
      task={selected}
      manage={manage}
    />
    </>
  );
}

function TaskLine({ task, onPress }: { task: Task; onPress: () => void }) {
  const isDone = task.status === 'done';
  const inReview = task.status === 'review';
  return (
    <Pressable
      style={({ pressed }) => [styles.line, pressed && { opacity: 0.6 }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open task: ${task.title}`}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: isDone ? T.greenSoft : inReview ? T.violetSoft : T.amberSoft },
        ]}
      >
        <Feather
          name={isDone ? 'check' : inReview ? 'eye' : 'circle'}
          size={12}
          color={isDone ? T.green : inReview ? T.violet : T.amber}
        />
      </View>
      <View style={{ flex: 1 }}>
        {!(task.voice_path && task.title === VOICE_TASK_TITLE) ? (
          <Text style={[styles.lineText, isDone && styles.lineTextDone]}>{task.title}</Text>
        ) : null}
        {task.voice_path ? (
          <View style={{ marginTop: 4 }}>
            <VoiceNote path={task.voice_path} durationMs={task.voice_ms} />
          </View>
        ) : null}
        {task.description ? <Text style={styles.lineSub}>{task.description}</Text> : null}
        {(isDone || inReview) && task.completion_note ? (
          <Text style={styles.note}>“{task.completion_note}”</Text>
        ) : null}
        {task.rejection_reason && !isDone && !inReview ? (
          <Text style={styles.rejected}>Rejected: {task.rejection_reason}</Text>
        ) : null}
        <Text style={styles.lineMeta}>
          {inReview && task.completed_at
            ? `Waiting for your approval · finished ${format(new Date(task.completed_at), 'd MMM, h:mm a')}`
            : isDone && task.completed_at
              ? `Done ${format(new Date(task.completed_at), 'd MMM, h:mm a')}`
              : `Given ${format(new Date(task.created_at), 'd MMM, h:mm a')}`}
        </Text>
      </View>
    </Pressable>
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
  rejected: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
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
