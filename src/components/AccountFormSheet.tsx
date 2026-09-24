// ============================================================================
// VEBOSSO EMS — New / rename / delete an account
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import { createAccount, deleteAccount, updateAccount } from '../lib/accounts';
import { Account } from '../types/database';
import { SheetFrame } from './SheetFrame';

export function AccountFormSheet({
  account,
  onDismiss,
  onSaved,
  onDeleted,
}: {
  /** Present when renaming. */
  account?: Account | null;
  onDismiss: () => void;
  onSaved: (account: Account | null, message: string) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(account?.name ?? '');
  const [note, setNote] = useState(account?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return setError('Give the account a name');
    setSaving(true);
    if (account) {
      const res = await updateAccount(account.id, name, note);
      setSaving(false);
      if (!res.success) return setError(res.error);
      onSaved({ ...account, name: name.trim(), note: note.trim() || null }, 'Account updated');
    } else {
      const res = await createAccount(name, note);
      setSaving(false);
      if (!res.success) return setError(res.error);
      onSaved(res.data, `${res.data.name} created`);
    }
    onDismiss();
  };

  const remove = () => {
    if (!account) return;
    Alert.alert(
      'Delete account?',
      `"${account.name}" and every entry in it will be deleted for good. Export it first if you want a copy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAccount(account.id);
            if (!res.success) return setError(res.error);
            onDismiss();
            onDeleted?.();
          },
        },
      ],
    );
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={account ? 'Edit account' : 'New account'}
      subtitle={account ? account.name : 'A person, party, bank or anything you keep books for'}
      icon="book-open"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            {account ? (
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} accessibilityLabel="Delete account">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={save} disabled={saving}>
              {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>{account ? 'Save' : 'Create account'}</Text>}
            </Pressable>
          </View>
        </View>
      }
    >
      <Text style={styles.label}>Name *</Text>
      <TextInput
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError('');
        }}
        style={styles.input}
        maxLength={120}
        autoFocus={!account}
      />
      <Text style={styles.label}>Note</Text>
      <TextInput value={note} onChangeText={setNote} style={styles.input} maxLength={500} />
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6, marginTop: 10 },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 56, backgroundColor: T.coralSoft },
  saveBtn: { flex: 1, backgroundColor: T.charcoal },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
