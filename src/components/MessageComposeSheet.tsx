// ============================================================================
// VEBOSSO EMS — Message Compose Sheet
// One message box and a send button. Used for giving a task, writing to the
// boss, and posting to the whole team.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { SheetFrame } from './SheetFrame';

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
  /** Resolve with an error string to keep the sheet open and show it. */
  onSend: (message: string) => Promise<string | void>;
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
  onSend,
}: MessageComposeSheetProps) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);

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
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
  sendDisabled: {
    opacity: 0.5,
  },
  sendText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
  },
});
