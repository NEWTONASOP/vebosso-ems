// ============================================================================
// VEBOSSO EMS — Bill history
// Who changed a saved bill, when, and what (old → new). Bills are shared, so
// this is how anyone can see what was done to one. Read only: the database
// writes it (038).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { describeEdit, fetchBillEdits } from '../lib/bills';
import { BillEdit } from '../types/database';
import { SheetFrame } from './SheetFrame';

export function BillHistorySheet({
  billId,
  billNumber,
  onDismiss,
}: {
  billId: string;
  billNumber: string | null;
  onDismiss: () => void;
}) {
  const [edits, setEdits] = useState<BillEdit[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchBillEdits(billId).then((res) => {
      if (!active) return;
      if (res.success) setEdits(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [billId]);

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Edit history"
      subtitle={billNumber ?? undefined}
      icon="clock"
      iconColor={T.violet}
      iconBg={T.violetSoft}
    >
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : edits === null ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : edits.length === 0 ? (
        <Text style={styles.empty}>No changes recorded yet.</Text>
      ) : (
        edits.map((e) => (
          <View key={e.id} style={styles.entry}>
            <View style={styles.head}>
              <Feather name={e.action === 'created' ? 'plus-circle' : 'edit-2'} size={14} color={T.inkSoft} />
              <Text style={styles.who} numberOfLines={1}>
                {e.edited_by_name || 'Someone'}
                <Text style={styles.did}>{e.action === 'created' ? ' created it' : ' edited it'}</Text>
              </Text>
            </View>
            <Text style={styles.when}>{format(new Date(e.edited_at), 'd MMM yyyy, h:mm a')}</Text>
            {e.action === 'edited'
              ? e.changes.map((c, i) => {
                  const d = describeEdit(c);
                  return (
                    <Text key={`${e.id}-${i}`} style={styles.change}>
                      <Text style={styles.changeLabel}>{d.label}: </Text>
                      <Text style={styles.from}>{d.from}</Text>
                      <Text style={styles.arrow}>  →  </Text>
                      <Text style={styles.to}>{d.to}</Text>
                    </Text>
                  );
                })
              : null}
          </View>
        ))
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  empty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute, textAlign: 'center', paddingVertical: 24 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, paddingVertical: 12 },
  entry: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 14, color: T.ink },
  did: { fontFamily: 'Inter_500Medium', color: T.inkSoft },
  when: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 2, marginLeft: 22 },
  change: { fontFamily: 'Inter_400Regular', fontSize: 13, lineHeight: 19, marginTop: 6, marginLeft: 22, color: T.inkSoft },
  changeLabel: { fontFamily: 'Inter_600SemiBold', color: T.ink },
  from: { color: T.mute, textDecorationLine: 'line-through' },
  arrow: { color: T.mute },
  to: { fontFamily: 'Inter_600SemiBold', color: T.ink },
});
