// ============================================================================
// VEBOSSO EMS — Recycle bin (owner)
// Everything deleted anywhere in the app, newest first. Nothing here can be
// deleted — only restored, exactly as it was (migration 056).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { InlineError } from '../../../components/InlineError';
import { ListSkeleton } from '../../../components/LoadingSkeleton';
import { ShowMore, usePaged } from '../../../components/ShowMore';
import { AppRadius, AppSpace, AppTheme as T, appSoftShadow, screenChrome } from '../../../constants/theme';
import { Alert } from '../../../lib/alert';
import {
  BinGroup,
  BinItem,
  binExtra,
  binGroup,
  binIcon,
  binKind,
  binTitle,
  fetchBin,
  restoreFromBin,
} from '../../../lib/recycleBin';

const FILTERS: { key: BinGroup | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'venues', label: 'Venues' },
  { key: 'accounts', label: 'Accounts' },
  { key: 'leads', label: 'Leads' },
  { key: 'team', label: 'Team' },
  { key: 'other', label: 'Other' },
];

export default function RecycleBinScreen() {
  const router = useRouter();
  const [items, setItems] = useState<BinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<BinGroup | 'all'>('all');
  const [restoring, setRestoring] = useState<number | null>(null);
  const [snack, setSnack] = useState('');

  const load = useCallback(async () => {
    const res = await fetchBin();
    if (res.success) {
      setItems(res.data);
      setError(null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const i of items) c[binGroup(i)] = (c[binGroup(i)] ?? 0) + 1;
    return c;
  }, [items]);

  const shown = useMemo(() => (filter === 'all' ? items : items.filter((i) => binGroup(i) === filter)), [items, filter]);
  const page = usePaged(shown, filter);

  const restore = (item: BinItem) => {
    const extra = binExtra(item);
    Alert.alert(
      'Restore?',
      `${binTitle(item)}${extra ? ` (${extra})` : ''} will be put back where it was, as it was.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: async () => {
            setRestoring(item.batch);
            const res = await restoreFromBin(item.batch);
            setRestoring(null);
            if (!res.success) {
              Alert.alert('Couldn’t restore', res.error);
              return;
            }
            setItems((all) => all.filter((i) => i.batch !== item.batch));
            setSnack(
              res.data.restored === 0
                ? 'It’s already back in the app (a newer copy was kept)'
                : res.data.skipped > 0
                  ? 'Restored — some of it was already back, so that was left as it is'
                  : 'Restored',
            );
          },
        },
      ],
    );
  };

  return (
    <View style={screenChrome.root}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [screenChrome.iconButton, pressed && { opacity: 0.7 }]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={18} color={T.charcoal} />
        </Pressable>
        <Text style={screenChrome.title}>Recycle bin</Text>
      </View>

      {loading ? (
        <View style={styles.pad}>
          <ListSkeleton count={4} variant="task-row" />
        </View>
      ) : error ? (
        <View style={styles.pad}>
          <InlineError
            message={error}
            onRetry={async () => {
              setLoading(true);
              await load();
            }}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={T.charcoal}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>
            Anything deleted in the app — by you or anyone on the team — is kept here. Only you can see it. Restore
            puts it back as it was. Bills have their own Trash.
          </Text>

          {items.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipStrip}
              contentContainerStyle={styles.chips}
            >
              {FILTERS.filter((f) => f.key === 'all' || counts[f.key]).map((f) => {
                const on = filter === f.key;
                return (
                  <Pressable
                    key={f.key}
                    onPress={() => setFilter(f.key)}
                    style={[styles.chip, on && styles.chipOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                  >
                    <Text style={[styles.chipText, on && styles.chipTextOn]}>
                      {f.label} · {counts[f.key] ?? 0}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {shown.length === 0 ? (
            <View style={styles.emptyCard}>
              <EmptyState icon="delete-empty-outline" title="Nothing here" subtitle="Deleted things will show up here" />
            </View>
          ) : (
            <View style={styles.list}>
              {page.items.map((item) => {
                const extra = binExtra(item);
                const ctx = item.items.length === 1 ? item.items[0].context : null;
                const busy = restoring === item.batch;
                return (
                  <View key={item.batch} style={styles.card}>
                    <View style={styles.icon}>
                      <Feather name={binIcon(item) as any} size={17} color={T.ink} />
                    </View>
                    <View style={styles.info}>
                      <Text style={styles.kind}>{binKind(item)}</Text>
                      <Text style={styles.title} numberOfLines={2}>
                        {binTitle(item)}
                      </Text>
                      {!!ctx && (
                        <Text style={styles.meta} numberOfLines={1}>
                          {ctx}
                        </Text>
                      )}
                      {!!extra && <Text style={styles.meta}>{extra}</Text>}
                      <Text style={styles.when}>
                        Deleted {formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true })}
                        {item.deletedBy ? ` by ${item.deletedBy}` : ''}
                      </Text>
                    </View>
                    <Pressable
                      style={({ pressed }) => [styles.restore, pressed && { opacity: 0.7 }]}
                      onPress={() => restore(item)}
                      disabled={restoring !== null}
                      accessibilityRole="button"
                      accessibilityLabel={`Restore ${binTitle(item)}`}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={T.ink} />
                      ) : (
                        <>
                          <Feather name="rotate-ccw" size={14} color={T.ink} />
                          <Text style={styles.restoreText}>Restore</Text>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              })}
              <ShowMore page={page} />
            </View>
          )}
        </ScrollView>
      )}

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack('')}
        duration={4000}
        theme={{ colors: { inverseSurface: T.charcoal, inverseOnSurface: T.white } }}
      >
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { ...screenChrome.header, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pad: { paddingHorizontal: AppSpace.screen, paddingTop: 8 },
  scroll: { paddingBottom: 110, width: '100%', maxWidth: 600, alignSelf: 'center' },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    lineHeight: 19,
    color: T.mute,
    paddingHorizontal: AppSpace.screen,
    marginTop: 4,
  },
  chipStrip: { height: 58, flexGrow: 0 },
  chips: { paddingHorizontal: AppSpace.screen, gap: 8, alignItems: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.card,
    justifyContent: 'center',
    ...appSoftShadow,
  },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.ink },
  chipTextOn: { color: T.white },
  list: { paddingHorizontal: AppSpace.screen, gap: 10, marginTop: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    padding: 14,
    ...appSoftShadow,
  },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  kind: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.mute },
  title: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink, marginTop: 1 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.inkSoft, marginTop: 2 },
  when: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 4 },
  restore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    minWidth: 92,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.soft,
  },
  restoreText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.ink },
  emptyCard: {
    marginHorizontal: AppSpace.screen,
    marginTop: 16,
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    paddingVertical: 24,
    ...appSoftShadow,
  },
});
