// ============================================================================
// VEBOSSO EMS — "What needs to change?" box
// Asked when something is sent back to the person (a task, a check-in, a
// checkout): the reason is required and the person sees it. Plain wording and
// a calm button — it is a request for a change, not a telling-off.
// The text lives in the box itself (PaperOutlinedField), kept here only to send.
// ============================================================================

import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

export function ReasonSheet({
  title = 'Send back',
  subtitle,
  label = 'What needs to change?',
  placeholder = 'Say what to fix, so they know',
  hint,
  confirmLabel = 'Send back',
  onConfirm,
  onDismiss,
}: {
  title?: string;
  subtitle?: string;
  label?: string;
  placeholder?: string;
  /** A line under the box, e.g. what happens next. */
  hint?: string;
  confirmLabel?: string;
  /** Called with the reason; the sheet closes itself afterwards. */
  onConfirm: (reason: string) => void | Promise<unknown>;
  onDismiss: () => void;
}) {
  const reason = useRef('');
  const [has, setHas] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const text = reason.current.trim();
    if (!text || busy) return;
    setBusy(true);
    await onConfirm(text);
    setBusy(false);
    onDismiss();
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      icon="corner-up-left"
      iconColor={T.amber}
      iconBg={T.amberSoft}
      footer={
        <Pressable
          style={[styles.btn, !has && { opacity: 0.45 }]}
          onPress={() => void send()}
          disabled={!has || busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={T.white} /> : <Text style={styles.btnText}>{confirmLabel}</Text>}
        </Pressable>
      }
    >
      <PaperOutlinedField
        label={label}
        defaultValue=""
        onChangeText={(t) => {
          reason.current = t;
          setHas(!!t.trim());
        }}
        multiline
        maxLength={1000}
        autoFocus
        placeholder={placeholder}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 10 },
});
