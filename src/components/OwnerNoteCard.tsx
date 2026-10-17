// ============================================================================
// VEBOSSO EMS — Owner's note on a person
// Sits above Attendance in the owner's member sheet. Private to owners unless
// the switch is on, in which case that person can read it (read-only) in their
// own "My details" (061).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { fetchOwnerNote, saveOwnerNote } from '../lib/workLogRemarks';
import { PaperOutlinedField } from './PaperOutlinedField';

export function OwnerNoteCard({ userId, firstName }: { userId: string; firstName: string }) {
  // null = still loading.
  const [note, setNote] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setNote(null);
    setDraft(null);
    setVisible(false);
    setError('');
    fetchOwnerNote(userId).then((res) => {
      if (!active) return;
      if (res.success) {
        setNote(res.data.note);
        setVisible(res.data.visible);
      } else {
        setNote('');
        setError(res.error);
      }
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const saveText = async () => {
    if (draft === null) return;
    const res = await saveOwnerNote(userId, draft, visible);
    if (!res.success) return setError(res.error);
    setError('');
    setNote(draft.trim());
    setDraft(null);
  };

  const toggleVisible = async (value: boolean) => {
    if (note === null) return;
    setVisible(value);
    const res = await saveOwnerNote(userId, note, value);
    if (!res.success) {
      setVisible(!value);
      setError(res.error);
    } else setError('');
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Feather name={visible ? 'eye' : 'eye-off'} size={13} color={T.violet} />
        <Text style={styles.title} numberOfLines={1}>
          Your note · {visible ? `${firstName} can see` : 'only owners'}
        </Text>
        {draft === null && note !== null ? (
          <Pressable onPress={() => setDraft(note)} hitSlop={8} accessibilityLabel="Edit note">
            <Text style={styles.action}>{note ? 'Edit' : 'Add'}</Text>
          </Pressable>
        ) : null}
        {note || draft !== null ? (
          <Switch
            value={visible}
            onValueChange={(v) => void toggleVisible(v)}
            color={T.violet}
            style={styles.switch}
            accessibilityLabel={`Show note to ${firstName}`}
          />
        ) : null}
      </View>

      {draft !== null ? (
        <>
          <PaperOutlinedField
            label="Note"
            value={draft}
            onChangeText={setDraft}
            multiline
            maxLength={3000}
            style={{ marginTop: 8 }}
          />
          <View style={styles.btns}>
            <Pressable onPress={() => setDraft(null)} hitSlop={6}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.save} onPress={() => void saveText()}>
              <Text style={styles.saveText}>Save note</Text>
            </Pressable>
          </View>
        </>
      ) : note ? (
        <Text style={styles.text} selectable>
          {note}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: T.violetSoft, borderRadius: 14, padding: 12, marginBottom: 18 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 12, color: T.violet },
  action: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.violet },
  text: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink, marginTop: 6, lineHeight: 20 },
  btns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 6 },
  cancel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  save: { height: 34, paddingHorizontal: 16, borderRadius: 999, backgroundColor: T.charcoal, justifyContent: 'center' },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.white },
  // Shrunk so it fits in the header row; negative margins give back the space it keeps.
  switch: { transform: [{ scale: 0.75 }], marginVertical: -8, marginRight: -6 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginTop: 8 },
});
