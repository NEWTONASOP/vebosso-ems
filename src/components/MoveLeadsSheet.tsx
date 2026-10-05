// ============================================================================
// VEBOSSO EMS — Move a group of leads into a banquet
// From a banquet's ⋮ menu (e.g. "No banquet" after an import): pick a banquet,
// or type a new one, and every lead in the group moves there.
// ============================================================================

import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addBanquet, fetchBanquets, moveLeads } from '../lib/leads';
import { LeadBanquet } from '../types/database';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

const key = (s: string) => s.trim().toLowerCase();

export function MoveLeadsSheet({
  fromName,
  fromId,
  leadIds,
  banquets,
  onDismiss,
  onDone,
}: {
  /** The group's name, e.g. "No banquet". */
  fromName: string;
  /** The group's banquet id; null for "No banquet". */
  fromId: string | null;
  leadIds: string[];
  banquets: LeadBanquet[];
  onDismiss: () => void;
  onDone: (message: string) => void;
}) {
  const others = banquets.filter((b) => b.id !== fromId);
  const [choice, setChoice] = useState<string | 'new'>(others[0]?.id ?? 'new');
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const n = leadIds.length;

  const run = async () => {
    setError('');
    setBusy(true);
    try {
      let target: LeadBanquet | undefined;
      if (choice === 'new') {
        const name = newName.trim();
        if (!name) return setError('Type the banquet name');
        target = banquets.find((b) => key(b.name) === key(name));
        if (!target) {
          const res = await addBanquet(name);
          if (res.success) target = res.data;
          else {
            // Made by someone else in the meantime: look again.
            const again = await fetchBanquets();
            target = again.success ? again.data.find((b) => key(b.name) === key(name)) : undefined;
            if (!target) return setError(res.error);
          }
        }
      } else {
        target = banquets.find((b) => b.id === choice);
      }
      if (!target) return setError('Pick a banquet');
      const res = await moveLeads(leadIds, target.id);
      if (!res.success) return setError(res.error);
      onDone(`${res.data} ${res.data === 1 ? 'lead' : 'leads'} moved to ${target.name}`);
      onDismiss();
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={`Move ${n} ${n === 1 ? 'lead' : 'leads'}`}
      subtitle={`From ${fromName}`}
      icon="corner-down-right"
      iconColor={T.ink}
      iconBg={T.soft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={() => void run()} disabled={busy}>
            {busy ? <ActivityIndicator color={T.white} /> : <Text style={styles.primaryText}>Move {n} {n === 1 ? 'lead' : 'leads'}</Text>}
          </Pressable>
        </View>
      }
    >
      <Text style={styles.label}>Into</Text>
      <View style={styles.chips}>
        {others.map((b) => {
          const on = choice === b.id;
          return (
            <Pressable key={b.id} onPress={() => setChoice(b.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setChoice('new')} style={[styles.chip, choice === 'new' && styles.chipOn]}>
          <Text style={[styles.chipText, choice === 'new' && styles.chipTextOn]}>+ New banquet</Text>
        </Pressable>
      </View>
      {choice === 'new' ? (
        <PaperOutlinedField
          label="New banquet name"
          value={newName}
          onChangeText={setNewName}
          maxLength={120}
          style={{ marginTop: 12 }}
          returnKeyType="done"
          onSubmitEditing={() => void run()}
        />
      ) : null}
      <Text style={styles.hint}>Only the banquet changes — names, numbers and dates stay as they are.</Text>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: T.soft, justifyContent: 'center' },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 14 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  primary: { height: 48, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
