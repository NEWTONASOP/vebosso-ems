// ============================================================================
// VEBOSSO EMS — Chat (owner ↔ one person)
// ChatPanel: in place, e.g. the Messages dropdown in the owner's member sheet.
// ChatSheet: a bottom sheet, e.g. "Message Boss" on the person's side.
// New messages arrive in realtime and are marked read while the chat is open.
// Anyone can send a voice message: with the box empty, the button records.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, isToday, isYesterday } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { CHAT_MAX, fetchChat, markChatRead, sendChatMessage } from '../lib/chat';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { ChatMessage } from '../types/database';
import { SheetFrame } from './SheetFrame';
import { RecordingBar, useVoiceRecorder, VoiceNote } from './VoiceNote';
import { VoiceClip } from '../lib/voice';

// ----------------------------------------------------------------------------

function useChat(memberId: string) {
  const profile = useAuthStore((s) => s.profile);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const isOwner = profile?.role === 'owner';
  /** The boss side is every owner; the other side is the person. */
  const isMine = useCallback(
    (m: ChatMessage) => (isOwner ? m.sender_id !== memberId : m.sender_id === memberId),
    [isOwner, memberId]
  );

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchChat>>) => {
    if (res.success) {
      setMessages(res.data);
      setError('');
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    fetchChat(memberId).then((res) => {
      if (!active) return;
      apply(res);
      void markChatRead(memberId);
    });

    const channel = supabase
      .channel(`chat_${memberId}_${Math.random().toString(36).slice(2, 8)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `member_id=eq.${memberId}` },
        (payload) => {
          const row = payload.new as ChatMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
          void markChatRead(memberId);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [apply, memberId]);

  const send = async (body: string, voice?: VoiceClip | null) => {
    if (!profile) return false;
    const res = await sendChatMessage({
      memberId,
      senderId: profile.id,
      senderName: isOwner ? 'the boss' : profile.full_name,
      body,
      voice,
    });
    if (!res.success) {
      setError(res.error);
      return false;
    }
    setError('');
    setMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
    return true;
  };

  return { messages, isLoading, error, isMine, send };
}

// ----------------------------------------------------------------------------

const stamp = (iso: string) => {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return `Yesterday, ${format(d, 'h:mm a')}`;
  return format(d, 'd MMM, h:mm a');
};

function Bubbles({
  messages,
  isMine,
  emptyText,
}: {
  messages: ChatMessage[];
  isMine: (m: ChatMessage) => boolean;
  emptyText: string;
}) {
  if (messages.length === 0) {
    return (
      <View style={styles.empty}>
        <Feather name="message-circle" size={20} color={T.mute} />
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }
  const lastMine = [...messages].reverse().find(isMine);
  return (
    <View style={styles.list}>
      {messages.map((m) => {
        const mine = isMine(m);
        return (
          <View key={m.id} style={[styles.bubbleWrap, mine ? styles.wrapMine : styles.wrapTheirs]}>
            <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
              {m.audio_path ? <VoiceNote path={m.audio_path} durationMs={m.audio_ms} dark={mine} /> : null}
              {m.body ? (
                <Text style={[styles.body, mine && styles.bodyMine, m.audio_path ? { marginTop: 6 } : null]} selectable>
                  {m.body}
                </Text>
              ) : null}
            </View>
            <Text style={[styles.meta, mine && styles.metaMine]}>
              {stamp(m.created_at)}
              {mine && m.id === lastMine?.id && m.read_at ? ' · Seen' : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Composer({ onSend }: { onSend: (body: string, voice?: VoiceClip | null) => Promise<boolean> }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const voice = useVoiceRecorder();

  const submit = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const ok = await onSend(text);
    setSending(false);
    if (ok) setText('');
  };

  const sendVoice = async () => {
    const clip = await voice.stop();
    if (!clip) return;
    setSending(true);
    await onSend('', clip);
    setSending(false);
  };

  if (voice.recording || (sending && !text.trim())) {
    return (
      <View style={styles.composerWrap}>
        <RecordingBar
          durationMs={voice.durationMs}
          sending={sending}
          onCancel={() => void voice.cancel()}
          onSend={() => void sendVoice()}
        />
      </View>
    );
  }

  const empty = !text.trim();

  return (
    <View style={styles.composerWrap}>
      {voice.error ? <Text style={styles.error}>{voice.error}</Text> : null}
    <View style={[styles.composer, { marginTop: 0 }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Write a message…"
        placeholderTextColor={T.mute}
        style={styles.input}
        multiline
        maxLength={CHAT_MAX}
      />
      {empty ? (
        <Pressable
          style={styles.send}
          // At the length limit, what was recorded is sent.
          onPress={() => void voice.start(() => void sendVoice())}
          accessibilityRole="button"
          accessibilityLabel="Record a voice message"
        >
          <Feather name="mic" size={18} color={T.white} />
        </Pressable>
      ) : (
        <Pressable
          style={styles.send}
          onPress={submit}
          disabled={sending}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          {sending ? <ActivityIndicator size="small" color={T.white} /> : <Feather name="send" size={17} color={T.white} />}
        </Pressable>
      )}
    </View>
    </View>
  );
}

// ----------------------------------------------------------------------------

const INLINE_SHOWN = 20;

/** In place — the last messages, "show earlier", and the message box. */
export function ChatPanel({ memberId, otherName }: { memberId: string; otherName: string }) {
  const chat = useChat(memberId);
  const [showAll, setShowAll] = useState(false);
  const hidden = showAll ? 0 : Math.max(0, chat.messages.length - INLINE_SHOWN);
  const shown = hidden ? chat.messages.slice(hidden) : chat.messages;

  return (
    <View>
      {chat.error ? <Text style={styles.error}>{chat.error}</Text> : null}
      {chat.isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 16 }} />
      ) : (
        <>
          {hidden ? (
            <Pressable onPress={() => setShowAll(true)} style={styles.earlier} hitSlop={6}>
              <Text style={styles.earlierText}>Show {hidden} earlier</Text>
            </Pressable>
          ) : null}
          <Bubbles messages={shown} isMine={chat.isMine} emptyText={`No messages with ${otherName} yet.`} />
        </>
      )}
      <Composer onSend={chat.send} />
    </View>
  );
}

/** As a bottom sheet, newest at the bottom, message box pinned below. */
export function ChatSheet({
  memberId,
  title,
  subtitle,
  onDismiss,
}: {
  memberId: string;
  title: string;
  subtitle?: string;
  onDismiss: () => void;
}) {
  const chat = useChat(memberId);
  return (
    <SheetFrame
      visible
      stickToEnd
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      icon="message-circle"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={
        <View>
          {chat.error ? <Text style={styles.error}>{chat.error}</Text> : null}
          <Composer onSend={chat.send} />
        </View>
      }
    >
      {chat.isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : (
        <Bubbles messages={chat.messages} isMine={chat.isMine} emptyText="No messages yet — say hello." />
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 18 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.mute, textAlign: 'center' },
  bubbleWrap: { maxWidth: '84%' },
  wrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  bubbleMine: { backgroundColor: T.charcoal, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: T.soft, borderBottomLeftRadius: 6 },
  body: { fontFamily: 'Inter_400Regular', fontSize: 14.5, lineHeight: 20, color: T.ink },
  bodyMine: { color: T.white },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: T.mute, marginTop: 3, marginHorizontal: 4 },
  metaMine: { textAlign: 'right' },
  earlier: { alignSelf: 'center', paddingVertical: 6, marginBottom: 6 },
  earlierText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.blue },
  composerWrap: { marginTop: 12 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, marginTop: 12 },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 22,
    backgroundColor: T.soft,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: T.ink,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendIdle: { opacity: 0.4 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
});
