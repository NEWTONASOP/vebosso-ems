// ============================================================================
// VEBOSSO EMS — Pick a lead's label (078)
// Chips of the shared labels (tap again to clear) and "+ New remark" to make
// one; a long press offers to remove one (when allowed). Each label has a
// colour, by its place in the list.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addLabel } from '../lib/leads';
import { LeadLabel } from '../types/database';
import { PaperOutlinedField } from './PaperOutlinedField';

const COLORS: { color: string; soft: string }[] = [
  { color: T.coral, soft: T.coralSoft },
  { color: T.blue, soft: T.blueSoft },
  { color: T.green, soft: T.greenSoft },
  { color: T.amber, soft: '#FFF4DE' },
  { color: T.violet, soft: T.violetSoft },
];

/** A label's colours, by its place in the shared list. */
export function labelColor(labels: LeadLabel[], id: string | null | undefined) {
  const i = labels.findIndex((l) => l.id === id);
  return i < 0 ? { color: T.inkSoft, soft: T.soft } : COLORS[i % COLORS.length];
}

export function LeadLabelPicker({
  labels,
  value,
  onChange,
  canCreate,
  onCreated,
  onRemove,
  disabled,
}: {
  labels: LeadLabel[];
  value: string | null;
  onChange: (labelId: string | null) => void;
  /** May they add a new label (same rule as adding a banquet)? */
  canCreate: boolean;
  /** A label was made: it is picked straight away. */
  onCreated: (label: LeadLabel) => void;
  /** Long press: remove this label everywhere. Left out when not allowed. */
  onRemove?: (label: LeadLabel) => void;
  disabled?: boolean;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const create = async () => {
    if (typing === null) return;
    setSaving(true);
    const res = await addLabel(typing);
    setSaving(false);
    if (!res.success) return setError(res.error);
    setTyping(null);
    setError('');
    onCreated(res.data);
    onChange(res.data.id);
  };

  return (
    <View>
      <View style={styles.chips}>
        {labels.map((l) => {
          const on = value === l.id;
          const c = labelColor(labels, l.id);
          return (
            <Pressable
              key={l.id}
              onPress={() => onChange(on ? null : l.id)}
              onLongPress={onRemove ? () => onRemove(l) : undefined}
              disabled={disabled}
              style={[styles.chip, { backgroundColor: on ? c.color : c.soft }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipText, { color: on ? T.white : c.color }]}>{l.name}</Text>
            </Pressable>
          );
        })}
        {canCreate && typing === null ? (
          <Pressable onPress={() => setTyping('')} style={[styles.chip, styles.newChip]} accessibilityRole="button">
            <Text style={[styles.chipText, { color: T.ink }]}>+ New remark</Text>
          </Pressable>
        ) : null}
      </View>
      {typing !== null ? (
        <View style={styles.newRow}>
          <PaperOutlinedField
            label="New remark"
            placeholder="e.g. Not picked"
            value={typing}
            onChangeText={(t) => {
              setTyping(t);
              if (error) setError('');
            }}
            style={{ flex: 1 }}
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => void create()}
          />
          <Pressable style={styles.iconBtn} onPress={() => setTyping(null)} accessibilityLabel="Cancel">
            <Feather name="x" size={16} color={T.inkSoft} />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, { backgroundColor: T.charcoal }]}
            onPress={() => void create()}
            disabled={saving}
            accessibilityLabel="Save remark"
          >
            {saving ? <ActivityIndicator color={T.white} /> : <Feather name="check" size={16} color={T.white} />}
          </Pressable>
        </View>
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 34, borderRadius: 17, justifyContent: 'center' },
  newChip: { backgroundColor: T.card, borderWidth: 1, borderColor: T.soft2, borderStyle: 'dashed' },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13 },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginTop: 6 },
});
