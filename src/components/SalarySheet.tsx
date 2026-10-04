// ============================================================================
// VEBOSSO EMS — Salary Sheet
// Salary is paid outside the app; this is the Requested → Paid → Received
// conversation for one person, month by month.
//   self:  see the monthly salary, ask for a month's salary (or remind),
//          confirm received.
//   owner: set the monthly salary; mark a month paid with the amount paid —
//          on a request, or for any month directly.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addMonths, format, isAfter, parseISO, startOfMonth, subMonths } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SmoothTextInput as TextInput } from './SmoothTextInput';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  fetchMonthlySalary,
  fetchSalaryRequests,
  markSalaryPaid,
  markSalaryReceived,
  requestSalary,
  salaryMonthLabel,
  setMonthlySalary,
} from '../lib/employeeRecords';
import { SalaryRequest, SalaryStatus } from '../types/database';
import { SheetFrame } from './SheetFrame';

interface SalarySheetProps {
  /** Show in place (e.g. a dropdown in the member sheet) instead of as a sheet. */
  inline?: boolean;
  visible: boolean;
  onDismiss: () => void;
  userId: string;
  userName: string;
  mode: 'self' | 'owner';
  /** Signed-in owner's id, for mode 'owner'. */
  ownerId?: string;
}

const STATUS: Record<SalaryStatus, { label: string; color: string; bg: string; icon: keyof typeof Feather.glyphMap }> = {
  requested: { label: 'Requested', color: T.amber, bg: T.amberSoft, icon: 'clock' },
  paid: { label: 'Paid', color: T.blue, bg: T.blueSoft, icon: 'send' },
  received: { label: 'Received', color: T.green, bg: T.greenSoft, icon: 'check-circle' },
};

const monthKey = (d: Date) => format(startOfMonth(d), 'yyyy-MM-dd');

const rupees = (n: number | string | null | undefined) =>
  n === null || n === undefined || n === '' ? null : `₹${Number(n).toLocaleString('en-IN')}`;

/** "25,000" / "₹ 25000.50" → 25000.5; null when not a valid amount. */
const parseRupees = (text: string) => {
  const n = Number(text.replace(/[,\s₹]/g, ''));
  return text.trim() && Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

const loadAll = async (userId: string) => {
  const [records, monthly] = await Promise.all([fetchSalaryRequests(userId), fetchMonthlySalary(userId)]);
  return { records, monthly };
};

export function SalarySheet({ visible, onDismiss, userId, userName, mode, ownerId, inline }: SalarySheetProps) {
  const [records, setRecords] = useState<SalaryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Salary usually lands at the start of the next month, so default to last month.
  const [month, setMonth] = useState(() => startOfMonth(subMonths(new Date(), 1)));
  const [monthly, setMonthly] = useState<number | null>(null);
  // Owner: editing the monthly salary; the amount for the month being paid
  // (null = use the monthly salary).
  const [editingMonthly, setEditingMonthly] = useState<string | null>(null);
  const [payText, setPayText] = useState<string | null>(null);

  const apply = useCallback((res: Awaited<ReturnType<typeof loadAll>>) => {
    if (res.records.success) setRecords(res.records.data);
    else setError(res.records.error);
    if (res.monthly.success) setMonthly(res.monthly.data);
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

  const selectedKey = monthKey(month);
  const selectedRecord = records.find((r) => r.month === selectedKey);
  const canGoForward = !isAfter(addMonths(month, 1), startOfMonth(new Date()));

  const run = async (key: string, action: () => Promise<{ success: boolean; error?: string }>, done: string) => {
    setBusy(key);
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
    return res.success;
  };

  const handleSelfAsk = () =>
    run(
      'ask',
      () => requestSalary(userId, selectedKey),
      selectedRecord ? 'Reminder sent to the boss' : 'Request sent to the boss',
    );

  const saveMonthly = () => {
    if (!ownerId || editingMonthly === null) return;
    const amount = parseRupees(editingMonthly);
    if (amount === null) return setError('Enter the monthly salary');
    void run('monthly', () => setMonthlySalary(userId, amount, ownerId), 'Monthly salary saved').then(
      (ok) => ok && setEditingMonthly(null)
    );
  };

  const payValue = payText ?? (monthly !== null ? String(monthly) : '');

  const confirmPaid = (monthIso: string) => {
    if (!ownerId) return;
    const amount = parseRupees(payValue);
    if (payValue.trim() && amount === null) return setError('That amount doesn’t look right');
    Alert.alert(
      'Mark as paid?',
      `${userName} will be told the ${salaryMonthLabel(monthIso)} salary${amount !== null ? ` (${rupees(amount)})` : ''} is paid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: () =>
            void run(monthIso, () => markSalaryPaid(userId, monthIso, ownerId, amount), 'Marked as paid').then(
              (ok) => ok && setPayText(null)
            ),
        },
      ],
    );
  };

  // ---- Month picker + the main action for that month ----------------------
  const selectedStatus = selectedRecord?.status;
  let primaryLabel: string | null = null;
  let primaryAction: (() => void) | null = null;

  if (mode === 'self') {
    if (!selectedStatus) {
      primaryLabel = 'Ask for salary';
      primaryAction = handleSelfAsk;
    } else if (selectedStatus === 'requested') {
      primaryLabel = 'Remind the boss';
      primaryAction = handleSelfAsk;
    } else if (selectedStatus === 'paid' && selectedRecord) {
      primaryLabel = 'I received it';
      primaryAction = () =>
        run('ask', () => markSalaryReceived(selectedRecord), 'Thanks — the boss has been told');
    }
  } else if (!selectedStatus || selectedStatus === 'requested') {
    primaryLabel = 'Mark as paid';
    primaryAction = () => confirmPaid(selectedKey);
  }

  const paidAmount = rupees(selectedRecord?.amount);

  const picker = (
    <View>
      <View style={styles.monthRow}>
        <Pressable style={styles.monthArrow} onPress={() => setMonth((m) => subMonths(m, 1))} hitSlop={6}>
          <Feather name="chevron-left" size={18} color={T.ink} />
        </Pressable>
        <View style={styles.monthCenter}>
          <Text style={styles.monthText}>{format(month, 'MMMM yyyy')}</Text>
          {selectedStatus ? (
            <Text style={[styles.monthState, { color: STATUS[selectedStatus].color }]}>
              {STATUS[selectedStatus].label}
              {paidAmount && selectedStatus !== 'requested' ? ` · ${paidAmount}` : ''}
              {selectedStatus === 'requested' && selectedRecord?.expected_on
                ? ` · will be paid by ${format(parseISO(selectedRecord.expected_on), 'd MMM')}`
                : ''}
            </Text>
          ) : (
            <Text style={styles.monthStateMute}>Nothing yet</Text>
          )}
        </View>
        <Pressable
          style={[styles.monthArrow, !canGoForward && { opacity: 0.3 }]}
          onPress={() => canGoForward && setMonth((m) => addMonths(m, 1))}
          disabled={!canGoForward}
          hitSlop={6}
        >
          <Feather name="chevron-right" size={18} color={T.ink} />
        </Pressable>
      </View>

      {mode === 'owner' && primaryLabel ? (
        <View style={styles.payRow}>
          <Text style={styles.payLabel}>Amount paid</Text>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            value={payValue}
            onChangeText={(t) => {
              setPayText(t);
              if (error) setError('');
            }}
            placeholder={monthly === null ? 'Amount' : undefined}
            placeholderTextColor={T.mute}
            keyboardType="decimal-pad"
            maxLength={12}
            style={styles.payInput}
          />
        </View>
      ) : null}

      {primaryLabel && primaryAction ? (
        <Pressable style={styles.primary} onPress={primaryAction} disabled={busy !== null}>
          {busy === 'ask' || busy === selectedKey ? (
            <ActivityIndicator size="small" color={T.white} />
          ) : (
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          )}
        </Pressable>
      ) : (
        <Text style={styles.doneNote}>
          {selectedStatus === 'received'
            ? 'Paid and received — all settled.'
            : `Waiting for ${mode === 'owner' ? userName.split(' ')[0] : 'you'} to confirm it arrived.`}
        </Text>
      )}
    </View>
  );

  return (
    <SheetFrame
      inline={inline}
      visible={visible}
      onDismiss={onDismiss}
      title="Salary"
      subtitle={mode === 'owner' ? userName : 'Ask the boss, then confirm when it arrives'}
      icon="credit-card"
      iconColor={T.green}
      iconBg={T.greenSoft}
      footer={picker}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}

      {!isLoading && (mode === 'owner' || monthly !== null) ? (
        <View style={styles.monthlyCard}>
          {editingMonthly !== null ? (
            <>
              <Text style={styles.monthlyLabel}>Monthly salary</Text>
              <View style={styles.monthlyEditRow}>
                <Text style={styles.rupee}>₹</Text>
                <TextInput
                  value={editingMonthly}
                  onChangeText={(t) => {
                    setEditingMonthly(t);
                    if (error) setError('');
                  }}
                  keyboardType="decimal-pad"
                  maxLength={12}
                  autoFocus
                  style={styles.payInput}
                  returnKeyType="done"
                  onSubmitEditing={saveMonthly}
                />
                <Pressable style={styles.smallBtnGhost} onPress={() => setEditingMonthly(null)} hitSlop={4}>
                  <Text style={styles.smallBtnGhostText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.smallBtn} onPress={saveMonthly} disabled={busy === 'monthly'}>
                  {busy === 'monthly' ? (
                    <ActivityIndicator size="small" color={T.white} />
                  ) : (
                    <Text style={styles.smallBtnText}>Save</Text>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.monthlyRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthlyLabel}>Monthly salary</Text>
                <Text style={[styles.monthlyValue, monthly === null && styles.monthlyUnset]}>
                  {rupees(monthly) ?? 'Not set'}
                </Text>
              </View>
              {mode === 'owner' ? (
                <Pressable
                  style={styles.smallBtnGhost}
                  onPress={() => setEditingMonthly(monthly !== null ? String(monthly) : '')}
                  accessibilityLabel={monthly === null ? 'Set monthly salary' : 'Change monthly salary'}
                >
                  <Feather name="edit-2" size={13} color={T.inkSoft} />
                  <Text style={styles.smallBtnGhostText}>{monthly === null ? 'Set' : 'Change'}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : records.length === 0 ? (
        <Text style={styles.empty}>No salary history yet.</Text>
      ) : (
        records.map((r) => {
          const s = STATUS[r.status];
          const when =
            r.status === 'received' && r.received_at
              ? `Received ${format(new Date(r.received_at), 'd MMM')}`
              : r.status === 'paid' && r.paid_at
                ? `Paid ${format(new Date(r.paid_at), 'd MMM')}`
                : r.requested_at
                  ? `Asked ${format(new Date(r.requested_at), 'd MMM, h:mm a')}${r.expected_on ? ` · will be paid by ${format(parseISO(r.expected_on), 'd MMM')}` : ''}`
                  : '';
          return (
            <Pressable
              key={r.id}
              style={[styles.recordRow, r.month === selectedKey && styles.recordRowActive]}
              onPress={() => setMonth(new Date(`${r.month}T00:00:00`))}
            >
              <View style={[styles.recordIcon, { backgroundColor: s.bg }]}>
                <Feather name={s.icon} size={15} color={s.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.recordMonth}>
                  {salaryMonthLabel(r.month)}
                  {r.amount !== null && r.amount !== undefined ? (
                    <Text style={styles.recordAmount}>{`  ${rupees(r.amount)}`}</Text>
                  ) : null}
                </Text>
                {when ? <Text style={styles.recordWhen}>{when}</Text> : null}
              </View>
              <View style={[styles.chip, { backgroundColor: s.bg }]}>
                <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    marginBottom: 10,
  },
  notice: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.green,
    marginBottom: 10,
  },
  empty: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    textAlign: 'center',
    paddingVertical: 20,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 14,
  },
  recordRowActive: {
    backgroundColor: T.soft,
  },
  recordIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordMonth: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  recordWhen: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    marginTop: 1,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  chipText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  monthArrow: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCenter: {
    flex: 1,
    alignItems: 'center',
  },
  monthText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: T.ink,
  },
  monthState: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    marginTop: 1,
  },
  monthStateMute: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    marginTop: 1,
  },
  primary: {
    marginTop: 12,
    height: 46,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
  },
  recordAmount: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.inkSoft,
  },
  monthlyCard: {
    backgroundColor: T.soft,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
  monthlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthlyLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: T.mute,
  },
  monthlyValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: T.ink,
    marginTop: 2,
  },
  monthlyUnset: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.mute,
  },
  monthlyEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  rupee: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.inkSoft,
  },
  payRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  payLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
    marginRight: 4,
  },
  payInput: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    backgroundColor: T.card,
    borderWidth: 1,
    borderColor: T.soft2,
    paddingHorizontal: 12,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: T.ink,
  },
  smallBtn: {
    height: 38,
    minWidth: 64,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.white,
  },
  smallBtnGhost: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.card,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallBtnGhostText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
  },
  doneNote: {
    marginTop: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
    textAlign: 'center',
  },
});
