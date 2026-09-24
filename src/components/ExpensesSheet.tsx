// ============================================================================
// VEBOSSO EMS — Travel Expenses Sheet
//   self:  submit what you spent (amount, plus a note and/or receipts) and
//          confirm "received" once the boss pays.
//   owner: see one person's claims and mark them paid.
// submitted → paid → received, like salary.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  fetchExpenses,
  formatAmount,
  markExpensePaid,
  markExpenseReceived,
  MAX_RECEIPTS,
  signReceiptUrls,
  submitExpense,
} from '../lib/expenses';
import { ExpenseClaim, ExpenseStatus } from '../types/database';
import { DateField } from './DateTimeFields';
import { SheetFrame } from './SheetFrame';

const STATUS: Record<ExpenseStatus, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Waiting', color: T.amber, bg: T.amberSoft },
  paid: { label: 'Paid', color: T.blue, bg: T.blueSoft },
  received: { label: 'Received', color: T.green, bg: T.greenSoft },
};

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

const loadAll = async (userId: string) => {
  const res = await fetchExpenses(userId);
  if (!res.success) return res;
  const urls = await signReceiptUrls(res.data.flatMap((c) => c.photos ?? []));
  return { success: true as const, data: { claims: res.data, urls } };
};

interface ExpensesSheetProps {
  onDismiss: () => void;
  userId: string;
  userName: string;
  mode: 'self' | 'owner';
  ownerId?: string;
}

export function ExpensesSheet({ onDismiss, userId, userName, mode, ownerId }: ExpensesSheetProps) {
  const [claims, setClaims] = useState<ExpenseClaim[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [composing, setComposing] = useState(false);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  const apply = useCallback((res: Awaited<ReturnType<typeof loadAll>>) => {
    if (res.success) {
      setClaims(res.data.claims);
      setUrls(res.data.urls);
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await loadAll(userId)), [apply, userId]);

  // Mounted only while open, so this loads once on open.
  useEffect(() => {
    let active = true;
    loadAll(userId).then((res) => active && apply(res));
    return () => {
      active = false;
    };
  }, [apply, userId]);

  const unpaidTotal = useMemo(
    () =>
      claims
        .filter((c) => c.status === 'submitted')
        .reduce((sum, c) => sum + (Number(c.amount) || 0), 0),
    [claims]
  );
  const waitingCount = claims.filter((c) => c.status === 'submitted').length;

  const run = async (id: string, action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setBusy(id);
    setError('');
    setNotice('');
    const res = await action();
    setBusy(null);
    if (res.success) {
      setNotice(done);
      await load();
    } else {
      setError(res.error || 'Something went wrong');
    }
  };

  const confirmPaid = (c: ExpenseClaim) => {
    if (!ownerId) return;
    const amount = formatAmount(c.amount);
    Alert.alert(
      'Mark as paid?',
      `${userName} will be told${amount ? ` ${amount}` : ' this expense'} has been paid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark paid', onPress: () => void run(c.id, () => markExpensePaid(c, ownerId), 'Marked as paid') },
      ],
    );
  };

  if (composing) {
    return (
      <ExpenseComposer
        userId={userId}
        onCancel={() => setComposing(false)}
        onSubmitted={async () => {
          setComposing(false);
          setNotice('Sent to the boss');
          await load();
        }}
      />
    );
  }

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Travel expenses"
      subtitle={
        waitingCount > 0
          ? `${waitingCount} waiting${unpaidTotal > 0 ? ` · ${formatAmount(unpaidTotal)}` : ''}`
          : mode === 'owner'
            ? userName
            : 'Send what you spent; confirm when it’s paid'
      }
      icon="navigation"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={
        mode === 'self' ? (
          <Pressable style={styles.primary} onPress={() => setComposing(true)}>
            <Feather name="plus" size={16} color={T.white} />
            <Text style={styles.primaryText}>New expense</Text>
          </Pressable>
        ) : undefined
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {enlarged && urls[enlarged] ? (
        <Pressable onPress={() => setEnlarged(null)} accessibilityLabel="Close receipt">
          <Image source={{ uri: urls[enlarged] }} style={styles.large} contentFit="contain" />
        </Pressable>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : claims.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="navigation" size={22} color={T.mute} />
          <Text style={styles.emptyText}>No expenses yet</Text>
        </View>
      ) : (
        claims.map((c) => {
          const s = STATUS[c.status];
          const amount = formatAmount(c.amount);
          const when =
            c.status === 'received' && c.received_at
              ? `Received ${format(new Date(c.received_at), 'd MMM')}`
              : c.status === 'paid' && c.paid_at
                ? `Paid ${format(new Date(c.paid_at), 'd MMM')}`
                : `Sent ${format(new Date(c.created_at), 'd MMM, h:mm a')}`;
          return (
            <View key={c.id} style={styles.claim}>
              <View style={styles.claimHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.claimAmount}>{amount ?? 'No amount'}</Text>
                  <Text style={styles.claimMeta}>
                    Spent {format(parseISO(c.spent_on), 'EEE, d MMM')} · {when}
                  </Text>
                </View>
                <View style={[styles.chip, { backgroundColor: s.bg }]}>
                  <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
                </View>
              </View>

              {c.description ? <Text style={styles.claimText}>{c.description}</Text> : null}

              {c.photos?.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {c.photos.map((p) =>
                    urls[p] ? (
                      <Pressable key={p} onPress={() => setEnlarged(enlarged === p ? null : p)}>
                        <Image
                          source={{ uri: urls[p] }}
                          style={[styles.thumb, enlarged === p && styles.thumbActive]}
                          contentFit="cover"
                        />
                      </Pressable>
                    ) : null
                  )}
                </ScrollView>
              ) : null}

              {mode === 'owner' && c.status === 'submitted' ? (
                <ActionButton label="Mark as paid" busy={busy === c.id} onPress={() => confirmPaid(c)} />
              ) : null}
              {mode === 'self' && c.status === 'paid' ? (
                <ActionButton
                  label="I received it"
                  busy={busy === c.id}
                  onPress={() => run(c.id, () => markExpenseReceived(c), 'Thanks — the boss has been told')}
                />
              ) : null}
            </View>
          );
        })
      )}
    </SheetFrame>
  );
}

function ActionButton({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.action} onPress={onPress} disabled={busy}>
      {busy ? <ActivityIndicator size="small" color={T.white} /> : <Text style={styles.actionText}>{label}</Text>}
    </Pressable>
  );
}

// ----------------------------------------------------------------------------

function ExpenseComposer({
  userId,
  onCancel,
  onSubmitted,
}: {
  userId: string;
  onCancel: () => void;
  onSubmitted: () => void;
}) {
  const today = KEY(new Date());
  const yesterday = KEY(addDays(new Date(), -1));
  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [spentOn, setSpentOn] = useState(today);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const addPhoto = async (source: 'library' | 'camera') => {
    if (photos.length >= MAX_RECEIPTS) return setError(`Up to ${MAX_RECEIPTS} receipts`);
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return setError('Permission is needed to add a receipt');
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.6 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.6 });
      if (!result.canceled && result.assets?.[0]) {
        setPhotos((p) => [...p, result.assets[0].uri]);
        setError('');
      }
    } catch {
      setError('Could not open the picker');
    }
  };

  const handleSubmit = async () => {
    if (!description.trim() && photos.length === 0) {
      return setError('Add a receipt photo or write what it was for');
    }
    const amount = Number(amountText.replace(/[,\s₹]/g, ''));
    if (!amountText.trim() || !Number.isFinite(amount) || amount <= 0) {
      return setError('Enter the amount spent');
    }

    setSending(true);
    const res = await submitExpense({ userId, description, amount, spentOn, photoUris: photos });
    setSending(false);
    if (res.success) onSubmitted();
    else setError(res.error);
  };



  return (
    <SheetFrame
      visible
      onDismiss={onCancel}
      title="New expense"
      subtitle="Goes to the boss for payment"
      icon="navigation"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.primary} onPress={handleSubmit} disabled={sending}>
            {sending ? <ActivityIndicator color={T.white} /> : <Text style={styles.primaryText}>Send to boss</Text>}
          </Pressable>
        </View>
      }
    >
      <Text style={styles.label}>What was it for? (optional)</Text>
      <TextInput
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          if (error) setError('');
        }}
        style={[styles.input, styles.inputMulti]}
        multiline
        textAlignVertical="top"
        maxLength={2000}
      />

      <Text style={styles.label}>Amount *</Text>
      <View style={styles.amountRow}>
        <Text style={styles.rupee}>₹</Text>
        <TextInput
          value={amountText}
          onChangeText={(t) => {
            setAmountText(t);
            if (error) setError('');
          }}
          placeholder="0"
          placeholderTextColor={T.mute}
          style={[styles.input, { flex: 1 }]}
          keyboardType="decimal-pad"
          maxLength={12}
        />
      </View>

      <DateField
        style={{ marginTop: 12 }}
        label="When"
        value={spentOn}
        onChange={setSpentOn}
        quick={[
          { label: 'Today', value: today },
          { label: 'Yesterday', value: yesterday },
        ]}
        allow="past"
      />

      <Text style={styles.label}>Receipts (optional)</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {photos.map((uri, i) => (
          <View key={uri}>
            <Image source={{ uri }} style={styles.thumb} contentFit="cover" />
            <Pressable
              style={styles.removePhoto}
              onPress={() => setPhotos((p) => p.filter((_, j) => j !== i))}
              hitSlop={6}
              accessibilityLabel="Remove receipt"
            >
              <Feather name="x" size={12} color={T.white} />
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_RECEIPTS ? (
          <>
            <Pressable style={styles.addPhoto} onPress={() => addPhoto('camera')} accessibilityLabel="Take a photo">
              <Feather name="camera" size={18} color={T.inkSoft} />
              <Text style={styles.addPhotoText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.addPhoto} onPress={() => addPhoto('library')} accessibilityLabel="Choose photos">
              <Feather name="image" size={18} color={T.inkSoft} />
              <Text style={styles.addPhotoText}>Photos</Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  notice: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.green, marginBottom: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.mute },
  large: { width: '100%', height: 320, borderRadius: 14, backgroundColor: T.charcoalDeep, marginBottom: 10 },
  claim: { backgroundColor: T.soft, borderRadius: 16, padding: 12, marginBottom: 8, gap: 8 },
  claimHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  claimAmount: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink },
  claimMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 1 },
  claimText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.inkSoft, lineHeight: 20 },
  chip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 10 },
  chipText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: T.soft2 },
  thumbActive: { borderWidth: 2, borderColor: T.charcoal },
  action: {
    height: 40,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.white },
  primary: {
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6, marginTop: 12 },
  input: {
    height: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  inputMulti: { height: 100, paddingTop: 12 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { fontFamily: 'Inter_700Bold', fontSize: 18, color: T.inkSoft },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  addPhotoText: { fontFamily: 'Inter_500Medium', fontSize: 11, color: T.inkSoft },
  removePhoto: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
