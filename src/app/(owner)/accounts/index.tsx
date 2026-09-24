// ============================================================================
// VEBOSSO EMS — Owner Accounts (list)
// Master credit / debit / balance across every account, a month filter, and
// the accounts themselves. Owner only (RLS).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AccountExportSheet } from '../../../components/AccountExportSheet';
import { AccountFormSheet } from '../../../components/AccountFormSheet';
import { AccountImportSheet } from '../../../components/AccountImportSheet';
import { AccountPeriodFilter } from '../../../components/AccountPeriodFilter';
import { AppTheme as T, appShadow, appSoftShadow, screenChrome } from '../../../constants/theme';
import { fetchAccounts, fetchSummaries, num, Period, periodLabel, rupees } from '../../../lib/accounts';
import { Account, AccountSummary } from '../../../types/database';

const loadAll = async (period: Period) => {
  const [accounts, summaries] = await Promise.all([fetchAccounts(), fetchSummaries(period)]);
  return { accounts, summaries };
};

export default function OwnerAccountsScreen() {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [summaries, setSummaries] = useState<Record<string, AccountSummary>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [sheet, setSheet] = useState<'new' | 'export' | 'import' | null>(null);
  const [snack, setSnack] = useState('');

  const apply = useCallback((res: Awaited<ReturnType<typeof loadAll>>) => {
    if (res.accounts.success) setAccounts(res.accounts.data);
    if (res.summaries.success) setSummaries(res.summaries.data);
    const err = !res.accounts.success ? res.accounts.error : !res.summaries.success ? res.summaries.error : '';
    setError(err);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await loadAll(period)), [apply, period]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadAll(period).then((res) => active && apply(res));
      return () => {
        active = false;
      };
    }, [apply, period])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const master = useMemo(() => {
    let credit = 0;
    let debit = 0;
    let allCredit = 0;
    let allDebit = 0;
    for (const s of Object.values(summaries)) {
      credit += num(s.period_credit);
      debit += num(s.period_debit);
      allCredit += num(s.total_credit);
      allDebit += num(s.total_debit);
    }
    return { credit, debit, balance: credit - debit, allBalance: allCredit - allDebit };
  }, [summaries]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q ? accounts.filter((a) => a.name.toLowerCase().includes(q)) : accounts;
    // Most recently active first; never-used accounts last, by name.
    return [...filtered].sort((a, b) => {
      const da = summaries[a.id]?.last_txn_date ?? '';
      const db = summaries[b.id]?.last_txn_date ?? '';
      if (da !== db) return db.localeCompare(da);
      return a.name.localeCompare(b.name);
    });
  }, [accounts, summaries, query]);

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={screenChrome.title}>Accounts</Text>
          <Text style={screenChrome.subtitle}>
            {isLoading ? 'Loading…' : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setSheet('import')} accessibilityLabel="Import">
            <Feather name="download" size={17} color={T.ink} />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, accounts.length === 0 && { opacity: 0.4 }]}
            onPress={() => accounts.length && setSheet('export')}
            accessibilityLabel="Export all accounts"
          >
            <Feather name="share" size={17} color={T.ink} />
          </Pressable>
          <Pressable style={styles.addBtn} onPress={() => setSheet('new')} accessibilityLabel="New account">
            <Feather name="plus" size={18} color={T.white} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
        keyboardShouldPersistTaps="handled"
      >
        <AccountPeriodFilter period={period} onChange={setPeriod} />

        {/* Master balance */}
        <View style={styles.master}>
          <View style={styles.masterGlow} />
          <Text style={styles.masterEyebrow}>{periodLabel(period)} · all accounts</Text>
          <Text style={[styles.masterBalance, master.balance < 0 && { color: T.onDarkAccent }]}>
            {rupees(master.balance)}
          </Text>
          <Text style={styles.masterBalanceLabel}>Balance (credit − debit)</Text>
          <View style={styles.masterRow}>
            <View style={styles.masterCell}>
              <Text style={styles.masterCellLabel}>Credit</Text>
              <Text style={[styles.masterCellValue, { color: '#7BE0B5' }]}>{rupees(master.credit)}</Text>
            </View>
            <View style={styles.masterDivider} />
            <View style={styles.masterCell}>
              <Text style={styles.masterCellLabel}>Debit</Text>
              <Text style={[styles.masterCellValue, { color: '#FF9FAE' }]}>{rupees(master.debit)}</Text>
            </View>
          </View>
          {period ? (
            <Text style={styles.masterAllTime}>All-time balance {rupees(master.allBalance)}</Text>
          ) : null}
        </View>

        {accounts.length > 6 ? (
          <View style={styles.search}>
            <Feather name="search" size={16} color={T.mute} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search accounts"
              placeholderTextColor={T.mute}
              style={styles.searchInput}
            />
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={T.charcoal} style={{ marginTop: 32 }} />
        ) : accounts.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="book-open" size={26} color={T.mute} />
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptySub}>Create one, or import your existing books from Excel.</Text>
            <View style={styles.emptyActions}>
              <Pressable style={styles.emptyBtn} onPress={() => setSheet('import')}>
                <Text style={styles.emptyBtnText}>Import</Text>
              </Pressable>
              <Pressable style={[styles.emptyBtn, styles.emptyBtnDark]} onPress={() => setSheet('new')}>
                <Text style={[styles.emptyBtnText, { color: T.white }]}>New account</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.list}>
            {list.map((a, i) => {
              const s = summaries[a.id];
              const pc = num(s?.period_credit);
              const pd = num(s?.period_debit);
              const balance = pc - pd;
              const count = s?.entry_count ?? 0;
              return (
                <Pressable
                  key={a.id}
                  onPress={() => router.push(`/(owner)/accounts/${a.id}` as any)}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowDivider, pressed && styles.rowPressed]}
                  accessibilityRole="button"
                  accessibilityLabel={`${a.name}, balance ${rupees(balance)}`}
                >
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{a.name.substring(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.name} numberOfLines={1}>{a.name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>
                      {count === 0
                        ? 'No entries yet'
                        : `${count} entr${count === 1 ? 'y' : 'ies'}${s?.last_txn_date ? ` · last ${format(parseISO(s.last_txn_date), 'd MMM yyyy')}` : ''}`}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.balance, { color: balance < 0 ? T.coral : balance > 0 ? T.green : T.inkSoft }]}>
                      {rupees(balance)}
                    </Text>
                    {pc || pd ? (
                      <Text style={styles.cd}>
                        <Text style={{ color: T.green }}>+{rupees(pc)}</Text>
                        <Text style={{ color: T.mute }}> / </Text>
                        <Text style={{ color: T.coral }}>−{rupees(pd)}</Text>
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      {sheet === 'new' ? (
        <AccountFormSheet
          onDismiss={() => setSheet(null)}
          onSaved={(account, m) => {
            setSnack(m);
            void load();
            if (account) router.push(`/(owner)/accounts/${account.id}` as any);
          }}
        />
      ) : null}
      {sheet === 'export' ? (
        <AccountExportSheet accounts={list.length ? list : accounts} period={period} onDismiss={() => setSheet(null)} />
      ) : null}
      {sheet === 'import' ? (
        <AccountImportSheet
          accounts={accounts}
          onDismiss={() => setSheet(null)}
          onDone={(m) => {
            setSnack(m);
            void load();
          }}
        />
      ) : null}

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...appSoftShadow,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
    ...appSoftShadow,
  },
  body: { paddingHorizontal: 20, paddingBottom: 130, gap: 14, maxWidth: 700, width: '100%', alignSelf: 'center' },
  master: {
    backgroundColor: T.charcoal,
    borderRadius: 22,
    padding: 18,
    overflow: 'hidden',
    ...appShadow,
  },
  masterGlow: {
    position: 'absolute',
    top: -60,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  masterEyebrow: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: 'rgba(255,255,255,0.6)' },
  masterBalance: { fontFamily: 'Inter_800ExtraBold', fontSize: 32, color: T.white, letterSpacing: -1, marginTop: 6 },
  masterBalanceLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 },
  masterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
  },
  masterCell: { flex: 1 },
  masterDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 12 },
  masterCellLabel: { fontFamily: 'Inter_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.55)' },
  masterCellValue: { fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 2 },
  masterAllTime: { fontFamily: 'Inter_500Medium', fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 12 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: T.card,
    ...appSoftShadow,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 36 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink, marginTop: 6 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute, textAlign: 'center' },
  emptyActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  emptyBtn: { height: 42, paddingHorizontal: 18, borderRadius: 999, backgroundColor: T.card, justifyContent: 'center', ...appSoftShadow },
  emptyBtnDark: { backgroundColor: T.charcoal },
  emptyBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  list: { backgroundColor: T.card, borderRadius: 20, overflow: 'hidden', ...appSoftShadow },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.hairline },
  rowPressed: { backgroundColor: T.soft },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: T.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.violet },
  name: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 2 },
  balance: { fontFamily: 'Inter_700Bold', fontSize: 15 },
  cd: { fontFamily: 'Inter_500Medium', fontSize: 11.5, marginTop: 2 },
});
