// ============================================================================
// VEBOSSO EMS — Salary Sheet
// Salary is paid outside the app; this is the Requested → Paid → Received
// conversation for one person, month by month.
//   self:  ask for a month's salary (or remind), confirm received.
//   owner: mark a month paid — on a request, or for any month directly.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addMonths, format, isAfter, startOfMonth, subMonths } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  fetchSalaryRequests,
  markSalaryPaid,
  markSalaryReceived,
  requestSalary,
  salaryMonthLabel,
} from '../lib/employeeRecords';
import { SalaryRequest, SalaryStatus } from '../types/database';
import { SheetFrame } from './SheetFrame';

interface SalarySheetProps {
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

export function SalarySheet({ visible, onDismiss, userId, userName, mode, ownerId }: SalarySheetProps) {
  const [records, setRecords] = useState<SalaryRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Salary usually lands at the start of the next month, so default to last month.
  const [month, setMonth] = useState(() => startOfMonth(subMonths(new Date(), 1)));

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchSalaryRequests>>) => {
    if (res.success) setRecords(res.data);
    else setError(res.error);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await fetchSalaryRequests(userId)), [apply, userId]);

  // Mounted only while open, so this loads once on open.
  useEffect(() => {
    let active = true;
    fetchSalaryRequests(userId).then((res) => active && apply(res));
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
  };

  const handleSelfAsk = () =>
    run(
      'ask',
      () => requestSalary(userId, selectedKey),
      selectedRecord ? 'Reminder sent to the boss' : 'Request sent to the boss',
    );

  const confirmPaid = (monthIso: string) => {
    if (!ownerId) return;
    Alert.alert(
      'Mark as paid?',
      `${userName} will be told the ${salaryMonthLabel(monthIso)} salary is paid.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark paid',
          onPress: () => run(monthIso, () => markSalaryPaid(userId, monthIso, ownerId), 'Marked as paid'),
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
                  ? `Asked ${format(new Date(r.requested_at), 'd MMM, h:mm a')}`
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
                <Text style={styles.recordMonth}>{salaryMonthLabel(r.month)}</Text>
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
  doneNote: {
    marginTop: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
    textAlign: 'center',
  },
});
