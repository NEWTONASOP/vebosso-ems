// ============================================================================
// VEBOSSO EMS — Message Compose Sheet
// One message box and a send button. Used for giving a task, writing to the
// boss, and posting to the whole team. With allowVoice, a voice note can be
// recorded and sent too (giving a task).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { SheetFrame } from './SheetFrame';
import { RecordingBar, useVoiceRecorder } from './VoiceNote';
import { VoiceClip } from '../lib/voice';

interface MessageComposeSheetProps {
  visible: boolean;
  onDismiss: () => void;
  title: string;
  subtitle?: string;
  icon?: keyof typeof Feather.glyphMap;
  iconColor?: string;
  iconBg?: string;
  placeholder?: string;
  sendLabel?: string;
  maxLength?: number;
  /** Offer "Record a voice note" (sent with whatever text is typed). */
  allowVoice?: boolean;
  /** Resolve with an error string to keep the sheet open and show it. */
  onSend: (message: string, voice?: VoiceClip | null) => Promise<string | void>;
}

export function MessageComposeSheet({
  visible,
  onDismiss,
  title,
  subtitle,
  icon = 'message-circle',
  iconColor = T.blue,
  iconBg = T.blueSoft,
  placeholder = 'Write your message…',
  sendLabel = 'Send',
  maxLength = 2000,
  allowVoice,
  onSend,
}: MessageComposeSheetProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const voice = useVoiceRecorder();

  const sendVoice = async () => {
    const clip = await voice.stop();
    if (!clip) return;
    setIsSending(true);
    setError('');
    const err = await onSend(text.trim(), clip);
    setIsSending(false);
    if (err) return setError(err);
    setText('');
  };

  const handleSend = async () => {
    const message = text.trim();
    if (!message) {
      setError('Write a message first');
      return;
    }
    setIsSending(true);
    setError('');
    const err = await onSend(message);
    setIsSending(false);
    if (err) {
      setError(err);
      return;
    }
    setText('');
  };

  return (
    <SheetFrame
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      icon={icon}
      iconColor={iconColor}
      iconBg={iconBg}
    >
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          if (error) setError('');
        }}
        placeholder={placeholder}
        placeholderTextColor={T.mute}
        style={styles.input}
        multiline
        textAlignVertical="top"
        maxLength={maxLength}
        editable={!isSending}
        autoFocus
      />
      {error || voice.error ? <Text style={styles.error}>{error || voice.error}</Text> : null}
      {allowVoice ? (
        voice.recording || (isSending && voice.durationMs > 0 && !text.trim()) ? (
          <View style={{ marginTop: 12 }}>
            <RecordingBar
              durationMs={voice.durationMs}
              sending={isSending}
              onCancel={() => void voice.cancel()}
              onSend={() => void sendVoice()}
            />
          </View>
        ) : (
          <Pressable
            style={styles.voiceBtn}
            // At the length limit, what was recorded is sent.
            onPress={() => void voice.start(() => void sendVoice())}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel="Record a voice note"
          >
            <Feather name="mic" size={15} color={T.ink} />
            <Text style={styles.voiceText}>Record a voice note</Text>
          </Pressable>
        )
      ) : null}
      <Pressable
        style={[styles.send, !text.trim() && styles.sendDisabled]}
        onPress={handleSend}
        disabled={isSending}
        accessibilityRole="button"
        accessibilityLabel={sendLabel}
      >
        {isSending ? (
          <ActivityIndicator size="small" color={T.white} />
        ) : (
          <>
            <Feather name="send" size={15} color={T.white} />
            <Text style={styles.sendText}>{sendLabel}</Text>
          </>
        )}
      </Pressable>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 120,
    maxHeight: 240,
    borderRadius: 16,
    backgroundColor: T.soft,
    padding: 14,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    lineHeight: 21,
    color: T.ink,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    marginTop: 8,
  },
  send: {
    marginTop: 14,
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voiceBtn: {
    marginTop: 12,
    height: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.soft2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  voiceText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
  },
});
