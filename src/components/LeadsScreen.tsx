// ============================================================================
// VEBOSSO EMS — Navgrah Leads (owner tab; others open it from home when given
// access). Leads grouped banquet by banquet (collapsible), soonest function
// first. Add one by one, or import / export Excel (dof, name, function,
// contact, remarks). Tap a number to call; save a lead — or a whole banquet —
// to the phone's contacts as "<name> <banquet> <dof> <function>".
// One shared list (migration 042).
// ============================================================================

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Menu, Snackbar, Text } from 'react-native-paper';
import { AppTheme as T, screenChrome } from '../constants/theme';
import { Alert } from '../lib/alert';
import { addBanquet, contactName, deleteBanquet, fetchBanquets, fetchLeads } from '../lib/leads';
import { exportLeads, saveLeadsToPhone } from '../lib/leadsFile';
import { supabase } from '../lib/supabase';
import { telUrl, whatsappUrl } from '../lib/venues';
import { Lead, LeadBanquet } from '../types/database';
import { Chevron, DropdownBody } from './Dropdown';
import { LeadSheet } from './LeadSheet';
import { LeadsImportSheet } from './LeadsImportSheet';
import { NavgrahLogo } from './NavgrahLogo';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SmoothTextInput as TextInput } from './SmoothTextInput';

const WHATSAPP_GREEN = '#1FA855';

const loadAll = async () => {
  const [leads, banquets] = await Promise.all([fetchLeads(), fetchBanquets()]);
  return { leads, banquets };
};

type Group = { id: string; name: string; banquet: LeadBanquet | null; leads: Lead[] };

export function LeadsScreen({ showBack }: { showBack?: boolean }) {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [banquets, setBanquets] = useState<LeadBanquet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [openIds, setOpenIds] = useState<Set<string>>(() => new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [snack, setSnack] = useState('');
  // The lead popup: a lead to view, or 'new' (optionally in a banquet).
  const [sheet, setSheet] = useState<{ lead: Lead | null; banquetId: string | null } | null>(null);
  // Import: from the top (null target) or into one banquet.
  const [importing, setImporting] = useState<{ target: LeadBanquet | null } | null>(null);
  const [newBanquet, setNewBanquet] = useState<string | null>(null);
  const [addingBanquet, setAddingBanquet] = useState(false);

  const apply = useCallback((res: Awaited<ReturnType<typeof loadAll>>) => {
    if (res.leads.success) {
      setLeads(res.leads.data);
      setError('');
    } else {
      setError(res.leads.error);
    }
    if (res.banquets.success) setBanquets(res.banquets.data);
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
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void load(), 400);
    };
    const channel = supabase
      .channel(`leads_${Math.random().toString(36).slice(2, 8)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, soon)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_banquets' }, soon)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const banquetName = (id: string | null) => banquets.find((b) => b.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((l) =>
      [l.name, l.function, l.contact, l.remarks, banquetName(l.banquet_id), l.dof ? format(parseISO(l.dof), 'd MMM yyyy') : '']
        .some((f) => f?.toLowerCase().includes(q))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, query, banquets]);

  // Banquet by banquet in name order; leads without a banquet last. While
  // searching, only banquets with matches show, opened.
  const groups = useMemo<Group[]>(() => {
    const known = new Set(banquets.map((b) => b.id));
    const list: Group[] = banquets.map((b) => ({ id: b.id, name: b.name, banquet: b, leads: filtered.filter((l) => l.banquet_id === b.id) }));
    const none = filtered.filter((l) => !l.banquet_id || !known.has(l.banquet_id));
    if (none.length) list.push({ id: 'none', name: 'No banquet', banquet: null, leads: none });
    return query.trim() ? list.filter((g) => g.leads.length > 0) : list;
  }, [banquets, filtered, query]);

  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const saveBanquet = async () => {
    if (newBanquet === null) return;
    setAddingBanquet(true);
    const res = await addBanquet(newBanquet);
    setAddingBanquet(false);
    if (!res.success) return setSnack(res.error);
    setBanquets((list) => [...list, res.data].sort((a, b) => a.name.localeCompare(b.name)));
    setOpenIds((prev) => new Set(prev).add(res.data.id));
    setNewBanquet(null);
    setSnack(`${res.data.name} added`);
  };

  const removeBanquet = (g: Group) => {
    if (!g.banquet) return;
    Alert.alert(
      `Remove ${g.name}?`,
      g.leads.length
        ? `Its ${g.leads.length} ${g.leads.length === 1 ? 'lead moves' : 'leads move'} to "No banquet". No lead is deleted.`
        : 'This banquet has no leads.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove banquet',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteBanquet(g.banquet!.id);
            setSnack(res.success ? `${g.name} removed` : res.error);
            if (res.success) await load();
          },
        },
      ]
    );
  };

  const saveAllToPhone = async (g: Group) => {
    try {
      const n = await saveLeadsToPhone(
        g.leads.map((lead) => ({ lead, banquetName: banquetName(lead.banquet_id) })),
        `${g.name} leads`
      );
      setSnack(`${n} ${n === 1 ? 'contact' : 'contacts'} sent to Contacts`);
    } catch (e: any) {
      setSnack(e?.message || 'Could not open Contacts');
    }
  };

  const doExport = async (list: Group[], base: string) => {
    const withLeads = list.filter((g) => g.leads.length);
    if (!withLeads.length) return setSnack('No leads to export');
    try {
      await exportLeads(withLeads.map((g) => ({ name: g.name, leads: g.leads })), base);
    } catch (e: any) {
      setSnack(e?.message || 'Could not export');
    }
  };

  const saveOne = async (lead: Lead) => {
    try {
      await saveLeadsToPhone([{ lead, banquetName: banquetName(lead.banquet_id) }], contactName(lead, banquetName(lead.banquet_id)));
    } catch (e: any) {
      setSnack(e?.message || 'Could not open Contacts');
    }
  };

  const nextDate = (g: Group) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const next = g.leads.find((l) => l.dof && l.dof >= today);
    return next?.dof ? format(parseISO(next.dof), 'd MMM') : null;
  };

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={styles.titleRow}>
          {showBack ? (
            <Pressable onPress={() => router.back()} style={styles.back} hitSlop={8} accessibilityLabel="Back">
              <Feather name="chevron-left" size={22} color={T.ink} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[screenChrome.title, styles.title]}>Navgrah Leads</Text>
            <Text style={screenChrome.subtitle}>
              {isLoading
                ? 'Loading…'
                : `${leads.length} ${leads.length === 1 ? 'lead' : 'leads'} · ${banquets.length} ${banquets.length === 1 ? 'banquet' : 'banquets'}`}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [screenChrome.primaryPill, pressed && { opacity: 0.9 }]}
          onPress={() => setSheet({ lead: null, banquetId: null })}
          accessibilityRole="button"
          accessibilityLabel="Add lead"
        >
          <Feather name="plus" size={16} color={T.white} />
          <Text style={screenChrome.primaryPillText}>Add lead</Text>
        </Pressable>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchWrap}>
          <Feather name="search" size={16} color={T.mute} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, number, function…"
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
        <Menu
          visible={menuFor === 'top'}
          onDismiss={() => setMenuFor(null)}
          anchor={
            <Pressable style={styles.sidePill} onPress={() => setMenuFor('top')} accessibilityLabel="Import or export">
              <Feather name="file-text" size={15} color={T.ink} />
              <Text style={styles.sidePillText}>Excel</Text>
            </Pressable>
          }
          contentStyle={styles.menu}
        >
          <Menu.Item
            leadingIcon="tray-arrow-down"
            title="Import from Excel"
            onPress={() => {
              setMenuFor(null);
              setImporting({ target: null });
            }}
          />
          <Menu.Item
            leadingIcon="tray-arrow-up"
            title={query.trim() ? 'Export these' : 'Export all'}
            onPress={() => {
              setMenuFor(null);
              void doExport(groups, 'Navgrah Leads');
            }}
          />
        </Menu>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {isLoading ? (
          <ActivityIndicator color={T.charcoal} style={{ marginTop: 40 }} />
        ) : groups.length === 0 && !query.trim() ? (
          <View style={styles.empty}>
            <NavgrahLogo size={44} color={T.ink} bg={T.soft} />
            <Text style={styles.emptyTitle}>No leads yet</Text>
            <Text style={styles.emptySub}>Add a banquet below, then add leads or import them from Excel.</Text>
          </View>
        ) : groups.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches</Text>
            <Text style={styles.emptySub}>Try a different search.</Text>
          </View>
        ) : (
          groups.map((g) => {
            const open = !!query.trim() || openIds.has(g.id);
            const next = nextDate(g);
            return (
              <View key={g.id} style={styles.group}>
                <Pressable
                  onPress={() => toggle(g.id)}
                  style={({ pressed }) => [styles.groupRow, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  accessibilityLabel={`${g.name}, ${g.leads.length} leads`}
                >
                  <View style={styles.groupIcon}>
                    <Feather name={g.banquet ? 'home' : 'help-circle'} size={16} color={T.ink} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.groupName} numberOfLines={1}>
                      {g.name}
                    </Text>
                    <Text style={styles.groupMeta} numberOfLines={1}>
                      {g.leads.length === 0
                        ? 'No leads yet'
                        : `${g.leads.length} ${g.leads.length === 1 ? 'lead' : 'leads'}${next ? ` · next ${next}` : ''}`}
                    </Text>
                  </View>
                  <Menu
                    visible={menuFor === g.id}
                    onDismiss={() => setMenuFor(null)}
                    anchor={
                      <Pressable onPress={() => setMenuFor(g.id)} style={styles.dots} hitSlop={6} accessibilityLabel={`More for ${g.name}`}>
                        <Feather name="more-vertical" size={16} color={T.ink} />
                      </Pressable>
                    }
                    contentStyle={styles.menu}
                  >
                    {g.banquet ? (
                      <Menu.Item
                        leadingIcon="plus"
                        title="Add a lead here"
                        onPress={() => {
                          setMenuFor(null);
                          setSheet({ lead: null, banquetId: g.banquet!.id });
                        }}
                      />
                    ) : null}
                    {g.leads.some((l) => l.contact) ? (
                      <Menu.Item
                        leadingIcon="account-plus-outline"
                        title="Save all to phone"
                        onPress={() => {
                          setMenuFor(null);
                          void saveAllToPhone(g);
                        }}
                      />
                    ) : null}
                    {g.banquet ? (
                      <Menu.Item
                        leadingIcon="tray-arrow-down"
                        title="Import into this"
                        onPress={() => {
                          setMenuFor(null);
                          setImporting({ target: g.banquet });
                        }}
                      />
                    ) : null}
                    {g.leads.length ? (
                      <Menu.Item
                        leadingIcon="tray-arrow-up"
                        title="Export"
                        onPress={() => {
                          setMenuFor(null);
                          void doExport([g], `${g.name} leads`);
                        }}
                      />
                    ) : null}
                    {g.banquet ? (
                      <Menu.Item
                        leadingIcon="trash-can-outline"
                        title="Remove banquet"
                        onPress={() => {
                          setMenuFor(null);
                          removeBanquet(g);
                        }}
                      />
                    ) : null}
                  </Menu>
                  <Chevron open={open} color={T.mute} />
                </Pressable>

                {open && g.leads.length > 0 ? (
                  <DropdownBody>
                    <View style={styles.listCard}>
                      {g.leads.map((l, i) => (
                        <Pressable
                          key={l.id}
                          onPress={() => setSheet({ lead: l, banquetId: l.banquet_id })}
                          style={({ pressed }) => [styles.lead, i > 0 && styles.leadDivided, pressed && { backgroundColor: T.soft }]}
                          accessibilityRole="button"
                          accessibilityLabel={`${l.name ?? 'Lead'}${l.function ? `, ${l.function}` : ''}`}
                        >
                          <View style={styles.dateBox}>
                            {l.dof ? (
                              <>
                                <Text style={styles.dateDay}>{format(parseISO(l.dof), 'd')}</Text>
                                <Text style={styles.dateMon}>{format(parseISO(l.dof), 'MMM')}</Text>
                              </>
                            ) : (
                              <Text style={styles.dateMon}>—</Text>
                            )}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={styles.leadName} numberOfLines={1}>
                              {l.name || 'No name'}
                              {l.function ? <Text style={styles.leadFn}>{`  ·  ${l.function}`}</Text> : null}
                            </Text>
                            {l.contact ? (
                              <Text
                                style={styles.leadPhone}
                                numberOfLines={1}
                                onPress={() => Linking.openURL(telUrl(l.contact!))}
                                accessibilityRole="link"
                                accessibilityLabel={`Call ${l.contact}`}
                              >
                                <Feather name="phone" size={12} color={T.blue} /> {l.contact}
                              </Text>
                            ) : null}
                            {l.remarks ? (
                              <Text style={styles.leadRemarks} numberOfLines={2}>
                                {l.remarks}
                              </Text>
                            ) : null}
                          </View>
                          {l.contact ? (
                            <View style={styles.rowBtns}>
                              <Pressable
                                onPress={() => Linking.openURL(whatsappUrl(l.contact!)).catch(() => setSnack('Could not open WhatsApp'))}
                                style={styles.saveBtn}
                                hitSlop={4}
                                accessibilityLabel={`WhatsApp ${l.name ?? 'this lead'}`}
                              >
                                <MaterialCommunityIcons name="whatsapp" size={18} color={WHATSAPP_GREEN} />
                              </Pressable>
                              <Pressable
                                onPress={() => void saveOne(l)}
                                style={styles.saveBtn}
                                hitSlop={4}
                                accessibilityLabel={`Save ${l.name ?? 'this lead'} to phone`}
                              >
                                <Feather name="user-plus" size={16} color={T.ink} />
                              </Pressable>
                            </View>
                          ) : null}
                        </Pressable>
                      ))}
                    </View>
                  </DropdownBody>
                ) : null}
              </View>
            );
          })
        )}

        {/* Banquets are added here, on the list. */}
        {!isLoading && !query.trim() ? (
          newBanquet === null ? (
            <Pressable style={styles.addBtn} onPress={() => setNewBanquet('')} accessibilityRole="button">
              <Feather name="plus" size={15} color={T.ink} />
              <Text style={styles.addText}>Add banquet</Text>
            </Pressable>
          ) : (
            <View style={styles.newRow}>
              <PaperOutlinedField
                label="Banquet name"
                value={newBanquet}
                onChangeText={setNewBanquet}
                style={{ flex: 1 }}
                maxLength={120}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => void saveBanquet()}
              />
              <Pressable style={styles.dots} onPress={() => setNewBanquet(null)} accessibilityLabel="Cancel">
                <Feather name="x" size={16} color={T.inkSoft} />
              </Pressable>
              <Pressable style={[styles.dots, { backgroundColor: T.charcoal }]} onPress={() => void saveBanquet()} disabled={addingBanquet} accessibilityLabel="Save banquet">
                {addingBanquet ? <ActivityIndicator color={T.white} /> : <Feather name="check" size={16} color={T.white} />}
              </Pressable>
            </View>
          )
        ) : null}

        {!isLoading && leads.length > 0 ? (
          <Text style={styles.hint}>Tap a number to call · the green icon opens WhatsApp · the person icon saves a lead to your phone · tap a lead for details</Text>
        ) : null}
      </ScrollView>

      {sheet ? (
        <LeadSheet
          lead={sheet.lead}
          banquets={banquets}
          defaultBanquetId={sheet.banquetId}
          onDismiss={() => setSheet(null)}
          onSaved={(m) => {
            setSnack(m);
            void load();
          }}
        />
      ) : null}

      {importing ? (
        <LeadsImportSheet
          banquets={banquets}
          target={importing.target}
          onDismiss={() => setImporting(null)}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, marginRight: 10 },
  // Smaller than other screen titles so "Navgrah Leads" fits; wraps on small phones.
  title: { fontSize: 24, lineHeight: 29 },
  back: { width: 32, height: 40, justifyContent: 'center', marginLeft: -8 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  searchWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 46,
    borderRadius: 16,
    paddingHorizontal: 14,
    backgroundColor: T.card,
    ...screenChrome.card,
  },
  search: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink },
  sidePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: T.card,
    ...screenChrome.card,
  },
  sidePillText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  menu: { backgroundColor: T.card, borderRadius: 14 },
  body: { paddingHorizontal: 20, paddingBottom: 130 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink, marginTop: 4 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute, textAlign: 'center' },
  group: { marginBottom: 10 },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 18,
    paddingVertical: 11,
    paddingHorizontal: 12,
    ...screenChrome.card,
  },
  groupIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  groupName: { fontFamily: 'Inter_700Bold', fontSize: 15.5, color: T.ink },
  groupMeta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 1 },
  dots: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  listCard: { marginTop: 8, backgroundColor: T.card, borderRadius: 18, overflow: 'hidden', ...screenChrome.card },
  lead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  leadDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.hairline },
  dateBox: { width: 46, height: 46, borderRadius: 12, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  dateDay: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink, lineHeight: 19 },
  dateMon: { fontFamily: 'Inter_600SemiBold', fontSize: 11, color: T.inkSoft, textTransform: 'uppercase' },
  leadName: { fontFamily: 'Inter_700Bold', fontSize: 14.5, color: T.ink },
  leadFn: { fontFamily: 'Inter_500Medium', color: T.inkSoft },
  leadPhone: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.blue, marginTop: 3 },
  leadRemarks: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.inkSoft, marginTop: 3, lineHeight: 18 },
  rowBtns: { flexDirection: 'row', gap: 6 },
  saveBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  addBtn: {
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
  addText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2, marginBottom: 6 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, textAlign: 'center', marginTop: 10 },
});
