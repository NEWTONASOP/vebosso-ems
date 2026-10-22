// ============================================================================
// VEBOSSO EMS — Problem reports (owner)
// Everything the team reported from "Report a problem", newest first, open
// ones on top of the filter. Each shows who, when, what, where, screenshots
// and the device / app version. Mark fixed (or open again), or delete (069).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, formatDistanceToNow } from 'date-fns';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { ImageViewerModal } from '../../../components/ImageViewerModal';
import { InlineError } from '../../../components/InlineError';
import { AppRadius, AppSpace, AppTheme as T, appSoftShadow, screenChrome } from '../../../constants/theme';
import { Alert } from '../../../lib/alert';
import { BugReport, deleteBugReport, fetchBugReports, setBugStatus } from '../../../lib/bugReports';
import { imageThumb } from '../../../lib/cloudinary';

type Filter = 'open' | 'fixed' | 'all';

export default function BugReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<BugReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('open');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const [snack, setSnack] = useState('');

  const load = useCallback(async () => {
    const res = await fetchBugReports();
    if (res.success) {
      setReports(res.data);
      setError('');
    } else setError(res.error);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const counts = useMemo(
    () => ({
      open: reports.filter((r) => r.status === 'open').length,
      fixed: reports.filter((r) => r.status === 'fixed').length,
      all: reports.length,
    }),
    [reports],
  );
  const shown = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  const toggle = async (r: BugReport) => {
    setBusyId(r.id);
    const res = await setBugStatus(r.id, r.status === 'open' ? 'fixed' : 'open');
    setBusyId(null);
    if (!res.success) return setSnack(res.error);
    setReports((list) => list.map((x) => (x.id === r.id ? res.data : x)));
    setSnack(res.data.status === 'fixed' ? 'Marked fixed' : 'Opened again');
  };

  const remove = (r: BugReport) =>
    Alert.alert('Delete this report?', 'It is removed for good.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteBugReport(r.id);
          if (!res.success) return setSnack(res.error);
          setReports((list) => list.filter((x) => x.id !== r.id));
          setSnack('Report deleted');
        },
      },
    ]);

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
        <Text style={screenChrome.title}>Problem reports</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginTop: 40 }} />
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
          <View style={styles.chips}>
            {(['open', 'fixed', 'all'] as Filter[]).map((f) => {
              const on = filter === f;
              return (
                <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {f === 'open' ? 'Open' : f === 'fixed' ? 'Fixed' : 'All'}
                    {counts[f] ? ` ${counts[f]}` : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {shown.length === 0 ? (
            <EmptyState
              icon="bug-outline"
              title={filter === 'open' ? 'No open problems' : 'Nothing here'}
              subtitle="Anyone on the team can report a problem from their Profile or Settings."
            />
          ) : (
            shown.map((r) => (
              <View key={r.id} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.who} numberOfLines={1}>
                    {r.reporter_name || 'Someone'}
                  </Text>
                  <View style={[styles.status, r.status === 'fixed' ? styles.statusFixed : styles.statusOpen]}>
                    <Text style={[styles.statusText, { color: r.status === 'fixed' ? T.green : T.coral }]}>
                      {r.status === 'fixed' ? 'Fixed' : 'Open'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.when}>
                  {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })} · {format(new Date(r.created_at), 'd MMM yyyy, h:mm a')}
                </Text>

                <Text style={styles.description} selectable>
                  {r.description}
                </Text>
                {r.place ? (
                  <Text style={styles.meta}>
                    <Feather name="map-pin" size={12} color={T.mute} /> {r.place}
                  </Text>
                ) : null}

                {r.screenshots?.length ? (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.shots}>
                    {r.screenshots.map((img) => (
                      <Pressable key={img.public_id} onPress={() => setViewing(img.url)} accessibilityRole="imagebutton" accessibilityLabel="Open screenshot">
                        <Image source={{ uri: imageThumb(img) }} style={styles.thumb} contentFit="cover" />
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : null}

                <Text style={styles.device} selectable>
                  {[
                    r.platform === 'web' ? 'Web' : r.platform === 'ios' ? 'iPhone' : r.platform === 'android' ? 'Android' : r.platform,
                    r.os_version && r.platform !== 'web' ? `OS ${r.os_version}` : null,
                    r.device,
                    r.app_version ? `app ${r.app_version}` : null,
                    r.update_id ? `update ${r.update_id.slice(0, 8)}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {r.status === 'fixed' && r.fixed_at ? (
                  <Text style={styles.meta}>
                    Fixed {r.fixed_by_name ? `by ${r.fixed_by_name} ` : ''}on {format(new Date(r.fixed_at), 'd MMM yyyy')}
                  </Text>
                ) : null}

                <View style={styles.actions}>
                  <Pressable style={styles.deleteBtn} onPress={() => remove(r)} accessibilityLabel="Delete report">
                    <Feather name="trash-2" size={15} color={T.coral} />
                  </Pressable>
                  <Pressable
                    style={[styles.mainBtn, r.status === 'fixed' && styles.mainBtnSoft]}
                    onPress={() => void toggle(r)}
                    disabled={busyId === r.id}
                    accessibilityRole="button"
                  >
                    {busyId === r.id ? (
                      <ActivityIndicator color={r.status === 'fixed' ? T.ink : T.white} />
                    ) : (
                      <>
                        <Feather name={r.status === 'fixed' ? 'rotate-ccw' : 'check'} size={15} color={r.status === 'fixed' ? T.ink : T.white} />
                        <Text style={[styles.mainText, r.status === 'fixed' && { color: T.ink }]}>
                          {r.status === 'fixed' ? 'Open again' : 'Mark fixed'}
                        </Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      <ImageViewerModal uri={viewing} onDismiss={() => setViewing(null)} />
      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snack}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { ...screenChrome.header, flexDirection: 'row', alignItems: 'center', gap: 12 },
  pad: { paddingHorizontal: AppSpace.screen, paddingTop: 8 },
  scroll: { paddingHorizontal: AppSpace.screen, paddingBottom: 110, width: '100%', maxWidth: 600, alignSelf: 'center', gap: 12 },
  chips: { flexDirection: 'row', gap: 8, paddingTop: 4 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: T.card, justifyContent: 'center', ...appSoftShadow },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  card: { backgroundColor: T.card, borderRadius: AppRadius.card, padding: 14, ...appSoftShadow },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  who: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15, color: T.ink },
  status: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9 },
  statusOpen: { backgroundColor: T.coralSoft },
  statusFixed: { backgroundColor: T.greenSoft },
  statusText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  when: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 2 },
  description: { fontFamily: 'Inter_400Regular', fontSize: 14.5, color: T.ink, lineHeight: 21, marginTop: 10 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 6 },
  shots: { gap: 8, paddingTop: 10 },
  thumb: { width: 84, height: 84, borderRadius: 10, backgroundColor: T.soft2 },
  device: { fontFamily: 'Inter_400Regular', fontSize: 11.5, color: T.mute, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  deleteBtn: { width: 44, height: 40, borderRadius: 999, backgroundColor: T.coralSoft, alignItems: 'center', justifyContent: 'center' },
  mainBtn: { flex: 1, height: 40, borderRadius: 999, backgroundColor: T.charcoal, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  mainBtnSoft: { backgroundColor: T.soft },
  mainText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.white },
});
