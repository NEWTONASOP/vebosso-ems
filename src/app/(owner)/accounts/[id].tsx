// ============================================================================
// VEBOSSO EMS — Owner Account ledger
// Date | Particular | Credit | Debit, newest first, with totals, a month filter
// and + to add an entry. Tap a row to edit or delete it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountExportSheet } from '../../../components/AccountExportSheet';
import { AccountFormSheet } from '../../../components/AccountFormSheet';
import { AccountImportSheet } from '../../../components/AccountImportSheet';
import { AccountPeriodFilter } from '../../../components/AccountPeriodFilter';
import { AccountTxnSheet } from '../../../components/AccountTxnSheet';
import { AppTheme as T, appShadow, appSoftShadow, screenChrome } from '../../../constants/theme';
import {
  fetchAccount,
  fetchAccounts,
  fetchSummaries,
  fetchTransactions,
  money,
  num,
  Period,
  periodLabel,
  rupees,
} from '../../../lib/accounts';
import { Account, AccountSummary, AccountTransaction } from '../../../types/database';

const load = async (id: string, period: Period) => {
  const [account, txns, summaries, accounts] = await Promise.all([
    fetchAccount(id),
    fetchTransactions(id, period),
    fetchSummaries(period),
    fetchAccounts(),
  ]);
  return { account, txns, summaries, accounts };
};

export default function AccountLedgerScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  /** Back to the Accounts list — never out to another tab. */
  const backToList = () => {
    const routes = navigation.getState()?.routes ?? [];
    if (routes.length > 1) navigation.goBack();
    else router.replace('/(owner)/accounts' as any);
  };
  const { id } = useLocalSearchParams<{ id: string }>();
  const [period, setPeriod] = useState<Period>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [txns, setTxns] = useState<AccountTransaction[]>([]);
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<'add' | 'edit-account' | 'export' | 'import' | null>(null);
  const [editing, setEditing] = useState<AccountTransaction | null>(null);
  const [snack, setSnack] = useState('');

  const apply = useCallback(
    (res: Awaited<ReturnType<typeof load>>) => {
      if (res.account.success) setAccount(res.account.data);
      if (res.txns.success) setTxns(res.txns.data);
      if (res.summaries.success) setSummary(res.summaries.data[id] ?? null);
      if (res.accounts.success) setAllAccounts(res.accounts.data);
      setError(!res.account.success ? res.account.error : !res.txns.success ? res.txns.error : '');
      setIsLoading(false);
    },
    [id]
  );

  const reload = useCallback(async () => {
    if (id) apply(await load(id, period));
  }, [apply, id, period]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      load(id, period).then((res) => active && apply(res));
      return () => {
        active = false;
      };
    }, [apply, id, period])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  };

  const totals = useMemo(() => {
    let credit = 0;
    let debit = 0;
    for (const t of txns) {
      if (t.kind === 'credit') credit += num(t.amount);
      else debit += num(t.amount);
    }
    return { credit, debit, balance: credit - debit };
  }, [txns]);

  const allTimeBalance = summary ? num(summary.total_credit) - num(summary.total_debit) : null;
  const onSaved = (m: string) => {
    setSnack(m);
    void reload();
  };

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.summary}>
        <View style={styles.sumCell}>
          <Text style={styles.sumLabel}>Credit</Text>
          <Text style={[styles.sumValue, { color: T.green }]} numberOfLines={1}>{rupees(totals.credit)}</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumCell}>
          <Text style={styles.sumLabel}>Debit</Text>
          <Text style={[styles.sumValue, { color: T.coral }]} numberOfLines={1}>{rupees(totals.debit)}</Text>
        </View>
        <View style={styles.sumDivider} />
        <View style={styles.sumCell}>
          <Text style={styles.sumLabel}>Balance</Text>
          <Text
            style={[styles.sumValue, { color: totals.balance < 0 ? T.coral : T.ink }]}
            numberOfLines={1}
          >
            {rupees(totals.balance)}
          </Text>
        </View>
      </View>
      {period && allTimeBalance !== null ? (
        <Text style={styles.allTime}>All-time balance {rupees(allTimeBalance)}</Text>
      ) : null}

      <AccountPeriodFilter period={period} onChange={setPeriod} />

      <View style={[styles.tr, styles.th]}>
        <Text style={[styles.thText, styles.cDate]}>Date</Text>
        <Text style={[styles.thText, styles.cPart]}>Particular</Text>
        <Text style={[styles.thText, styles.cNum]}>Credit(₹)</Text>
        <Text style={[styles.thText, styles.cNum]}>Debit(₹)</Text>
      </View>
    </View>
  );

  const footer =
    txns.length > 0 ? (
      <View style={styles.tfoot}>
        <View style={styles.tr}>
          <View style={styles.cDate} />
          <Text style={[styles.tfText, styles.cPart]}>Total</Text>
          <Text style={[styles.tfText, styles.cNum, { color: T.green }]}>{money(totals.credit)}</Text>
          <Text style={[styles.tfText, styles.cNum, { color: T.coral }]}>{money(totals.debit)}</Text>
        </View>
        <View style={styles.tr}>
          <View style={styles.cDate} />
          <Text style={[styles.tfText, styles.cPart]}>Balance</Text>
          <Text style={[styles.tfText, styles.cBal, { color: totals.balance < 0 ? T.coral : T.ink }]}>
            {rupees(totals.balance)}
          </Text>
        </View>
      </View>
    ) : null;

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={styles.titleRow}>
          <Pressable onPress={backToList} style={styles.back} hitSlop={8} accessibilityLabel="Back to accounts">
            <Feather name="chevron-left" size={24} color={T.ink} />
          </Pressable>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{account?.name ?? ' '}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>
              {account?.note || `${txns.length} entr${txns.length === 1 ? 'y' : 'ies'} · ${periodLabel(period)}`}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setSheet('import')} accessibilityLabel="Import into this account">
            <Feather name="download" size={16} color={T.ink} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => account && setSheet('export')} accessibilityLabel="Export">
            <Feather name="share" size={16} color={T.ink} />
          </Pressable>
          <Pressable style={styles.iconBtn} onPress={() => account && setSheet('edit-account')} accessibilityLabel="Edit account">
            <Feather name="more-horizontal" size={16} color={T.ink} />
          </Pressable>
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={txns}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {period ? `No entries in ${periodLabel(period)}` : 'No entries yet — tap + to add one'}
              </Text>
            </View>
          }
          contentContainerStyle={[styles.list, { paddingBottom: 150 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
          renderItem={({ item, index }) => {
            const color = item.kind === 'credit' ? T.green : T.coral;
            return (
              <Pressable
                onPress={() => setEditing(item)}
                style={({ pressed }) => [styles.tr, styles.td, index % 2 === 1 && styles.tdAlt, pressed && styles.tdPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${item.kind} ${money(item.amount)} on ${item.txn_date}, ${item.particular ?? ''}`}
              >
                <Text style={[styles.tdText, styles.cDate, { color }]}>{format(parseISO(item.txn_date), 'dd-MM-yyyy')}</Text>
                <Text style={[styles.tdText, styles.cPart, { color }]}>{item.particular || '—'}</Text>
                <Text style={[styles.tdText, styles.cNum]}>{item.kind === 'credit' ? money(item.amount) : '0'}</Text>
                <Text style={[styles.tdText, styles.cNum]}>{item.kind === 'debit' ? money(item.amount) : '0'}</Text>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable
        style={[styles.fab, { bottom: 100 + insets.bottom }]}
        onPress={() => setSheet('add')}
        accessibilityRole="button"
        accessibilityLabel="Add entry"
      >
        <Feather name="plus" size={24} color={T.white} />
      </Pressable>

      {account && (sheet === 'add' || editing) ? (
        <AccountTxnSheet
          accountId={account.id}
          accountName={account.name}
          txn={editing}
          onDismiss={() => {
            setSheet(null);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      ) : null}
      {account && sheet === 'edit-account' ? (
        <AccountFormSheet
          account={account}
          onDismiss={() => setSheet(null)}
          onSaved={(a, m) => {
            if (a) setAccount(a);
            setSnack(m);
          }}
          onDeleted={backToList}
        />
      ) : null}
      {account && sheet === 'export' ? (
        <AccountExportSheet accounts={[account]} period={period} onDismiss={() => setSheet(null)} />
      ) : null}
      {account && sheet === 'import' ? (
        <AccountImportSheet
          accounts={allAccounts}
          target={account}
          onDismiss={() => setSheet(null)}
          onDone={onSaved}
        />
      ) : null}

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  back: { width: 32, height: 40, justifyContent: 'center', marginLeft: -8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: T.ink, letterSpacing: -0.5 },
  subtitle: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.mute, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...appSoftShadow,
  },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, paddingHorizontal: 20 },
  list: { paddingHorizontal: 16, maxWidth: 800, width: '100%', alignSelf: 'center' },
  headerBlock: { gap: 12, marginBottom: 0 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    ...appSoftShadow,
  },
  sumCell: { flex: 1, alignItems: 'center' },
  sumDivider: { width: 1, height: 28, backgroundColor: T.hairline },
  sumLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.mute },
  sumValue: { fontFamily: 'Inter_700Bold', fontSize: 15.5, marginTop: 2 },
  allTime: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.mute, textAlign: 'center', marginTop: -4 },
  tr: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 10 },
  th: {
    backgroundColor: T.charcoal,
    paddingVertical: 10,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    marginTop: 4,
  },
  thText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: T.white },
  td: {
    backgroundColor: T.card,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  tdAlt: { backgroundColor: '#FAFBFC' },
  tdPressed: { backgroundColor: T.soft },
  tdText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.ink, lineHeight: 18 },
  cDate: { width: 84 },
  cPart: { flex: 1, paddingRight: 8, textAlign: 'center' },
  cNum: { width: 78, textAlign: 'right' },
  cBal: { width: 156, textAlign: 'right' },
  tfoot: {
    backgroundColor: T.soft,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingVertical: 6,
    ...appSoftShadow,
  },
  tfText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.ink, paddingVertical: 4 },
  empty: {
    backgroundColor: T.card,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute },
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    ...appShadow,
  },
});
