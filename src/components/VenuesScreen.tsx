// ============================================================================
// VEBOSSO EMS — Venues Screen (shared by owner, manager, member)
// Every venue onboarded to VEBOSSO as a table: when it was met, who met it,
// the venue, where, and the person met there. Each person sees and works on
// only the venues they added; the owner sees all of them (051). Venues in
// business with VEBOSSO show green. Venues are grouped city by city
// (collapsible), venues without a city last. Cities are one shared list
// everyone sees and can add to; only the owner removes a city.
// ============================================================================

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
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
  View,
} from 'react-native';
import { SmoothTextInput as TextInput } from './SmoothTextInput';
import { Menu, Snackbar, Text } from 'react-native-paper';
import { PaperOutlinedField } from './PaperOutlinedField';
import { AppTheme as T, screenChrome } from '../constants/theme';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import {
  addCity,
  deleteCity,
  deleteVenue,
  fetchCities,
  fetchVenues,
  mailtoUrl,
  setVenueInBusiness,
  telUrl,
  venueContacts,
  whatsappUrl,
} from '../lib/venues';
import { Venue, VenueCity, VenueContact } from '../types/database';
import { Chevron, DropdownBody } from './Dropdown';
import { SheetFrame } from './SheetFrame';
import { EmailPeopleSheet } from './EmailPeopleSheet';
import { VenueFormSheet } from './VenueFormSheet';
import { useKeyboardOverlap } from '../lib/useKeyboardHeight';
import { PAGE, ShowMore } from './ShowMore';

const COLUMNS: { key: string; label: string; width: number }[] = [
  { key: 'date', label: 'Date', width: 96 },
  { key: 'by', label: 'Team member', width: 140 },
  { key: 'venue', label: 'Venue', width: 180 },
  { key: 'location', label: 'Location', width: 170 },
  { key: 'role', label: 'Person met (role)', width: 170 },
  { key: 'name', label: 'Their name', width: 140 },
  { key: 'phone', label: 'Their phone', width: 140 },
  { key: 'email', label: 'Their email', width: 210 },
];
const TABLE_WIDTH = COLUMNS.reduce((w, c) => w + c.width, 0);

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');
const WHATSAPP_GREEN = '#1FA855';

const loadAll = async () => {
  const [venues, cities] = await Promise.all([fetchVenues(), fetchCities()]);
  return { venues, cities };
};

interface VenuesScreenProps {
  /** Owner: remove cities. */
  canManage: boolean;
  /** Pushed screens (manager / member) get a back button. */
  showBack?: boolean;
}

export function VenuesScreen({ canManage, showBack }: VenuesScreenProps) {
  // Shrink to the space above the keyboard so the focused box stays in sight.
  const { ref: keyboardRef, overlap: keyboardInset } = useKeyboardOverlap();
  const router = useRouter();
  // "?add=1" (from the home shortcut) opens straight into the add form.
  const { add } = useLocalSearchParams<{ add?: string }>();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [cities, setCities] = useState<VenueCity[]>([]);
  const [openCities, setOpenCities] = useState<Set<string>>(() => new Set());
  // How many venues each open city shows (PAGE to start) — a city full of
  // venues was slow to open.
  const [shownVenues, setShownVenues] = useState<Record<string, number>>({});
  // City preselected in the add form (when adding from inside a city).
  const [formCity, setFormCity] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [formFor, setFormFor] = useState<Venue | 'new' | null>(() => (add === '1' ? 'new' : null));
  const [detail, setDetail] = useState<Venue | null>(null);
  const [snack, setSnack] = useState('');
  const [marking, setMarking] = useState(false);
  // The "Email people" sheet: tick people, write one email to all of them.
  const [emailing, setEmailing] = useState(false);
  // The city whose ⋮ menu is open.
  const [menuFor, setMenuFor] = useState<string | null>(null);
  // Adding a city: null = not adding, '' = typing.
  const [newCity, setNewCity] = useState<string | null>(null);
  const [addingCity, setAddingCity] = useState(false);

  const saveCity = async () => {
    if (newCity === null) return;
    setAddingCity(true);
    const res = await addCity(newCity);
    setAddingCity(false);
    if (!res.success) return setSnack(res.error);
    setCities((list) => [...list, res.data].sort((a, b) => a.name.localeCompare(b.name)));
    setOpenCities((prev) => new Set(prev).add(res.data.id));
    setNewCity(null);
    setSnack(`${res.data.name} added`);
  };

  const apply = useCallback((res: Awaited<ReturnType<typeof loadAll>>) => {
    if (res.venues.success) {
      setVenues(res.venues.data);
      setError('');
    } else {
      setError(res.venues.error);
    }
    if (res.cities.success) setCities(res.cities.data);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => apply(await loadAll()), [apply]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadAll().then((res) => active && apply(res));
      return () => {
        active = false;
      };
    }, [apply])
  );

  useEffect(() => {
    const channel = supabase
      .channel(`venues_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venues' }, () => void load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'venue_cities' }, () => void load())
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

  useEffect(() => setShownVenues({}), [query]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((v) =>
      [
        v.venue_name,
        v.location,
        v.added_by_name,
        ...venueContacts(v).flatMap((c) => [c.name, c.role, c.email, c.phone]),
      ].some((f) => f?.toLowerCase().includes(q))
    );
  }, [venues, query]);

  // City by city, in name order; venues without a city (or whose city was
  // removed) last. While searching, only cities with matches show, opened.
  const groups = useMemo(() => {
    const searching = !!query.trim();
    const known = new Set(cities.map((c) => c.id));
    const list: { id: string; name: string; venues: Venue[] }[] = cities.map((c) => ({
      id: c.id,
      name: c.name,
      venues: filtered.filter((v) => v.city_id === c.id),
    }));
    const noCity = filtered.filter((v) => !v.city_id || !known.has(v.city_id));
    if (noCity.length) list.push({ id: 'none', name: 'No city', venues: noCity });
    return searching ? list.filter((g) => g.venues.length > 0) : list;
  }, [cities, filtered, query]);

  const toggleCity = (id: string) =>
    setOpenCities((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const cityName = (id: string | null) => cities.find((c) => c.id === id)?.name ?? null;

  const open = (url: string, fail: string) => {
    Linking.openURL(url).catch(() => setSnack(fail));
  };
  const call = (phone: string) => open(telUrl(phone), 'Could not open the phone app');
  const whatsapp = (phone: string) => open(whatsappUrl(phone), 'Could not open WhatsApp');


  /** Owner only. Venues in it move to "No city"; nothing is deleted. */
  const confirmDeleteCity = (c: { id: string; name: string; venues: Venue[] }) => {
    Alert.alert(
      `Remove ${c.name}?`,
      c.venues.length
        ? `The ${c.venues.length} ${c.venues.length === 1 ? 'venue' : 'venues'} in it will move to "No city". No venue is deleted.`
        : 'This city has no venues.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove city',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteCity(c.id);
            if (res.success) {
              setSnack(`${c.name} removed`);
              await load();
            } else {
              setSnack(res.error);
            }
          },
        },
      ],
    );
  };

  /** Role / name / phone / email column: one line per person met, in the same order in every column. */
  const peopleCell = (key: 'role' | 'name' | 'phone' | 'email', v: Venue, width: number) => {
    const people = venueContacts(v);
    if (!people.length) {
      return (
        <Text key={key} style={[styles.cell, { width }]}>
          —
        </Text>
      );
    }
    return (
      <View key={key} style={{ width }}>
        {people.map((p, i) => {
          const value = (p[key] ?? '').trim();
          if (!value) {
            return (
              <Text key={i} style={styles.cell} numberOfLines={1}>
                —
              </Text>
            );
          }
          if (key === 'phone') {
            return (
              <View key={i} style={styles.phoneLine}>
                <Text
                  style={[styles.cell, styles.link, styles.phoneText]}
                  numberOfLines={1}
                  onPress={() => call(value)}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${value}`}
                >
                  <Feather name="phone" size={12} color={T.blue} /> {value}
                </Text>
                <Pressable
                  onPress={() => whatsapp(value)}
                  hitSlop={6}
                  style={styles.waBtn}
                  accessibilityRole="link"
                  accessibilityLabel={`WhatsApp ${value}`}
                >
                  <MaterialCommunityIcons name="whatsapp" size={16} color={WHATSAPP_GREEN} />
                </Pressable>
              </View>
            );
          }
          if (key === 'email') {
            return (
              <Text
                key={i}
                style={[styles.cell, styles.link]}
                numberOfLines={1}
                onPress={() => open(mailtoUrl([value]), 'Could not open an email app')}
                accessibilityRole="link"
                accessibilityLabel={`Email ${value}`}
              >
                <Feather name="mail" size={12} color={T.blue} /> {value}
              </Text>
            );
          }
          return (
            <Text key={i} style={[styles.cell, key === 'name' && styles.cellStrong]} numberOfLines={1}>
              {value}
            </Text>
          );
        })}
      </View>
    );
  };

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

  const toggleInBusiness = (v: Venue) => {
    const next = !v.in_business;
    const go = async () => {
      setMarking(true);
      const res = await setVenueInBusiness(v.id, next);
      setMarking(false);
      if (res.success) {
        setDetail(null);
        setSnack(next ? `${v.venue_name} marked in business` : 'Mark removed');
        await load();
      } else {
        setSnack(res.error);
      }
    };
    Alert.alert(
      next ? 'In business with VEBOSSO?' : 'Remove the mark?',
      next
        ? `Mark ${v.venue_name} as a venue that has given permission and works with VEBOSSO.`
        : `${v.venue_name} will no longer show as in business.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: next ? 'Mark in business' : 'Remove', style: next ? 'default' : 'destructive', onPress: () => void go() },
      ]
    );
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
      case 'phone':
        return dash(v.contact_phone);
      case 'email':
        return dash(v.contact_email);
      default:
        return '';
    }
  };

  const renderTable = (all: Venue[], key: string) => {
    const limit = shownVenues[key] ?? PAGE;
    const list = all.length > limit ? all.slice(0, limit) : all;
    return (
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

          {list.map((v, i) => (
            <Pressable
              key={v.id}
              onPress={() => setDetail(v)}
              style={({ pressed }) => [
                styles.row,
                i % 2 === 1 && styles.rowAlt,
                v.in_business && styles.rowInBusiness,
                pressed && styles.rowPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${v.venue_name}${v.in_business ? ', in business' : ''}, met ${cell('date', v)} by ${dash(v.added_by_name)}`}
            >
              {COLUMNS.map((c) =>
                c.key === 'venue' && v.in_business ? (
                  <View key={c.key} style={[styles.venueCell, { width: c.width }]}>
                    <Feather name="check-circle" size={14} color={T.green} style={{ marginTop: 2 }} />
                    <Text style={[styles.cellStrong, styles.venueCellText]} numberOfLines={2}>
                      {v.venue_name}
                    </Text>
                  </View>
                ) : c.key === 'role' || c.key === 'name' || c.key === 'phone' || c.key === 'email' ? (
                  peopleCell(c.key, v, c.width)
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
      <ShowMore
        page={{ left: all.length - list.length, more: () => setShownVenues((m) => ({ ...m, [key]: limit + PAGE * 2 })) }}
        style={{ margin: 10 }}
      />
    </View>
    );
  };

  return (
    <View ref={keyboardRef} style={[screenChrome.root, { paddingBottom: keyboardInset }]}>
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
              {isLoading
                ? 'Loading…'
                : `${venues.length} onboarded${canManage ? '' : ' by you'} · ${cities.length} ${cities.length === 1 ? 'city' : 'cities'}`}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [screenChrome.primaryPill, pressed && { opacity: 0.9 }]}
          onPress={() => {
            setFormCity(null);
            setFormFor('new');
          }}
          accessibilityRole="button"
          accessibilityLabel="Add venue"
        >
          <Feather name="plus" size={16} color={T.white} />
          <Text style={screenChrome.primaryPillText}>Add venue</Text>
        </Pressable>
      </View>



      <View style={styles.searchRow}>
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
      <Pressable
        style={({ pressed }) => [styles.emailPill, pressed && { opacity: 0.85 }]}
        onPress={() => setEmailing(true)}
        accessibilityRole="button"
        accessibilityLabel="Email people you met"
      >
        <Feather name="mail" size={15} color={T.ink} />
        <Text style={styles.emailPillText}>Email</Text>
      </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={T.charcoal} style={{ marginTop: 40 }} />
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="map-pin" size={24} color={T.mute} />
            <Text style={styles.emptyTitle}>{query ? 'No matches' : 'No venues yet'}</Text>
            <Text style={styles.emptySub}>
              {query ? 'Try a different search.' : 'Tap “Add venue” after you meet one.'}
            </Text>
          </View>
        ) : (
          groups.map((g) => {
            const open = !!query.trim() || openCities.has(g.id);
            const inBusiness = g.venues.filter((v) => v.in_business).length;
            return (
              <View key={g.id} style={styles.group}>
                <Pressable
                  onPress={() => toggleCity(g.id)}
                  style={({ pressed }) => [styles.cityRow, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${g.name}, ${g.venues.length} venues`}
                >
                  <View style={styles.cityIcon}>
                    <Feather name={g.id === 'none' ? 'help-circle' : 'map-pin'} size={16} color={T.blue} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.cityName} numberOfLines={1}>{g.name}</Text>
                    <Text style={styles.cityMeta} numberOfLines={1}>
                      {g.venues.length === 0
                        ? 'No venues yet'
                        : `${g.venues.length} ${g.venues.length === 1 ? 'venue' : 'venues'}${inBusiness ? ` · ${inBusiness} in business` : ''}`}
                    </Text>
                  </View>
                  {g.id !== 'none' ? (
                    <Menu
                      visible={menuFor === g.id}
                      onDismiss={() => setMenuFor(null)}
                      anchor={
                        <Pressable
                          onPress={() => setMenuFor(g.id)}
                          style={styles.cityAdd}
                          hitSlop={6}
                          accessibilityLabel={`More for ${g.name}`}
                        >
                          <Feather name="more-vertical" size={16} color={T.ink} />
                        </Pressable>
                      }
                      contentStyle={styles.menu}
                    >
                      <Menu.Item
                        leadingIcon="plus"
                        title="Add a venue here"
                        onPress={() => {
                          setMenuFor(null);
                          setFormCity(g.id);
                          setFormFor('new');
                        }}
                      />
                      {canManage ? (
                        <Menu.Item
                          leadingIcon="trash-can-outline"
                          title="Remove city"
                          titleStyle={{ color: T.coral }}
                          onPress={() => {
                            setMenuFor(null);
                            confirmDeleteCity(g);
                          }}
                        />
                      ) : null}
                    </Menu>
                  ) : null}
                  <Chevron open={open} color={T.mute} />
                </Pressable>
                {open && g.venues.length > 0 ? <DropdownBody>{renderTable(g.venues, g.id)}</DropdownBody> : null}
              </View>
            );
          })
        )}

        {/* Cities are added here, on the list — not inside the venue form. */}
        {!isLoading && !query.trim() ? (
          newCity === null ? (
            <Pressable style={styles.addCityBtn} onPress={() => setNewCity('')} accessibilityRole="button">
              <Feather name="plus" size={15} color={T.ink} />
              <Text style={styles.addCityText}>Add city</Text>
            </Pressable>
          ) : (
            <View style={styles.newCityRow}>
              <PaperOutlinedField
                label="City name"
                value={newCity}
                onChangeText={setNewCity}
                style={{ flex: 1 }}
                maxLength={80}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void saveCity()}
              />
              <Pressable style={styles.cityAdd} onPress={() => setNewCity(null)} accessibilityLabel="Cancel">
                <Feather name="x" size={16} color={T.inkSoft} />
              </Pressable>
              <Pressable
                style={[styles.cityAdd, styles.citySave]}
                onPress={() => void saveCity()}
                disabled={addingCity}
                accessibilityLabel="Save city"
              >
                {addingCity ? <ActivityIndicator color={T.white} /> : <Feather name="check" size={16} color={T.white} />}
              </Pressable>
            </View>
          )
        ) : null}

        {!isLoading && filtered.length > 0 ? (
          <Text style={styles.hint}>
            Green rows are in business with VEBOSSO · swipe sideways for every column · tap a phone to call, an email to write · "Email" to write to several people · tap a row for details
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
            <View style={{ gap: 8 }}>
              <Pressable
                style={[styles.markBtn, detail.in_business && styles.unmarkBtn]}
                onPress={() => toggleInBusiness(detail)}
                disabled={marking}
              >
                {marking ? (
                  <ActivityIndicator color={detail.in_business ? T.inkSoft : T.white} />
                ) : (
                  <>
                    <Feather
                      name={detail.in_business ? 'x-circle' : 'check-circle'}
                      size={15}
                      color={detail.in_business ? T.inkSoft : T.white}
                    />
                    <Text style={[styles.detailBtnText, { color: detail.in_business ? T.inkSoft : T.white }]}>
                      {detail.in_business ? 'Remove in-business mark' : 'Mark in business with VEBOSSO'}
                    </Text>
                  </>
                )}
              </Pressable>
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
            </View>
          }
        >
          {detail.in_business ? (
            <View style={styles.inBusinessBanner}>
              <Feather name="check-circle" size={16} color={T.green} style={{ marginTop: 2 }} />
              <Text style={styles.inBusinessText}>
                In business with VEBOSSO
                {detail.in_business_by_name || detail.in_business_at ? (
                  <Text style={styles.inBusinessMeta}>
                    {' · marked'}
                    {detail.in_business_by_name ? ` by ${detail.in_business_by_name}` : ''}
                    {detail.in_business_at ? ` on ${format(new Date(detail.in_business_at), 'd MMM yyyy')}` : ''}
                  </Text>
                ) : null}
              </Text>
            </View>
          ) : null}
          <DetailRow label="Date met" value={cell('date', detail)} />
          <DetailRow label="Team member" value={dash(detail.added_by_name)} />
          <DetailRow label="City" value={dash(cityName(detail.city_id))} />
          <DetailRow label="Location" value={dash(detail.location)} />
          {(() => {
            const people = venueContacts(detail);
            if (!people.length) return <DetailRow label="People met" value="—" />;
            return people.map((p, i) => (
              <PersonBlock
                key={i}
                title={people.length > 1 ? `Person ${i + 1}` : 'Person met'}
                person={p}
                onCall={call}
                onWhatsApp={whatsapp}
                onEmail={(e) => open(mailtoUrl([e]), 'Could not open an email app')}
              />
            ));
          })()}
        </SheetFrame>
      ) : null}

      {formFor ? (
        <VenueFormSheet
          venue={formFor === 'new' ? null : formFor}
          existing={venues}
          cities={cities}
          defaultCityId={formCity}
          onDismiss={() => setFormFor(null)}
          onSaved={(m) => {
            setSnack(m);
            void load();
          }}
        />
      ) : null}

      {emailing ? (
        <EmailPeopleSheet
          venues={filtered}
          searching={!!query.trim()}
          onDismiss={() => setEmailing(false)}
          onMessage={setSnack}
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

/** One person met at the venue: role and name, with tap-to-call and tap-to-email. */
function PersonBlock({
  title,
  person,
  onCall,
  onWhatsApp,
  onEmail,
}: {
  title: string;
  person: VenueContact;
  onCall: (phone: string) => void;
  onWhatsApp: (phone: string) => void;
  onEmail: (email: string) => void;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>
        {title}
        {person.role ? ` · ${person.role}` : ''}
      </Text>
      <Text style={styles.detailValue} selectable>
        {dash(person.name)}
      </Text>
      {person.phone ? (
        <Text style={[styles.detailValue, styles.link, styles.contactLine]} onPress={() => onCall(person.phone!)}>
          <Feather name="phone" size={14} color={T.blue} /> {person.phone}
        </Text>
      ) : null}
      {person.phone ? (
        <Text style={[styles.detailValue, styles.contactLine, { color: WHATSAPP_GREEN }]} onPress={() => onWhatsApp(person.phone!)}>
          <MaterialCommunityIcons name="whatsapp" size={15} color={WHATSAPP_GREEN} /> WhatsApp
        </Text>
      ) : null}
      {person.email ? (
        <Text style={[styles.detailValue, styles.link, styles.contactLine]} onPress={() => onEmail(person.email!)}>
          <Feather name="mail" size={14} color={T.blue} /> {person.email}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  menu: { backgroundColor: T.card, borderRadius: 14 },
  addCityBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: T.soft2,
    marginTop: 2,
    marginBottom: 6,
  },
  addCityText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  newCityRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 6 },
  citySave: { backgroundColor: T.charcoal },
  emailPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: T.card,
    ...screenChrome.card,
  },
  emailPillText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  contactLine: { marginTop: 4 },
  phoneLine: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  phoneText: { flexShrink: 1, paddingRight: 6 },
  waBtn: { paddingHorizontal: 2 },
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
    flex: 1,
    minWidth: 0,
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
  group: { marginBottom: 10 },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 12,
    ...screenChrome.card,
  },
  cityIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: T.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cityName: { fontFamily: 'Inter_700Bold', fontSize: 15.5, color: T.ink },
  cityMeta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 1 },
  cityAdd: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableCard: {
    marginTop: 8,
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
  rowInBusiness: {
    backgroundColor: T.greenSoft,
  },
  rowPressed: {
    backgroundColor: T.soft,
  },
  venueCell: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
  },
  venueCellText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
  inBusinessBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: T.greenSoft,
    borderRadius: 14,
    padding: 12,
    marginBottom: 6,
  },
  inBusinessText: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.green,
    lineHeight: 20,
  },
  inBusinessMeta: {
    fontFamily: 'Inter_400Regular',
    color: T.inkSoft,
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
  // Full-width on its own line, so no flex (flex: 1 collapses it in a column).
  markBtn: {
    height: 46,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: T.green,
  },
  unmarkBtn: {
    backgroundColor: T.soft,
  },
  editBtn: {
    backgroundColor: T.charcoal,
  },
  detailBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
