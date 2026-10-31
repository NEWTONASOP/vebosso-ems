// ============================================================================
// VEBOSSO EMS — Add my own task
// The employee writes what they will work on. It goes to their manager and the
// owner, who can comment and approve it when it is done.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Modal, Portal, Text } from 'react-native-paper';
import { AppRadius, AppTheme, appShadow, appSoftShadow } from '../constants/theme';
import { useKeyboardHeight } from '../lib/useKeyboardHeight';
import { FieldChainScope } from './FieldChain';
import { PaperOutlinedField } from './PaperOutlinedField';

interface AddMyTaskModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** Returns an error message, or null when it was added. */
  onAdd: (title: string) => Promise<string | null>;
}

export function AddMyTaskModal({ visible, onDismiss, onAdd }: AddMyTaskModalProps) {
  // Text lives in the boxes (not fed back on every key); only "is it empty" is state.
  const titleRef = useRef('');
  const [hasTitle, setHasTitle] = useState(false);
  const [fieldKey, setFieldKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const keyboard = useKeyboardHeight();

  // Closing empties the box, so it opens fresh next time.
  const close = () => {
    titleRef.current = '';
    setHasTitle(false);
    setError('');
    setFieldKey((k) => k + 1);
    onDismiss();
  };

  const submit = async () => {
    if (!titleRef.current.trim() || busy) return;
    setBusy(true);
    setError('');
    const message = await onAdd(titleRef.current);
    setBusy(false);
    if (message) return setError(message);
    close();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={close}
        contentContainerStyle={[styles.modalContainer, keyboard > 0 && { marginBottom: keyboard }]}
      >
        <FieldChainScope>
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <Feather name="plus-circle" size={22} color={AppTheme.blue} />
              </View>
              <Text style={styles.title}>Add my task</Text>
              <Text style={styles.sub}>Your manager and the boss can see it and comment, and approve it when you are done.</Text>
            </View>

            <View style={styles.fields}>
              <PaperOutlinedField
                key={`t${fieldKey}`}
                label="What will you do?"
                defaultValue=""
                onChangeText={(t) => {
                  titleRef.current = t;
                  setHasTitle(!!t.trim());
                  if (error) setError('');
                }}
                multiline
                maxLength={2000}
                autoFocus
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.buttonRow}>
              <Button
                mode="contained"
                onPress={close}
                disabled={busy}
                style={styles.button}
                contentStyle={styles.buttonContent}
                buttonColor={AppTheme.soft2}
                textColor={AppTheme.inkSoft}
                labelStyle={styles.buttonText}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={submit}
                loading={busy}
                disabled={busy || !hasTitle}
                style={styles.button}
                contentStyle={styles.buttonContent}
                buttonColor={AppTheme.charcoal}
                textColor={AppTheme.white}
                labelStyle={styles.buttonText}
              >
                Add task
              </Button>
            </View>
          </View>
        </FieldChainScope>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modalContainer: { marginHorizontal: 20, justifyContent: 'center' },
  container: {
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.sheet,
    padding: 24,
    ...appShadow,
  },
  header: { alignItems: 'center', marginBottom: 18 },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppTheme.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...appSoftShadow,
  },
  title: { fontFamily: 'Inter_700Bold', fontSize: 20, color: AppTheme.ink, letterSpacing: -0.5 },
  sub: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: AppTheme.mute,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  fields: { gap: 12, marginBottom: 14 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: AppTheme.coral, marginBottom: 10 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, borderRadius: 24, ...appSoftShadow },
  buttonContent: { height: 48 },
  buttonText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, letterSpacing: -0.1 },
});
