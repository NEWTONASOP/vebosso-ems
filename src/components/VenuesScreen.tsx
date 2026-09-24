// ============================================================================
// VEBOSSO EMS — Venues Screen (shared by owner, manager, member)
// Every venue onboarded to VEBOSSO as a table: when it was met, who met it,
// the venue, where, and the person met there. Everyone can add; the owner can
// edit and delete (tap a row).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AppTheme as T, screenChrome } from '../constants/theme';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { deleteVenue, fetchVenues } from '../lib/venues';
import { Venue } from '../types/database';
import { SheetFrame } from './SheetFrame';
import { VenueFormSheet } from './VenueFormSheet';

const COLUMNS: { key: string; label: string; width: number }[] = [
  { key: 'date', label: 'Date', width: 96 },
  { key: 'by', label: 'Team member', width: 140 },
  { key: 'venue', label: 'Venue', width: 180 },
  { key: 'location', label: 'Location', width: 170 },
  { key: 'role', label: 'Person met (role)', width: 170 },
  { key: 'name', label: 'Their name', width: 140 },
  { key: 'email', label: 'Their email', width: 210 },
];
const TABLE_WIDTH = COLUMNS.reduce((w, c) => w + c.width, 0);

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');

interface VenuesScreenProps {
  /** Owner: edit and delete. */
  canManage: boolean;
  /** Pushed screens (manager / member) get a back button. */
  showBack?: boolean;
}

export function VenuesScreen({ canManage, showBack }: VenuesScreenProps) {
  const router = useRouter();
  // "?add=1" (from the home shortcut) opens straight into the add form.
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [formFor, setFormFor] = useState<Venue | 'new' | null>(() => (add === '1' ? 'new' : null));
  const [detail, setDetail] = useState<Venue | null>(null);
  const [snack, setSnack] = useState('');

  const apply = useCallback((res: Awaited<ReturnType<typeof fetchVenues>>) => {
    if (res.success) {
      setVenues(res.data);
      setError('');
    } else {
      setError(res.error);
    }
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await fetchVenues()), [apply]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchVenues().then((res) => active && apply(res));
      return () => {
        active = false;
      };
    }, [apply])
  );

  useEffect(() => {
    const channel = supabase
      .channel(`venues_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venues' }, () => void load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) =>
      [v.venue_name, v.location, v.contact_name, v.contact_role, v.contact_email, v.added_by_name]
        .some((f) => f?.toLowerCase().includes(q))
    );
  }, [venues, query]);

  const confirmDelete = (v: Venue) => {
    Alert.alert('Delete venue?', `${v.venue_name} will be removed from the list.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteVenue(v.id);
          if (res.success) {
            setDetail(null);
            setSnack('Venue deleted');
            await load();
          } else {
            setSnack(res.error);
          }
        },
      },
    ]);
  };

  const cell = (col: string, v: Venue) => {
    switch (col) {
      case 'date':
        return format(parseISO(v.met_on), 'd MMM yyyy');
      case 'by':
        return dash(v.added_by_name);
      case 'venue':
        return v.venue_name;
      case 'location':
        return dash(v.location);
      case 'role':
        return dash(v.contact_role);
      case 'name':
        return dash(v.contact_name);
      case 'email':
        return dash(v.contact_email);
      default:
        return '';
    }
  };

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={styles.titleRow}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              style={styles.back}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Feather name="chevron-left" size={22} color={T.ink} />
            </Pressable>
          ) : null}
          <View>
            <Text style={screenChrome.title}>Venues</Text>
            <Text style={screenChrome.subtitle}>
              {isLoading ? 'Loading…' : `${venues.length} onboarded`}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [screenChrome.primaryPill, pressed && { opacity: 0.9 }]}
          onPress={() => setFormFor('new')}
          accessibilityRole="button"
          accessibilityLabel="Add venue"
        >
          <Feather name="plus" size={16} color={T.white} />
          <Text style={screenChrome.primaryPillText}>Add venue</Text>
        </Pressable>
      </View>

      <View style={styles.searchWrap}>
        <Feather name="search" size={16} color={T.mute} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search venue, place, person, email…"
          placeholderTextColor={T.mute}
          style={styles.search}
          autoCorrect={false}
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
            <Feather name="x" size={16} color={T.mute} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={T.charcoal} style={{ marginTop: 40 }} />
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="map-pin" size={24} color={T.mute} />
            <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No venues yet'}</Text>
            <Text style={styles.emptySub}>
              {query ? 'Try a different search.' : 'Tap “Add venue” after you meet one.'}
            </Text>
          </View>
        ) : (
          <View style={styles.tableCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={{ width: TABLE_WIDTH }}>
                <View style={[styles.row, styles.headRow]}>
                  {COLUMNS.map((c) => (
                    <Text key={c.key} style={[styles.headCell, { width: c.width }]}>
                      {c.label}
                    </Text>
                  ))}
                </View>

                {filtered.map((v, i) => (
                  <Pressable
                    key={v.id}
                    onPress={() => setDetail(v)}
                    style={({ pressed }) => [
                      styles.row,
                      i % 2 === 1 && styles.rowAlt,
                      pressed && styles.rowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${v.venue_name}, met ${cell('date', v)} by ${dash(v.added_by_name)}`}
                  >
                    {COLUMNS.map((c) =>
                      c.key === 'email' && v.contact_email ? (
                        <Text
                          key={c.key}
                          style={[styles.cell, styles.link, { width: c.width }]}
                          numberOfLines={2}
                          onPress={() => Linking.openURL(`mailto:${v.contact_email}`)}
                        >
                          {v.contact_email}
                        </Text>
                      ) : (
                        <Text
                          key={c.key}
                          style={[styles.cell, { width: c.width }, c.key === 'venue' && styles.cellStrong]}
                          numberOfLines={2}
                        >
                          {cell(c.key, v)}
                        </Text>
                      )
                    )}
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {!isLoading && filtered.length > 0 ? (
          <Text style={styles.hint}>
            Swipe the table sideways to see every column · tap a row for details
          </Text>
        ) : null}
      </ScrollView>

      {detail ? (
        <SheetFrame
          visible
          onDismiss={() => setDetail(null)}
          title={detail.venue_name}
          subtitle={dash(detail.location)}
          icon="map-pin"
          iconColor={T.blue}
          iconBg={T.blueSoft}
          footer={
            canManage ? (
              <View style={styles.detailActions}>
                <Pressable style={[styles.detailBtn, styles.deleteBtn]} onPress={() => confirmDelete(detail)}>
                  <Feather name="trash-2" size={15} color={T.coral} />
                  <Text style={[styles.detailBtnText, { color: T.coral }]}>Delete</Text>
                </Pressable>
                <Pressable
                  style={[styles.detailBtn, styles.editBtn]}
                  onPress={() => {
                    setFormFor(detail);
                    setDetail(null);
                  }}
                >
                  <Feather name="edit-2" size={15} color={T.white} />
                  <Text style={[styles.detailBtnText, { color: T.white }]}>Edit</Text>
                </Pressable>
              </View>
            ) : undefined
          }
        >
          <DetailRow label="Date met" value={cell('date', detail)} />
          <DetailRow label="Team member" value={dash(detail.added_by_name)} />
          <DetailRow label="Location" value={dash(detail.location)} />
          <DetailRow label="Person met (role)" value={dash(detail.contact_role)} />
          <DetailRow label="Their name" value={dash(detail.contact_name)} />
          <DetailRow
            label="Their email"
            value={dash(detail.contact_email)}
            onPress={detail.contact_email ? () => Linking.openURL(`mailto:${detail.contact_email}`) : undefined}
          />
        </SheetFrame>
      ) : null}

      {formFor ? (
        <VenueFormSheet
          venue={formFor === 'new' ? null : formFor}
          existing={venues}
          onDismiss={() => setFormFor(null)}
          onSaved={(m) => {
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

function DetailRow({ label, value, onPress }: { label: string; value: string; onPress?: () => void }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, onPress && styles.link]} onPress={onPress} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  back: {
    width: 32,
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    height: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: T.card,
    ...screenChrome.card,
  },
  search: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.ink,
  },
  body: {
    paddingHorizontal: 20,
    paddingBottom: 130,
  },
  error: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.coral,
    marginBottom: 10,
  },
  empty: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: T.ink,
    marginTop: 4,
  },
  emptySub: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
  },
  tableCard: {
    ...screenChrome.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  headRow: {
    backgroundColor: T.soft,
    paddingVertical: 10,
  },
  rowAlt: {
    backgroundColor: '#FAFBFC',
  },
  rowPressed: {
    backgroundColor: T.soft,
  },
  headCell: {
    paddingHorizontal: 12,
    fontFamily: 'Inter_700Bold',
    fontSize: 11.5,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  cell: {
    paddingHorizontal: 12,
    fontFamily: 'Inter_400Regular',
    fontSize: 13.5,
    color: T.inkSoft,
    lineHeight: 19,
  },
  cellStrong: {
    fontFamily: 'Inter_600SemiBold',
    color: T.ink,
  },
  link: {
    color: T.blue,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    textAlign: 'center',
    marginTop: 10,
  },
  detailRow: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  detailLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: T.mute,
    marginBottom: 3,
  },
  detailValue: {
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  detailActions: {
    flexDirection: 'row',
    gap: 8,
  },
  detailBtn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  deleteBtn: {
    backgroundColor: T.coralSoft,
  },
  editBtn: {
    backgroundColor: T.charcoal,
  },
  detailBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
