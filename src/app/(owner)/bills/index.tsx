// ============================================================================
// VEBOSSO EMS — Bills (list)
// VEBOSSO | Navgrah, then Estimates | Client bills, filtered by status, with
// drafts and trash. The brand picked here is the one new bills are made for.
// Shared
// by the owner (a tab) and anyone given Bills (opened from their home). Only
// the owner sees the completed-bills total.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SmoothTextInput as TextInput } from '../../../components/SmoothTextInput';
import { Snackbar, Text } from 'react-native-paper';
import { BillSettingsSheet } from '../../../components/BillSettingsSheet';
import { AppTheme as T, appSoftShadow, screenChrome } from '../../../constants/theme';
import { rupees } from '../../../lib/accounts';
import { BRAND_KEYS, BRANDS, brandOf } from '../../../lib/billBrands';
import { BILL_STATUS_TONE, billTotals, fetchBills, STATUS_LABEL } from '../../../lib/bills';
import { useFeatureBase } from '../../../lib/featureAccess';
import { useAuthStore } from '../../../store/authStore';
import { Bill, BillBrand, BillKind, BillStatus } from '../../../types/database';

type Filter = 'all' | BillStatus;

const FILTERS: Record<BillKind, Filter[]> = {
  estimate: ['all', 'draft', 'trash'],
  client: ['all', 'pending', 'completed', 'draft', 'trash'],
};

// Remembered while the app is open, so coming back to Bills keeps the brand.
const remembered: { brand: BillBrand } = { brand: 'vebosso' };
const rememberBrand = (b: BillBrand) => {
  remembered.brand = b;
};

export default function BillsScreen() {
  const router = useRouter();
  const base = useFeatureBase('bills');
  const isOwner = useAuthStore((s) => s.profile?.role === 'owner');
  const [brand, setBrandState] = useState<BillBrand>(() => remembered.brand);
  const setBrand = (b: BillBrand) => {
    rememberBrand(b);
    setBrandState(b);
  };
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

  const ofBrand = useMemo(() => bills.filter((b) => brandOf(b) === brand), [bills, brand]);
  const ofKind = useMemo(() => ofBrand.filter((b) => b.kind === kind), [ofBrand, kind]);

  // Owner only: every completed client bill of this brand, all time.
  const completed = useMemo(() => {
    const done = ofBrand.filter((b) => b.kind === 'client' && b.status === 'completed');
    return { count: done.length, total: done.reduce((sum, b) => sum + billTotals(b).total, 0) };
  }, [ofBrand]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    for (const b of ofKind) {
      c[b.status] = (c[b.status] ?? 0) + 1;
      if (b.status !== 'draft' && b.status !== 'trash') c.all++;
    }
    return c;
  }, [ofKind]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ofKind
      .filter((b) => (filter === 'all' ? b.status !== 'draft' && b.status !== 'trash' : b.status === filter))
      .filter(
        (b) =>
          !q ||
          [b.number, b.client_name, b.venue, b.phone, b.event_type].some((f) => f?.toLowerCase().includes(q))
      )
      // Nearest upcoming function first (today included); then past functions,
      // most recent first; bills without a date last, newest edit first.
      .sort((a, b) => {
        if (a.function_date && b.function_date) {
          const aUp = a.function_date >= today;
          const bUp = b.function_date >= today;
          if (aUp !== bUp) return aUp ? -1 : 1;
          if (a.function_date !== b.function_date) {
            return (a.function_date < b.function_date) === aUp ? -1 : 1;
          }
        } else if (a.function_date || b.function_date) {
          return a.function_date ? -1 : 1;
        }
        return a.updated_at < b.updated_at ? 1 : -1;
      });
  }, [ofKind, filter, query, today]);

  const switchKind = (k: BillKind) => {
    setKind(k);
    setFilter('all');
  };

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={styles.titleRow}>
          {!isOwner ? (
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityLabel="Back">
              <Feather name="chevron-left" size={24} color={T.ink} />
            </Pressable>
          ) : null}
          <View style={{ flexShrink: 1 }}>
            <Text style={screenChrome.title}>Bills</Text>
            <Text style={screenChrome.subtitle}>Estimates and client bills</Text>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={() => setSettingsOpen(true)} accessibilityLabel="Bill settings">
            <Feather name="settings" size={17} color={T.ink} />
          </Pressable>
          <Pressable
            style={styles.newBtn}
            onPress={() => router.push(`${base}/new?kind=${kind}&brand=${brand}` as any)}
            accessibilityLabel={`New ${kind === 'client' ? 'client bill' : 'estimate'}`}
          >
            <Feather name="plus" size={16} color={T.white} />
            <Text style={styles.newText}>New</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.brands}>
        {BRAND_KEYS.map((k) => {
          const active = brand === k;
          const t = BRANDS[k];
          return (
            <Pressable
              key={k}
              onPress={() => setBrand(k)}
              style={[styles.brandBtn, active && { backgroundColor: t.primary, borderColor: t.primary }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${t.label} bills`}
            >
              <View style={styles.brandDots}>
                {t.colors.map((c) => (
                  <View key={c} style={[styles.brandDot, { backgroundColor: c }, active && styles.brandDotOnDark]} />
                ))}
              </View>
              <Text style={[styles.brandText, active && styles.brandTextActive]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {isOwner && !isLoading ? (
        <View style={styles.totalCard}>
          <View style={styles.totalIcon}>
            <Feather name="check-circle" size={17} color={T.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.totalLabel}>{BRANDS[brand].label} completed bills · all time</Text>
            <Text style={styles.totalValue}>{rupees(completed.total)}</Text>
          </View>
          <Text style={styles.totalCount}>
            {completed.count} {completed.count === 1 ? 'bill' : 'bills'}
          </Text>
        </View>
      ) : null}

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
                  ? 'Trash is empty. Trashed bills stay here and can be restored.'
                  : `No ${BRANDS[brand].label} ${kind === 'client' ? 'client bills' : 'estimates'} yet`}
            </Text>
          </View>
        ) : (
          shown.map((b) => {
            const t = billTotals(b);
            const tone = BILL_STATUS_TONE[b.status];
            return (
              <Pressable
                key={b.id}
                onPress={() => router.push(`${base}/${b.id}` as any)}
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
                {b.event_type ? (
                  <Text style={styles.meta} numberOfLines={1}>{b.event_type}</Text>
                ) : null}
                <View style={styles.facts}>
                  <View style={styles.fact}>
                    <Feather name="calendar" size={13} color={b.function_date ? T.inkSoft : T.mute} />
                    <Text style={[styles.factText, !b.function_date && styles.factEmpty]} numberOfLines={1}>
                      {b.function_date ? format(parseISO(b.function_date), 'EEE, d MMM yyyy') : 'No date yet'}
                    </Text>
                  </View>
                  <View style={styles.fact}>
                    <Feather name="map-pin" size={13} color={b.venue ? T.inkSoft : T.mute} />
                    <Text style={[styles.factText, !b.venue && styles.factEmpty]} numberOfLines={1}>
                      {b.venue || 'No venue yet'}
                    </Text>
                  </View>
                </View>
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

      {settingsOpen ? (
        <BillSettingsSheet brand={brand} onDismiss={() => setSettingsOpen(false)} onSaved={setSnack} />
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
  headerActions: { flexDirection: 'row', gap: 8 },
  brands: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  brandBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: T.soft2,
    backgroundColor: T.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  brandDots: { flexDirection: 'row', gap: 3 },
  brandDot: { width: 8, height: 8, borderRadius: 4 },
  brandDotOnDark: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)' },
  brandText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.inkSoft },
  brandTextActive: { color: T.white },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: T.card,
    borderRadius: 18,
    padding: 12,
    ...appSoftShadow,
  },
  totalIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: T.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.mute },
  totalValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 19, color: T.ink, marginTop: 1 },
  totalCount: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
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
  // Room above and below inside the strip, or it clips the chips' shadow
  // (it falls lower than it rises, and is softer on web). A fixed height —
  // chip 34 + 8 above + 16 below — because on web the strip otherwise ignores
  // that room and the search box (pulled up by the extra) covered the chips.
  chipsWrap: { flexGrow: 0, flexShrink: 0, height: 58, marginTop: 4 },
  chips: { gap: 8, paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, alignItems: 'flex-start' },
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
    marginTop: -4,
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
  facts: { gap: 4, marginTop: 6 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  factText: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.ink },
  factEmpty: { fontFamily: 'Inter_400Regular', color: T.mute },
  money: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  moneyText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
});
