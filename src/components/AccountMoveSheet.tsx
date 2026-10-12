// ============================================================================
// VEBOSSO EMS — Move entries to another account
// Pick the account the selected entries should go to.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { fetchMoveTargets } from '../lib/accounts';
import { useAuthStore } from '../store/authStore';
import { Account } from '../types/database';
import { SheetFrame } from './SheetFrame';

export function AccountMoveSheet({
  fromAccountId,
  count,
  busy,
  onPick,
  onDismiss,
}: {
  fromAccountId: string;
  /** How many entries are being moved. */
  count: number;
  busy: boolean;
  onPick: (target: Account) => void;
  onDismiss: () => void;
}) {
  const role = useAuthStore((s) => s.profile?.role);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchMoveTargets(fromAccountId, role).then((res) => {
      if (!active) return;
      if (res.success) setAccounts(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [fromAccountId, role]);

  return (
    <SheetFrame
      visible
      onDismiss={busy ? () => {} : onDismiss}
      title="Move to…"
      subtitle={`${count} entr${count === 1 ? 'y' : 'ies'} selected — choose the account they go to`}
      icon="corner-up-right"
      iconColor={T.charcoal}
      iconBg={T.soft}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {accounts === null && !error ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : accounts && accounts.length === 0 ? (
        <Text style={styles.empty}>There is no other account to move them to. Add one on the Accounts list first.</Text>
      ) : (
        accounts?.map((a) => (
          <Pressable
            key={a.id}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            onPress={() => onPick(a)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={`Move to ${a.name}`}
          >
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
              {a.note ? <Text style={styles.note} numberOfLines={1}>{a.note}</Text> : null}
            </View>
            {busy ? <ActivityIndicator size="small" color={T.charcoal} /> : <Feather name="chevron-right" size={18} color={T.mute} />}
          </Pressable>
        ))
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  pressed: { backgroundColor: T.soft },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 1 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute, paddingVertical: 20 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 10 },
});
