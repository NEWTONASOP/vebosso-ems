// ============================================================================
// VEBOSSO EMS — Add / edit a ledger entry
// Date · Credit(+) / Debit(−) · Amount · Particular. Editing also offers Delete.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import { addTransaction, deleteTransaction, num, updateTransaction } from '../lib/accounts';
import { AccountTransaction, TxnKind } from '../types/database';
import { DateField } from './DateTimeFields';
import { useFieldChain } from '../lib/useFieldChain';
import { SheetFrame } from './SheetFrame';

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');


export function AccountTxnSheet({
  accountId,
  accountName,
  txn,
  onDismiss,
  onSaved,
}: {
  accountId: string;
  accountName: string;
  /** Present when editing. */
  txn?: AccountTransaction | null;
  onDismiss: () => void;
  onSaved: (message: string) => void;
}) {
  const today = KEY(new Date());
  const yesterday = KEY(addDays(new Date(), -1));

  const [date, setDate] = useState(txn?.txn_date ?? today);
  const [kind, setKind] = useState<TxnKind>(txn?.kind ?? 'debit');
  const [amountText, setAmountText] = useState(txn ? String(num(txn.amount)) : '');
  const [particular, setParticular] = useState(txn?.particular ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const chain = useFieldChain();

  const save = async () => {
    const amount = Number(amountText.replace(/[,\s₹]/g, ''));
    if (!amountText.trim() || !Number.isFinite(amount) || amount <= 0) return setError('Enter the amount');
    const input = { txn_date: date, kind, amount, particular: particular || null };
    setSaving(true);
    const res = txn ? await updateTransaction(txn.id, input) : await addTransaction(accountId, input);
    setSaving(false);
    if (!res.success) return setError(res.error);
    onSaved(txn ? 'Entry updated' : 'Entry added');
    onDismiss();
  };

  const remove = () => {
    if (!txn) return;
    Alert.alert('Delete entry?', 'This entry will be removed from the account.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteTransaction(txn.id);
          if (!res.success) return setError(res.error);
          onSaved('Entry deleted');
          onDismiss();
        },
      },
    ]);
  };



  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={txn ? 'Edit entry' : 'Add entry'}
      subtitle={accountName}
      icon={kind === 'credit' ? 'plus-circle' : 'minus-circle'}
      iconColor={kind === 'credit' ? T.green : T.coral}
      iconBg={kind === 'credit' ? T.greenSoft : T.coralSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerRow}>
            {txn ? (
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} accessibilityLabel="Delete entry">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>{txn ? 'Save' : 'Add entry'}</Text>}
            </Pressable>
          </View>
        </View>
      }
    >
      <Text style={styles.label}>Type</Text>
      <View style={styles.kindRow}>
        {(['credit', 'debit'] as const).map((k) => {
          const active = kind === k;
          const color = k === 'credit' ? T.green : T.coral;
          return (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              style={[styles.kind, active && { backgroundColor: color, borderColor: color }]}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <Feather name={k === 'credit' ? 'plus' : 'minus'} size={15} color={active ? T.white : color} />
              <Text style={[styles.kindText, { color: active ? T.white : color }]}>
                {k === 'credit' ? 'Credit (+)' : 'Debit (−)'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Amount *</Text>
      <View style={styles.amountRow}>
        <Text style={styles.rupee}>₹</Text>
        <TextInput
          value={amountText}
          onChangeText={(t) => {
            setAmountText(t);
            if (error) setError('');
          }}
          style={[styles.input, styles.amountInput]}
          keyboardType="decimal-pad"
          maxLength={14}
          autoFocus={!txn}
          ref={chain.reg('amount')}
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={chain.next('particular')}
        />
      </View>

      <Text style={styles.label}>Particular</Text>
      <TextInput
        value={particular}
        onChangeText={setParticular}
        style={styles.input}
        maxLength={500}
        ref={chain.reg('particular')}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
      />

      <DateField
        style={{ marginTop: 12 }}
        label="Date"
        value={date}
        onChange={(d) => {
          setDate(d);
          if (error) setError('');
        }}
        quick={[
          { label: 'Today', value: today },
          { label: 'Yesterday', value: yesterday },
        ]}
      />
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6, marginTop: 12 },
  kindRow: { flexDirection: 'row', gap: 8 },
  kind: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.soft2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  kindText: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { fontFamily: 'Inter_700Bold', fontSize: 20, color: T.inkSoft },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  amountInput: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 18 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  btn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 56, backgroundColor: T.coralSoft },
  saveBtn: { flex: 1, backgroundColor: T.charcoal },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
