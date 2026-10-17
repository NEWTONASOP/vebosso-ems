// ============================================================================
// VEBOSSO EMS — Owner Account ledger
// Newest first, with totals, a month filter and + to add an entry. On a phone
// each entry is a card (particular, date, signed amount); on a wide screen it
// is the Date | Particular | Credit | Debit table. Tap an entry to edit it.
// An owner looking at someone else's books (044) can only view and export.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AccountExportSheet } from '../../../components/AccountExportSheet';
import { AccountFormSheet } from '../../../components/AccountFormSheet';
import { AccountImportSheet } from '../../../components/AccountImportSheet';
import { AccountMoveSheet } from '../../../components/AccountMoveSheet';
import { AccountPeriodFilter } from '../../../components/AccountPeriodFilter';
import { AccountTxnSheet } from '../../../components/AccountTxnSheet';
import { AppTheme as T, appShadow, appSoftShadow, screenChrome } from '../../../constants/theme';
import { Alert } from '../../../lib/alert';
import {
  fetchAccount,
  fetchAccounts,
  fetchSummaries,
  fetchTransactions,
  money,
  moveTransactions,
  num,
  Period,
  periodLabel,
  rupees,
  viewOnlyOwner,
} from '../../../lib/accounts';
import { useFeatureBase } from '../../../lib/featureAccess';
import { useAuthStore } from '../../../store/authStore';
import { Account, AccountSummary, AccountTransaction } from '../../../types/database';

const load = async (id: string, period: Period, owner: { id: string } | null) => {
  const [account, txns, summaries, accounts] = await Promise.all([
    fetchAccount(id),
    fetchTransactions(id, period),
    fetchSummaries(period),
    fetchAccounts(),
  ]);
  const viewOnlyOf = owner && account.success ? await viewOnlyOwner(account.data, owner.id) : null;
  return { account, txns, summaries, accounts, viewOnlyOf };
};

export default function AccountLedgerScreen() {
  const router = useRouter();
  const base = useFeatureBase('accounts');
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Below this the four-column table gets cramped, so entries become cards.
  const wide = useWindowDimensions().width >= 640;

  /** Back to the Accounts list — never out to another tab. */
  const backToList = () => {
    const routes = navigation.getState()?.routes ?? [];
    if (routes.length > 1) navigation.goBack();
    else router.replace(base as any);
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
  const [sheet, setSheet] = useState<'add' | 'edit-account' | 'export' | 'import' | 'move' | null>(null);
  // Picking entries to move: long-press one (or the tick button), then tap more.
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [moving, setMoving] = useState(false);
  const [editing, setEditing] = useState<AccountTransaction | null>(null);
  const [snack, setSnack] = useState('');
  const me = useAuthStore((s) => s.profile);
  /** Whose books this is when it isn't the viewer's own — view only. */
  const [viewOnlyOf, setViewOnlyOf] = useState<string | null>(null);
  const viewOnly = !!viewOnlyOf;
  // Only an owner can be looking at someone else's books.
  const owner = useMemo(() => (me?.role === 'owner' ? { id: me.id } : null), [me?.id, me?.role]);

  const apply = useCallback(
    (res: Awaited<ReturnType<typeof load>>) => {
      if (res.account.success) setAccount(res.account.data);
      setViewOnlyOf(res.viewOnlyOf);
      if (res.txns.success) setTxns(res.txns.data);
      if (res.summaries.success) setSummary(res.summaries.data[id] ?? null);
      if (res.accounts.success) setAllAccounts(res.accounts.data);
      setError(!res.account.success ? res.account.error : !res.txns.success ? res.txns.error : '');
      setIsLoading(false);
    },
    [id]
  );

  const reload = useCallback(async () => {
    if (id) apply(await load(id, period, owner));
  }, [apply, id, period, owner]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      load(id, period, owner).then((res) => active && apply(res));
      return () => {
        active = false;
      };
    }, [apply, id, period, owner])
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

  const toggle = (txnId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(txnId)) next.delete(txnId);
      else next.add(txnId);
      return next;
    });
  const startSelecting = (txnId?: string) => {
    setSelecting(true);
    if (txnId) setSelected(new Set([txnId]));
  };
  const stopSelecting = () => {
    setSelecting(false);
    setSelected(new Set());
  };
  const allSelected = txns.length > 0 && selected.size === txns.length;
  /** A tap: pick / unpick while selecting, otherwise open the entry. */
  const tapEntry = (t: AccountTransaction) => (selecting ? toggle(t.id) : setEditing(t));
  /** A long press starts picking, with this entry already ticked. */
  const holdEntry = (t: AccountTransaction) => {
    if (!viewOnly && !selecting) startSelecting(t.id);
  };

  const confirmMove = (target: Account) => {
    const chosen = txns.filter((t) => selected.has(t.id));
    if (chosen.length === 0) return;
    Alert.alert(
      `Move ${chosen.length} entr${chosen.length === 1 ? 'y' : 'ies'}?`,
      `They go to "${target.name}", with their receipt photos. Both accounts' totals change.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move',
          onPress: async () => {
            setMoving(true);
            const res = await moveTransactions(chosen, target.id);
            setMoving(false);
            if (!res.success) {
              setError(res.error);
              setSheet(null);
              void reload();
              return;
            }
            setSheet(null);
            stopSelecting();
            const { moved, failed } = res.data;
            setSnack(
              failed
                ? `Moved ${moved} to ${target.name}; ${failed} couldn't be moved (receipt photos) and stayed here`
                : `Moved ${moved} entr${moved === 1 ? 'y' : 'ies'} to ${target.name}`
            );
            void reload();
          },
        },
      ]
    );
  };

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

      {wide ? (
        <View style={[styles.tr, styles.th]}>
          <Text style={[styles.thText, styles.cDate]}>Date</Text>
          <Text style={[styles.thText, styles.cPart]}>Particular</Text>
          <Text style={[styles.thText, styles.cNum]}>Credit(₹)</Text>
          <Text style={[styles.thText, styles.cNum]}>Debit(₹)</Text>
        </View>
      ) : null}
    </View>
  );

  const footer =
    txns.length > 0 && wide ? (
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
              {viewOnly
                ? `${viewOnlyOf}'s books · view only`
                : account?.note || `${txns.length} entr${txns.length === 1 ? 'y' : 'ies'} · ${periodLabel(period)}`}
            </Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          {!viewOnly && txns.length > 0 ? (
            <Pressable
              style={[styles.iconBtn, selecting && { backgroundColor: T.soft2 }]}
              onPress={() => (selecting ? stopSelecting() : startSelecting())}
              accessibilityLabel="Select entries to move"
            >
              <Feather name="check-square" size={16} color={T.ink} />
            </Pressable>
          ) : null}
          {!viewOnly ? (
            <Pressable style={styles.iconBtn} onPress={() => setSheet('import')} accessibilityLabel="Import into this account">
              <Feather name="download" size={16} color={T.ink} />
            </Pressable>
          ) : null}
          <Pressable style={styles.iconBtn} onPress={() => account && setSheet('export')} accessibilityLabel="Export">
            <Feather name="share" size={16} color={T.ink} />
          </Pressable>
          {!viewOnly ? (
            <Pressable style={styles.iconBtn} onPress={() => account && setSheet('edit-account')} accessibilityLabel="Edit account">
              <Feather name="more-horizontal" size={16} color={T.ink} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {selecting ? (
        <View style={styles.selBar}>
          <Text style={styles.selCount}>
            {selected.size ? `${selected.size} selected` : 'Tap entries to select'}
          </Text>
          <Pressable
            style={styles.selBtn}
            onPress={() => setSelected(allSelected ? new Set() : new Set(txns.map((t) => t.id)))}
            accessibilityRole="button"
          >
            <Text style={styles.selBtnText}>{allSelected ? 'Clear' : 'Select all'}</Text>
          </Pressable>
          <Pressable
            style={[styles.selBtn, styles.selMove, !selected.size && { opacity: 0.4 }]}
            onPress={() => setSheet('move')}
            disabled={!selected.size}
            accessibilityRole="button"
          >
            <Feather name="corner-up-right" size={14} color={T.white} />
            <Text style={[styles.selBtnText, { color: T.white }]}>Move</Text>
          </Pressable>
          <Pressable style={styles.selClose} onPress={stopSelecting} hitSlop={8} accessibilityLabel="Cancel selecting">
            <Feather name="x" size={18} color={T.inkSoft} />
          </Pressable>
        </View>
      ) : null}

      {isLoading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={txns}
          extraData={selected}
          keyExtractor={(t) => t.id}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ListEmptyComponent={
            <View style={[styles.empty, !wide && styles.emptyCard]}>
              <Text style={styles.emptyText}>
                {period
                  ? `No entries in ${periodLabel(period)}`
                  : viewOnly
                    ? 'No entries yet'
                    : 'No entries yet — tap + to add one'}
              </Text>
            </View>
          }
          contentContainerStyle={[styles.list, { paddingBottom: 150 + insets.bottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
          renderItem={({ item, index }) => {
            const color = item.kind === 'credit' ? T.green : T.coral;
            const photos = item.receipts?.length ?? 0;
            const picked = selected.has(item.id);
            if (!wide) {
              const credit = item.kind === 'credit';
              return (
                <Pressable
                  onPress={() => tapEntry(item)}
                  onLongPress={() => holdEntry(item)}
                  style={({ pressed }) => [styles.entry, picked && styles.picked, pressed && styles.tdPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.kind} ${money(item.amount)} on ${item.txn_date}, ${item.particular ?? ''}`}
                >
                  {selecting ? (
                    <View style={[styles.entryIcon, { backgroundColor: picked ? T.charcoal : T.soft }]}>
                      {picked ? <Feather name="check" size={16} color={T.white} /> : null}
                    </View>
                  ) : (
                    <View style={[styles.entryIcon, { backgroundColor: credit ? T.greenSoft : T.coralSoft }]}>
                      <Feather name={credit ? 'arrow-down-left' : 'arrow-up-right'} size={15} color={color} />
                    </View>
                  )}
                  <View style={styles.entryText}>
                    <Text style={styles.entryTitle} numberOfLines={1}>
                      {item.particular || (credit ? 'Credit' : 'Debit')}
                    </Text>
                    <View style={styles.entryMetaRow}>
                      <Text style={styles.entryMeta}>{format(parseISO(item.txn_date), 'd MMM yyyy')}</Text>
                      {photos ? (
                        <View style={styles.entryClip}>
                          <Feather name="paperclip" size={11} color={T.mute} />
                          <Text style={styles.entryMeta}>{photos}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <Text style={[styles.entryAmount, { color }]} numberOfLines={1}>
                    {credit ? '+' : '−'} ₹{money(item.amount)}
                  </Text>
                </Pressable>
              );
            }
            return (
              <Pressable
                onPress={() => tapEntry(item)}
                onLongPress={() => holdEntry(item)}
                style={({ pressed }) => [styles.tr, styles.td, index % 2 === 1 && styles.tdAlt, picked && styles.picked, pressed && styles.tdPressed]}
                accessibilityRole="button"
                accessibilityLabel={`${item.kind} ${money(item.amount)} on ${item.txn_date}, ${item.particular ?? ''}`}
              >
                <Text style={[styles.tdText, styles.cDate, { color }]}>
                  {picked ? '✓ ' : ''}
                  {format(parseISO(item.txn_date), 'dd-MM-yyyy')}
                </Text>
                <Text style={[styles.tdText, styles.cPart, { color }]}>
                  {item.particular || '—'}
                  {photos ? <Text style={styles.clip}>{`  📎${photos}`}</Text> : null}
                </Text>
                <Text style={[styles.tdText, styles.cNum]}>{item.kind === 'credit' ? money(item.amount) : '0'}</Text>
                <Text style={[styles.tdText, styles.cNum]}>{item.kind === 'debit' ? money(item.amount) : '0'}</Text>
              </Pressable>
            );
          }}
        />
      )}

      {!viewOnly && !selecting ? (
        <Pressable
          style={[styles.fab, { bottom: 100 + insets.bottom }]}
          onPress={() => setSheet('add')}
          accessibilityRole="button"
          accessibilityLabel="Add entry"
        >
          <Feather name="plus" size={24} color={T.white} />
        </Pressable>
      ) : null}

      {account && (sheet === 'add' || editing) ? (
        <AccountTxnSheet
          accountId={account.id}
          accountName={account.name}
          txn={editing}
          viewOnly={viewOnly}
          onDismiss={() => {
            setSheet(null);
            setEditing(null);
          }}
          onSaved={onSaved}
        />
      ) : null}
      {account && sheet === 'edit-account' && !viewOnly ? (
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
      {account && sheet === 'move' && !viewOnly ? (
        <AccountMoveSheet
          fromAccountId={account.id}
          count={selected.size}
          busy={moving}
          onPick={confirmMove}
          onDismiss={() => setSheet(null)}
        />
      ) : null}
      {account && sheet === 'export' ? (
        <AccountExportSheet accounts={[account]} period={period} onDismiss={() => setSheet(null)} />
      ) : null}
      {account && sheet === 'import' && !viewOnly ? (
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
  emptyCard: { borderRadius: 18, marginTop: 4 },
  clip: { fontSize: 11, color: T.mute },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.card,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginTop: 5,
    ...appSoftShadow,
  },
  entryIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryText: { flex: 1, minWidth: 0 },
  entryTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.ink, lineHeight: 17 },
  entryMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 0 },
  entryMeta: { fontFamily: 'Inter_400Regular', fontSize: 11, color: T.mute },
  entryClip: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  entryAmount: { fontFamily: 'Inter_700Bold', fontSize: 14, flexShrink: 0 },
  picked: { backgroundColor: T.blueSoft },
  selBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: T.card,
    ...appSoftShadow,
  },
  selCount: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  selBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.soft,
  },
  selMove: { backgroundColor: T.charcoal },
  selBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.ink },
  selClose: { width: 30, height: 34, alignItems: 'center', justifyContent: 'center' },
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
