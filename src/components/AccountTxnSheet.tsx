// ============================================================================
// VEBOSSO EMS — Add / edit a ledger entry
// Date · Credit(+) / Debit(−) · Amount · Particular · optional receipt photos.
// An existing entry opens read-only; Edit switches to the form, and Delete is
// on both. Photos upload as they are added; ones added and
// then abandoned (sheet closed without saving) are removed again.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SmoothTextInput as TextInput } from './SmoothTextInput';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  addTransaction,
  deleteTransaction,
  MAX_RECEIPTS,
  money,
  num,
  removeReceipts,
  signReceipts,
  updateTransaction,
  uploadReceipt,
} from '../lib/accounts';
import { AccountTransaction, TxnKind } from '../types/database';
import { DateField } from './DateTimeFields';
import { useFieldChain } from '../lib/useFieldChain';
import { ImageViewerModal } from './ImageViewerModal';
import { PaperOutlinedField } from './PaperOutlinedField';
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
  const [receipts, setReceipts] = useState<string[]>(txn?.receipts ?? []);
  const [receiptUrls, setReceiptUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  // An existing entry opens to read; Edit switches to the form.
  const [viewing, setViewing] = useState(!!txn);
  // Uploaded in this sheet but not saved yet — removed if the sheet closes.
  const fresh = useRef<string[]>([]);

  useEffect(() => {
    let active = true;
    signReceipts(txn?.receipts ?? []).then((u) => active && setReceiptUrls(u));
    return () => {
      active = false;
    };
  }, [txn]);

  const close = () => {
    void removeReceipts(fresh.current);
    fresh.current = [];
    onDismiss();
  };

  const addReceipt = async (source: 'library' | 'camera') => {
    if (receipts.length >= MAX_RECEIPTS) return setError(`Up to ${MAX_RECEIPTS} photos`);
    try {
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') return setError('Camera permission is needed');
      }
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: 'images',
              allowsMultipleSelection: true,
              selectionLimit: MAX_RECEIPTS - receipts.length,
              quality: 0.8,
            });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true);
      setError('');
      const added: string[] = [];
      for (const a of res.assets.slice(0, MAX_RECEIPTS - receipts.length)) {
        const up = await uploadReceipt(accountId, a.uri);
        if (up.success) added.push(up.data);
        else setError(up.error);
      }
      fresh.current.push(...added);
      setReceipts((r) => [...r, ...added]);
      const urls = await signReceipts(added);
      setReceiptUrls((u) => ({ ...u, ...urls }));
    } catch {
      setError('Could not add the photo');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const amount = Number(amountText.replace(/[,\s₹]/g, ''));
    if (!amountText.trim() || !Number.isFinite(amount) || amount <= 0) return setError('Enter the amount');
    const input = { txn_date: date, kind, amount, particular: particular || null, receipts };
    setSaving(true);
    const res = txn ? await updateTransaction(txn.id, input) : await addTransaction(accountId, input);
    setSaving(false);
    if (!res.success) return setError(res.error);
    // Photos taken off the entry go for good once it is saved.
    void removeReceipts((txn?.receipts ?? []).filter((p) => !receipts.includes(p)));
    fresh.current = [];
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
          const res = await deleteTransaction(txn.id, [...(txn.receipts ?? []), ...fresh.current]);
          if (!res.success) return setError(res.error);
          fresh.current = [];
          onSaved('Entry deleted');
          onDismiss();
        },
      },
    ]);
  };



  return (
    <SheetFrame
      visible
      onDismiss={close}
      title={viewing ? 'Entry' : txn ? 'Edit entry' : 'Add entry'}
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
            {viewing ? (
              <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => setViewing(false)} accessibilityLabel="Edit entry">
                <Text style={styles.saveText}>Edit</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.btn, styles.saveBtn]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>{txn ? 'Save' : 'Add entry'}</Text>}
              </Pressable>
            )}
          </View>
        </View>
      }
    >
      {viewing && txn ? (
        <View>
          <Text style={[styles.viewAmount, { color: kind === 'credit' ? T.green : T.coral }]}>
            {kind === 'credit' ? '+' : '−'} ₹{money(txn.amount)}
          </Text>
          <Text style={styles.viewKind}>{kind === 'credit' ? 'Credit' : 'Debit'}</Text>

          <Text style={styles.label}>Particular</Text>
          <Text style={styles.viewValue}>{txn.particular || '—'}</Text>

          <Text style={styles.label}>Date</Text>
          <Text style={styles.viewValue}>{format(parseISO(txn.txn_date), 'EEE, d MMM yyyy')}</Text>

          {receipts.length ? (
            <>
              <Text style={styles.label}>Receipt photos</Text>
              <View style={styles.receipts}>
                {receipts.map((p) => (
                  <Pressable key={p} onPress={() => setEnlarged(p)} accessibilityLabel="View photo">
                    {receiptUrls[p] ? (
                      <Image source={{ uri: receiptUrls[p] }} style={styles.thumb} contentFit="cover" />
                    ) : (
                      <View style={styles.thumb} />
                    )}
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </View>
      ) : (
      <>
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

      <PaperOutlinedField
        label="Particular"
        value={particular}
        onChangeText={setParticular}
        style={{ marginTop: 12 }}
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

      <Text style={styles.label}>Receipt photos <Text style={styles.optional}>(optional)</Text></Text>
      <View style={styles.receipts}>
        {receipts.map((p) => (
          <View key={p}>
            <Pressable onPress={() => setEnlarged(p)} accessibilityLabel="View photo">
              {receiptUrls[p] ? (
                <Image source={{ uri: receiptUrls[p] }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={styles.thumb} />
              )}
            </Pressable>
            <Pressable
              style={styles.thumbX}
              onPress={() => {
                setReceipts((r) => r.filter((x) => x !== p));
                if (enlarged === p) setEnlarged(null);
              }}
              hitSlop={6}
              accessibilityLabel="Remove photo"
            >
              <Feather name="x" size={11} color={T.white} />
            </Pressable>
          </View>
        ))}
        {receipts.length < MAX_RECEIPTS ? (
          <>
            <Pressable style={styles.addPhoto} onPress={() => addReceipt('library')} disabled={uploading}>
              {uploading ? (
                <ActivityIndicator color={T.charcoal} />
              ) : (
                <>
                  <Feather name="image" size={17} color={T.inkSoft} />
                  <Text style={styles.addPhotoText}>Photos</Text>
                </>
              )}
            </Pressable>
            <Pressable style={styles.addPhoto} onPress={() => addReceipt('camera')} disabled={uploading}>
              <Feather name="camera" size={17} color={T.inkSoft} />
              <Text style={styles.addPhotoText}>Camera</Text>
            </Pressable>
          </>
        ) : null}
      </View>
      </>
      )}

      <ImageViewerModal
        uri={enlarged ? receiptUrls[enlarged] ?? null : null}
        title="Receipt"
        onDismiss={() => setEnlarged(null)}
      />
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6, marginTop: 12 },
  viewAmount: { fontFamily: 'Inter_700Bold', fontSize: 30, letterSpacing: -0.5 },
  viewKind: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.mute, marginTop: 2 },
  viewValue: { fontFamily: 'Inter_500Medium', fontSize: 16, color: T.ink },
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
  optional: { fontFamily: 'Inter_400Regular', color: T.mute },
  receipts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: T.soft2 },
  thumbActive: { borderWidth: 2, borderColor: T.charcoal },
  thumbX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addPhotoText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: T.inkSoft },
  large: { width: '100%', height: 300, borderRadius: 14, backgroundColor: T.charcoalDeep, marginBottom: 10 },
  footerRow: { flexDirection: 'row', gap: 8 },
  btn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 56, backgroundColor: T.coralSoft },
  saveBtn: { flex: 1, backgroundColor: T.charcoal },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
