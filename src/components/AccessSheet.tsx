// ============================================================================
//  VEBOSSO EMS — Access for one person and one feature (Venues, Bills, Leads)
// The owner's sheet, kept plain:
//   • Can add new … (switch) — they always see and edit what they add
//   • Can delete (switch) — only what they are allowed to edit
//   • Which … can they see? — "All" plus one row per city / banquet / brand and
//     per person, each None / See / See + change. Rows never repeat "All": when
//     all can be seen, a row only asks "can change?"; when all can be changed,
//     those rows are not needed and hide.
//   • A person can also be set to Hide: nothing they added is shown, even where
//     another row allows it (066).
// Any row can have its own time limit (say one person's bills for 30 minutes);
// the rest use the overall end. Stored as rules by lib/accessSimple, enforced
// by the database (migrations 062–066).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Switch, Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { FEATURE_NOUN, fetchContributorIds, fetchRules, RuleFeature, saveRules, SCOPE_BY_FEATURE } from '../lib/accessRules';
import {
  describeAccess,
  emptyAccess,
  endText,
  expiryOf,
  fromRules,
  Limit,
  limitText,
  PRESETS,
  rowKey,
  See,
  SimpleAccess,
  toRules,
  Until,
  UNTIL_LABEL,
} from '../lib/accessSimple';
import { BRAND_KEYS, BRANDS } from '../lib/billBrands';
import { fetchBanquets } from '../lib/leads';
import { fetchCities } from '../lib/venues';
import { useAuthStore } from '../store/authStore';
import { useWorkStore } from '../store/workStore';
import { DateField } from './DateTimeFields';
import { SheetFrame } from './SheetFrame';

const TITLE: Record<RuleFeature, string> = { venues: 'Venues', bills: 'Bills', leads: 'Navgrah Leads' };
const PLACE_HEADING: Record<RuleFeature, string> = { venues: 'Cities', bills: 'Brands', leads: 'Banquets' };
const OVERALL: Until[] = ['none', '30m', '1h', '1d', '1w', '1m', 'date'];
/** People listed before "Show all". */
const PEOPLE_FIRST = 5;
const ROW_LIMITS: Until[] = ['30m', '1h', '4h', '1d', '1w', 'date'];
const SEE_OPTIONS: { key: See; label: string }[] = [
  { key: 'none', label: 'None' },
  { key: 'see', label: 'See' },
  { key: 'change', label: 'See + edit' },
];

export function AccessSheet({
  userId,
  userName,
  feature,
  onDismiss,
  onSaved,
}: {
  userId: string;
  userName: string;
  feature: RuleFeature;
  onDismiss: () => void;
  onSaved: (message: string) => void;
}) {
  const ownerId = useAuthStore((s) => s.profile?.id);
  const team = useWorkStore((s) => s.teamMembers);
  const first = userName.split(' ')[0];
  const noun = FEATURE_NOUN[feature];
  // Bills are made; venues and leads are added.
  const verb = feature === 'bills' ? 'made' : 'added';

  const [a, setA] = useState<SimpleAccess>(emptyAccess);
  const [hadRules, setHadRules] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showAllPeople, setShowAllPeople] = useState(false);
  const [placeList, setPlaceList] = useState<{ id: string; name: string }[]>([]);
  // People worth listing: they have this feature, or have added something in it.
  const [relevant, setRelevant] = useState<Set<string> | null>(null);

  const places = useMemo(
    () => (SCOPE_BY_FEATURE[feature] === 'brands' ? BRAND_KEYS.map((b) => ({ id: b, name: BRANDS[b].label })) : placeList),
    [feature, placeList],
  );
  const people = useMemo(
    () =>
      team
        .filter((m) => m.id !== userId)
        // Keep anyone who already has a setting, so it never disappears.
        .filter((m) => relevant === null || relevant.has(m.id) || (a.items[rowKey.person(m.id)] ?? 'none') !== 'none')
        .map((m) => ({ id: m.id, name: m.full_name })),
    [team, userId, relevant, a.items],
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const [rules, list, who] = await Promise.all([
        fetchRules(userId, feature),
        feature === 'venues' ? fetchCities() : feature === 'leads' ? fetchBanquets() : Promise.resolve(null),
        fetchContributorIds(feature),
      ]);
      if (!active) return;
      setRelevant(who);
      if (rules.success) {
        const loaded = fromRules(rules.data, feature);
        setA(loaded);
        setHadRules(rules.data.length > 0);
      } else setError(rules.error);
      if (list?.success) setPlaceList(list.data.map((x) => ({ id: x.id, name: x.name })));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [userId, feature]);

  const placeName = (id: string) => places.find((p) => p.id === id)?.name ?? 'Removed';
  const personName = (id: string) => team.find((m) => m.id === id)?.full_name ?? 'Someone';

  const change = (patch: Partial<SimpleAccess>) => {
    setA((prev) => ({ ...prev, ...patch }));
    if (error) setError('');
  };
  const setItem = (key: string, see: See) => setA((prev) => ({ ...prev, items: { ...prev.items, [key]: see } }));
  const setLimit = (key: string, l: Limit | null) =>
    setA((prev) => {
      const limits = { ...prev.limits };
      if (l) limits[key] = l;
      else delete limits[key];
      return { ...prev, limits };
    });

  const drafts = useMemo(() => toRules(a, feature), [a, feature]);
  const summary = describeAccess(a, noun, placeName, personName);
  const overallText =
    a.until === 'keep' && a.iso ? ` · ${endText(a.iso)}` : a.until !== 'none' ? ` · ${limitText({ until: a.until, date: a.date, iso: null })}` : '';

  const save = async () => {
    if (!ownerId) return;
    if (a.until === 'date' && !a.date) return setError('Pick the date this ends');
    if (Object.values(a.limits).some((l) => l.until === 'date' && !l.date)) return setError('Pick the date for the row with a time limit');
    const end = expiryOf(a);
    if (a.until !== 'keep' && end && new Date(end).getTime() <= Date.now()) return setError('An end date has to be in the future');
    // Counted from now; anything that has already ended is dropped.
    const now = new Date();
    const fresh = toRules(a, feature, now).filter((d) => !d.expires_at || new Date(d.expires_at).getTime() > now.getTime());
    setSaving(true);
    const res = await saveRules(userId, feature, fresh, ownerId, `You can: ${summary}${overallText}`);
    setSaving(false);
    if (!res.success) return setError(res.error);
    onSaved(fresh.length ? `${TITLE[feature]} access saved for ${first}` : `${TITLE[feature]} removed for ${first}`);
    onDismiss();
  };

  const nothing = drafts.length === 0;
  const footer = loading ? null : (
    <View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={[styles.saveBtn, (saving || (nothing && !hadRules)) && { opacity: 0.6 }]}
        onPress={() => void save()}
        disabled={saving || (nothing && !hadRules)}
      >
        {saving ? (
          <ActivityIndicator color={T.white} />
        ) : (
          <Text style={styles.saveText}>{nothing ? (hadRules ? `Remove ${TITLE[feature]} access` : 'Nothing set yet') : 'Save access'}</Text>
        )}
      </Pressable>
    </View>
  );

  /** One row in the list: the three choices, or just "can edit" when all are seen anyway. */
  const itemRow = (key: string, title: string, sub: string, last: boolean) => {
    const value = a.items[key] ?? 'none';
    return (
      <ItemRow
        key={key}
        title={title}
        sub={sub}
        value={value}
        checkOnly={a.all === 'see'}
        onChange={(v) => setItem(key, v)}
        limit={a.limits[key]}
        onLimit={(l) => setLimit(key, l)}
        last={last}
      />
    );
  };

  /**
   * One person: Hide, Default (only what the rows above give), or more. The
   * "more" choices shrink as "All" grows, so nothing repeats it.
   */
  const personRow = (id: string, name: string, last: boolean) => {
    const key = rowKey.person(id);
    const stored = a.items[key] ?? 'none';
    const shown: See =
      stored === 'hide' ? 'hide' : a.all === 'change' || (a.all === 'see' && stored === 'see') ? 'none' : stored;
    const options: { key: See; label: string }[] = [
      { key: 'hide', label: 'Hide' },
      { key: 'none', label: 'Default' },
      ...(a.all === 'none' ? [{ key: 'see' as See, label: 'See' }] : []),
      ...(a.all !== 'change' ? [{ key: 'change' as See, label: a.all === 'see' ? 'Edit' : 'See + edit' }] : []),
    ];
    return (
      <ItemRow
        key={key}
        title={name}
        sub={`${noun[0].toUpperCase()}${noun.slice(1)} ${name.split(' ')[0]} ${verb}`}
        value={shown}
        options={options}
        onChange={(v) => setItem(key, v)}
        limit={a.limits[key]}
        onLimit={(l) => setLimit(key, l)}
        last={last}
      />
    );
  };

  const pickedPeople = Object.entries(a.items).filter(([k, v]) => k.startsWith('person:') && v !== 'none').length;

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={`${TITLE[feature]} · ${first}`}
      subtitle="What they can see and do"
      icon="shield"
      iconColor={T.violet}
      iconBg={T.violetSoft}
      footer={footer}
    >
      {loading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 32 }} />
      ) : (
        <View>
          <Text style={styles.summary}>
            {first} can: {summary}
            {overallText}
          </Text>

          <View style={styles.chips}>
            {PRESETS.map((p) => (
              <Pressable
                key={p.key}
                style={styles.chip}
                onPress={() => {
                  setA({ ...p.make(), until: a.until, date: a.date, iso: a.iso });
                  setError('');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>{p.label}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[styles.group, { marginTop: 16 }]}>
            <SwitchRow
              title={`Can add new ${noun}`}
              sub={`They always see and edit the ${noun} they add`}
              value={a.create}
              onChange={(v) => change({ create: v })}
            />
            <SwitchRow
              title="Can delete"
              sub="Only what they’re allowed to edit"
              value={a.del}
              onChange={(v) => change({ del: v })}
              last
            />
          </View>

          <Text style={styles.label}>Which {noun} can they see?</Text>
          <View style={styles.group}>
            <ItemRow
              title={`All ${noun}`}
              sub={`Including ones ${verb} later`}
              value={a.all}
              onChange={(v) => change({ all: v })}
              limit={a.limits[rowKey.all]}
              onLimit={(l) => setLimit(rowKey.all, l)}
              last
            />
          </View>

          {a.all === 'change' ? (
            <Text style={styles.note}>They can see and edit every one, so there’s no {PLACE_HEADING[feature].toLowerCase()} to pick.</Text>
          ) : (
            <>
              <Text style={styles.label}>
                {a.all === 'see' ? `They see all. Let them also edit:` : `Or only some — ${PLACE_HEADING[feature].toLowerCase()}`}
              </Text>
              {places.length === 0 ? (
                <Text style={styles.note}>No {PLACE_HEADING[feature].toLowerCase()} added yet.</Text>
              ) : (
                <View style={styles.group}>
                  {places.map((p, i) => itemRow(rowKey.place(p.id), p.name, `${noun[0].toUpperCase()}${noun.slice(1)} anyone ${verb} here`, i === places.length - 1))}
                </View>
              )}
            </>
          )}

          {people.length > 0 ? (
            <>
              <Text style={styles.label}>
                Certain people’s {noun}
                {pickedPeople ? ` · ${pickedPeople} set` : ''}
              </Text>
              {(() => {
                // Anyone already set comes first; the rest fold away when there are many.
                const set = (id: string) => (a.items[rowKey.person(id)] ?? 'none') !== 'none';
                const sorted = [...people].sort((x, y) => Number(set(y.id)) - Number(set(x.id)));
                const shown = showAllPeople ? sorted : sorted.slice(0, Math.max(PEOPLE_FIRST, pickedPeople));
                return (
                  <>
                    <View style={styles.group}>{shown.map((p, i) => personRow(p.id, p.name, i === shown.length - 1))}</View>
                    {sorted.length > shown.length ? (
                      <Pressable style={styles.morePeople} onPress={() => setShowAllPeople(true)} accessibilityRole="button">
                        <Text style={styles.morePeopleText}>Show all {sorted.length} people</Text>
                        <Feather name="chevron-down" size={15} color={T.ink} />
                      </Pressable>
                    ) : null}
                  </>
                );
              })()}
            </>
          ) : null}

          <Text style={styles.label}>Until when</Text>
          <View style={styles.chips}>
            {a.until === 'keep' && a.iso ? (
              <View style={[styles.chip, styles.chipOn]}>
                <Text style={[styles.chipText, styles.chipTextOn]}>{endText(a.iso)}</Text>
              </View>
            ) : null}
            {OVERALL.map((u) => {
              const on = a.until === u;
              return (
                <Pressable
                  key={u}
                  onPress={() => change({ until: u, iso: null })}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>
                    {u === 'date' && on && a.date ? format(parseISO(a.date), 'd MMM yyyy') : UNTIL_LABEL[u]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {a.until === 'date' ? <DateField label="Ends on" value={a.date} onChange={(v) => change({ date: v })} allow="future" /> : null}
          <Text style={styles.note}>A row with its own ⏱ time limit ends at that time instead.</Text>
        </View>
      )}
    </SheetFrame>
  );
}

function SwitchRow({ title, sub, value, onChange, last }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <Pressable style={[styles.switchRow, !last && styles.rowDivider]} onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} color={T.violet} />
    </Pressable>
  );
}

/**
 * One thing in the list. Normally None / See / See + change; with `checkOnly`
 * (everything is already seen) just a "Can edit" checkbox. Once it has
 * access, a ⏱ line sets a time limit for this row alone.
 */
function ItemRow({
  title,
  sub,
  value,
  checkOnly,
  options,
  onChange,
  limit,
  onLimit,
  last,
}: {
  title: string;
  sub: string;
  value: See;
  checkOnly?: boolean;
  /** Choices to show instead of None / See / See + change (people rows). */
  options?: { key: See; label: string }[];
  onChange: (v: See) => void;
  limit?: Limit;
  onLimit: (l: Limit | null) => void;
  last?: boolean;
}) {
  const [limitOpen, setLimitOpen] = useState(false);
  const asCheck = checkOnly && !options;
  const active = asCheck ? value === 'change' : value !== 'none';
  const limited = !!limit && limit.until !== 'none';
  const endIso = limit ? expiryOf(limit) : null;
  const ended = !!endIso && new Date(endIso).getTime() <= Date.now();

  return (
    <View style={[styles.row, !last && styles.rowDivider]}>
      {asCheck ? (
        <Pressable
          style={styles.checkRow}
          onPress={() => onChange(value === 'change' ? 'none' : 'change')}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: value === 'change' }}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowSub}>{sub}</Text>
          </View>
          <View style={[styles.box, value === 'change' && styles.boxOn]}>
            {value === 'change' ? <Feather name="check" size={14} color={T.white} /> : null}
          </View>
        </Pressable>
      ) : (
        <>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{sub}</Text>
          <View style={styles.seg}>
            {(options ?? SEE_OPTIONS).map((o) => {
              const on = value === o.key;
              return (
                <Pressable
                  key={o.key}
                  onPress={() => onChange(o.key)}
                  style={[styles.segBtn, on && (o.key === 'none' ? styles.segNone : o.key === 'hide' ? styles.segHide : styles.segOn)]}
                  accessibilityRole="radio"
                  accessibilityLabel={`${title}: ${o.label}`}
                  accessibilityState={{ checked: on }}
                >
                  <Text style={[styles.segText, on && { color: T.white }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {active ? (
        <>
          <Pressable style={styles.limitLink} onPress={() => setLimitOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: limitOpen }}>
            <Feather name="clock" size={13} color={ended ? T.coral : limited ? T.violet : T.mute} />
            <Text style={[styles.limitText, limited && { color: ended ? T.coral : T.violet }]}>
              {limited ? (ended ? 'Ended' : limitText(limit!)) : 'Time limit'}
            </Text>
            <Feather name={limitOpen ? 'chevron-up' : 'chevron-down'} size={13} color={T.mute} />
          </Pressable>
          {limitOpen ? (
            <View>
              <View style={styles.limitChips}>
                <Pressable style={[styles.limitChip, !limited && styles.limitChipOn]} onPress={() => onLimit(null)} accessibilityRole="button">
                  <Text style={[styles.limitChipText, !limited && { color: T.white }]}>Same as overall</Text>
                </Pressable>
                {ROW_LIMITS.map((u) => {
                  const on = limit?.until === u;
                  return (
                    <Pressable
                      key={u}
                      style={[styles.limitChip, on && styles.limitChipOn]}
                      onPress={() => {
                        onLimit({ until: u, date: u === 'date' ? limit?.date ?? null : null, iso: null });
                        if (u !== 'date') setLimitOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                    >
                      <Text style={[styles.limitChipText, on && { color: T.white }]}>{UNTIL_LABEL[u]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {limit?.until === 'date' ? (
                <DateField label="Ends on" value={limit.date} onChange={(v) => onLimit({ until: 'date', date: v, iso: null })} allow="future" />
              ) : null}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink, lineHeight: 20, padding: 12, borderRadius: 12, backgroundColor: T.violetSoft, marginBottom: 12 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 11.5, color: T.mute, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, height: 34, borderRadius: 17, backgroundColor: T.soft },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  group: { backgroundColor: T.card, borderRadius: 16, borderWidth: 1, borderColor: T.soft2, overflow: 'hidden' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  row: { paddingHorizontal: 14, paddingVertical: 12 },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.hairline },
  rowTitle: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  rowSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 1 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, borderColor: T.soft2, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: T.violet, borderColor: T.violet },
  seg: { flexDirection: 'row', gap: 6, marginTop: 10 },
  segBtn: { flex: 1, height: 38, borderRadius: 10, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  segOn: { backgroundColor: T.violet },
  segNone: { backgroundColor: T.charcoal },
  segHide: { backgroundColor: T.coral },
  segText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  limitLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 10, paddingVertical: 2 },
  limitText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: T.mute },
  limitChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  limitChip: { paddingHorizontal: 11, height: 30, borderRadius: 15, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  limitChipOn: { backgroundColor: T.violet },
  limitChipText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: T.inkSoft },
  morePeople: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 42, marginTop: 8, borderRadius: 12, backgroundColor: T.soft },
  morePeopleText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.ink },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 8 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  saveBtn: { height: 48, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
