// ============================================================================
// VEBOSSO EMS — Owner Bills (list)
// Estimates | Client bills, filtered by status, with drafts and trash.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { BillSettingsSheet } from '../../../components/BillSettingsSheet';
import { AppTheme as T, appSoftShadow, screenChrome } from '../../../constants/theme';
import { rupees } from '../../../lib/accounts';
import { BILL_STATUS_TONE, billTotals, fetchBills, STATUS_LABEL } from '../../../lib/bills';
import { Bill, BillKind, BillStatus } from '../../../types/database';

type Filter = 'all' | BillStatus;

const FILTERS: Record<BillKind, Filter[]> = {
  estimate: ['all', 'draft', 'trash'],
  client: ['all', 'pending', 'done', 'completed', 'draft', 'trash'],
};

export default function OwnerBillsScreen() {
  const router = useRouter();
  const [kind, setKind] = useState<BillKind>('estimate');
  const [filter, setFilter] = useState<Filter>('all');
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [snack, setSnack] = useState('');

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchBills>>) => {
    if (res.success) {
      setBills(res.data);
      setError('');
    } else setError(res.error);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchBills().then((res) => active && apply(res));
      return () => {
        active = false;
      };
    }, [apply])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    apply(await fetchBills());
    setRefreshing(false);
  };

  const ofKind = useMemo(() => bills.filter((b) => b.kind === kind), [bills, kind]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const b of ofKind) {
      c[b.status] = (c[b.status] ?? 0) + 1;
      if (b.status !== 'draft' && b.status !== 'trash') c.all++;
    }
    return c;
  }, [ofKind]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ofKind
      .filter((b) => (filter === 'all' ? b.status !== 'draft' && b.status !== 'trash' : b.status === filter))
      .filter(
        (b) =>
          !q ||
          [b.number, b.client_name, b.venue, b.phone, b.event_type].some((f) => f?.toLowerCase().includes(q))
      );
  }, [ofKind, filter, query]);

  const switchKind = (k: BillKind) => {
    setKind(k);
    setFilter('all');
  };

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={{ flexShrink: 1 }}>
          <Text style={screenChrome.title}>Bills</Text>
          <Text style={screenChrome.subtitle}>Estimates and client bills</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setSettingsOpen(true)} accessibilityLabel="Bill settings">
            <Feather name="settings" size={17} color={T.ink} />
          </Pressable>
          <Pressable
            style={styles.newBtn}
            onPress={() => router.push(`/(owner)/bills/new?kind=${kind}` as any)}
            accessibilityLabel={`New ${kind === 'client' ? 'client bill' : 'estimate'}`}
          >
            <Feather name="plus" size={16} color={T.white} />
            <Text style={styles.newText}>New</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.segment}>
        {(['estimate', 'client'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => switchKind(k)}
            style={[styles.segBtn, kind === k && styles.segActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === k }}
          >
            <Text style={[styles.segText, kind === k && styles.segTextActive]}>
              {k === 'estimate' ? 'Estimates' : 'Client bills'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipsWrap}
        contentContainerStyle={styles.chips}
      >
        {FILTERS[kind].map((f) => {
          const active = filter === f;
          const n = counts[f] ?? 0;
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, active && styles.chipActive]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'draft' ? 'Drafts' : STATUS_LABEL[f]}
                {n ? <Text style={[styles.chipCount, active && styles.chipTextActive]}> {n}</Text> : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.search}>
        <Feather name="search" size={16} color={T.mute} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, number, venue, phone"
          placeholderTextColor={T.mute}
          style={styles.searchInput}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isLoading ? (
          <ActivityIndicator color={T.charcoal} style={{ marginTop: 32 }} />
        ) : shown.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="file-text" size={26} color={T.mute} />
            <Text style={styles.emptyText}>
              {filter === 'draft'
                ? 'No drafts'
                : filter === 'trash'
                  ? 'Trash is empty'
                  : `No ${kind === 'client' ? 'client bills' : 'estimates'} yet`}
            </Text>
          </View>
        ) : (
          shown.map((b) => {
            const t = billTotals(b);
            const tone = BILL_STATUS_TONE[b.status];
            return (
              <Pressable
                key={b.id}
                onPress={() => router.push(`/(owner)/bills/${b.id}` as any)}
                style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel={`${b.number ?? 'Draft'} ${b.client_name ?? ''}`}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.number}>{b.number ?? 'Draft'}</Text>
                  {kind === 'client' || b.status === 'draft' || b.status === 'trash' ? (
                    <View style={[styles.status, { backgroundColor: tone.bg }]}>
                      <Text style={[styles.statusText, { color: tone.color }]}>{STATUS_LABEL[b.status]}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.client} numberOfLines={1}>{b.client_name || 'No name yet'}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[
                    b.event_type,
                    b.function_date ? format(parseISO(b.function_date), 'd MMM yyyy') : null,
                    b.venue,
                  ]
                    .filter(Boolean)
                    .join(' · ') || `Edited ${format(new Date(b.updated_at), 'd MMM, h:mm a')}`}
                </Text>
                <View style={styles.money}>
                  <Text style={styles.moneyText}>Total {rupees(t.total)}</Text>
                  <Text style={[styles.moneyText, { color: t.balance > 0 ? T.coral : T.green }]}>
                    Balance {rupees(t.balance)}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {settingsOpen ? <BillSettingsSheet onDismiss={() => setSettingsOpen(false)} onSaved={setSnack} /> : null}
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
  newBtn: {
    height: 42,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    ...appSoftShadow,
  },
  newText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.white },
  segment: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: T.soft2,
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segBtn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: T.card, ...appSoftShadow },
  segText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.inkSoft },
  segTextActive: { color: T.ink },
  chipsWrap: { flexGrow: 0, marginTop: 12 },
  chips: { gap: 8, paddingHorizontal: 20 },
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.card,
    justifyContent: 'center',
    ...appSoftShadow,
  },
  chipActive: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipCount: { fontFamily: 'Inter_500Medium', color: T.mute },
  chipTextActive: { color: T.white },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    backgroundColor: T.card,
    ...appSoftShadow,
  },
  searchInput: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink },
  body: { padding: 20, paddingBottom: 130, gap: 10, maxWidth: 700, width: '100%', alignSelf: 'center' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyText: { fontFamily: 'Inter_500Medium', fontSize: 14, color: T.mute },
  card: { backgroundColor: T.card, borderRadius: 18, padding: 14, gap: 3, ...appSoftShadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  number: { fontFamily: 'Inter_700Bold', fontSize: 12.5, color: T.mute, letterSpacing: 0.4 },
  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9 },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  client: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.mute },
  money: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  moneyText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
});
