// ============================================================================
// VEBOSSO EMS — Access, the simple way (what the owner's access sheet edits)
// Two switches and one list:
//   create   they can add new ones (and always see and change what they add)
//   del      they can delete — only what they are allowed to change
//   all      every one of this kind: none / see / see + change
//   items    each city / banquet / brand, and each other person's: same choice
// Any row can have its own time limit; the rest use the overall end. This file
// turns that into the rules the database stores (migrations 062–064) and back.
// ============================================================================

import { addDays, addHours, addMinutes, addMonths, endOfDay, format, isSameDay, parseISO } from 'date-fns';
import { AccessRule, RuleDraft, RuleFeature, SCOPE_BY_FEATURE } from './accessRules';

export type See = 'none' | 'see' | 'change';

/** How long. 'keep' is an exact end already stored (e.g. a 30-minute grant being re-saved). */
export type Until = 'none' | '30m' | '1h' | '4h' | '1d' | '1w' | '1m' | 'date' | 'keep';

export interface Limit {
  until: Until;
  /** yyyy-MM-dd for 'date'. */
  date: string | null;
  /** The exact end for 'keep'. */
  iso: string | null;
}

export interface SimpleAccess {
  create: boolean;
  del: boolean;
  all: See;
  /** By row key: place:<id> or person:<id>. */
  items: Record<string, See>;
  /** The overall end, for adding and for rows without their own. */
  until: Until;
  date: string | null;
  /** The exact overall end when until is 'keep'. */
  iso: string | null;
  /** Rows with their own time limit: 'all', place:<id>, person:<id>. */
  limits: Record<string, Limit>;
}

export const rowKey = {
  all: 'all',
  place: (id: string) => `place:${id}`,
  person: (id: string) => `person:${id}`,
};

export const emptyAccess = (): SimpleAccess => ({
  create: false,
  del: false,
  all: 'none',
  items: {},
  until: 'none',
  date: null,
  iso: null,
  limits: {},
});

export const PRESETS: { key: string; label: string; make: () => SimpleAccess }[] = [
  { key: 'own', label: 'Only their own', make: () => ({ ...emptyAccess(), create: true, del: true }) },
  { key: 'view', label: 'See all, change nothing', make: () => ({ ...emptyAccess(), all: 'see' }) },
  { key: 'edit', label: 'See and change all', make: () => ({ ...emptyAccess(), create: true, all: 'change' }) },
];

// ---------------------------------------------------------------------------
// Time

export const UNTIL_LABEL: Record<Until, string> = {
  none: 'No end',
  '30m': '30 min',
  '1h': '1 hour',
  '4h': '4 hours',
  '1d': '1 day',
  '1w': '1 week',
  '1m': '1 month',
  date: 'Pick date',
  keep: 'Current end',
};

/** When a limit ends, counted from `now`. null = no end. */
export const expiryOf = (l: Pick<Limit, 'until' | 'date'> & { iso?: string | null }, now = new Date()): string | null => {
  switch (l.until) {
    case '30m':
      return addMinutes(now, 30).toISOString();
    case '1h':
      return addHours(now, 1).toISOString();
    case '4h':
      return addHours(now, 4).toISOString();
    case '1d':
      return addDays(now, 1).toISOString();
    case '1w':
      return addDays(now, 7).toISOString();
    case '1m':
      return addMonths(now, 1).toISOString();
    case 'date':
      return l.date ? endOfDay(parseISO(l.date)).toISOString() : null;
    case 'keep':
      return l.iso ?? null;
    default:
      return null;
  }
};

/** "Ended", "until 3:45 pm" (today) or "until 30 Nov, 3:45 pm". */
export const endText = (iso: string): string => {
  const d = new Date(iso);
  if (d.getTime() <= Date.now()) return 'Ended';
  return isSameDay(d, new Date()) ? `until ${format(d, 'h:mm a')}` : `until ${format(d, 'd MMM, h:mm a')}`;
};

/** A limit in a few words: "for 30 min", "until 30 Nov", "until 3:45 pm". */
export const limitText = (l: Limit): string => {
  if (l.until === 'none') return '';
  if (l.until === 'keep') return l.iso ? endText(l.iso) : '';
  if (l.until === 'date') return l.date ? `until ${format(parseISO(l.date), 'd MMM')}` : '';
  return `for ${UNTIL_LABEL[l.until]}`;
};

// ---------------------------------------------------------------------------
// Access → rules

const NO_TICKS = { can_add: false, can_edit: false, can_delete: false, others_can_edit: false, others_can_delete: false };

export function toRules(a: SimpleAccess, feature: RuleFeature, now = new Date()): RuleDraft[] {
  const overall = expiryOf(a, now);
  const endFor = (key: string) => (a.limits[key] ? expiryOf(a.limits[key], now) : overall);
  const out: RuleDraft[] = [];
  const base = { scope_ids: [] as string[], scope_values: [] as string[] };
  /** Ticks for a row: "see" changes nothing; "change" edits (and deletes, if allowed) anyone's. */
  const ticksFor = (s: See) =>
    s === 'change'
      ? { ...NO_TICKS, can_edit: true, can_delete: a.del, others_can_edit: true, others_can_delete: a.del }
      : NO_TICKS;
  /** What adding gives on their own ones. */
  const ownTicks = { can_add: true, can_edit: true, can_delete: a.del };

  if (a.all !== 'none') out.push({ ...base, scope: 'all', expires_at: endFor(rowKey.all), ...ticksFor(a.all) });

  // Rows are grouped: same kind, same choice, same end → one rule.
  type G = { see: See; ids: string[]; expires_at: string | null };
  const group = (prefix: 'place:' | 'person:') => {
    const groups = new Map<string, G>();
    for (const [key, see] of Object.entries(a.items)) {
      if (!key.startsWith(prefix) || see === 'none') continue;
      // Below "all" there is nothing to add: "see" when all is seen, anything when all is changed.
      if (a.all === 'change' || (a.all === 'see' && see === 'see')) continue;
      const expires_at = endFor(key);
      const k = `${see}|${expires_at ?? ''}`;
      const g = groups.get(k) ?? { see, ids: [], expires_at };
      g.ids.push(key.slice(prefix.length));
      groups.set(k, g);
    }
    return [...groups.values()];
  };

  const placeScope = SCOPE_BY_FEATURE[feature];
  const places = group('place:');
  // Limited to some cities / banquets / brands and nothing open overall: what
  // they add stays inside those, not anywhere. So adding is folded into them.
  const fold = a.create && a.all === 'none' && places.length > 0;
  if (a.create && !fold) out.push({ ...base, scope: 'own', expires_at: overall, ...NO_TICKS, ...ownTicks });

  for (const g of places) {
    const t = { ...ticksFor(g.see), ...(fold ? ownTicks : {}) };
    out.push(
      placeScope === 'brands'
        ? { ...base, scope: 'brands', scope_values: g.ids, expires_at: g.expires_at, ...t }
        : { ...base, scope: placeScope, scope_ids: g.ids, expires_at: g.expires_at, ...t },
    );
  }
  for (const g of group('person:')) {
    out.push({ ...base, scope: 'people', scope_ids: g.ids, expires_at: g.expires_at, ...ticksFor(g.see) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rules → access

const seeOf = (r: AccessRule): See => (r.others_can_edit ? 'change' : 'see');
const more = (x: See | undefined, y: See): See => (x === 'change' || y === 'change' ? 'change' : x === 'see' || y === 'see' ? 'see' : 'none');

export function fromRules(rules: AccessRule[], feature: RuleFeature): SimpleAccess {
  const a = emptyAccess();
  const placeScope = SCOPE_BY_FEATURE[feature];
  // Each row's end: from the rule that gave it the most (the later end on a tie).
  const ends = new Map<string, { see: See; iso: string | null }>();
  const note = (key: string, see: See, iso: string | null) => {
    const old = ends.get(key);
    const rank = (s: See) => (s === 'change' ? 2 : s === 'see' ? 1 : 0);
    const later = !old || (old.iso !== null && (iso === null || iso > old.iso));
    if (!old || rank(see) > rank(old.see) || (see === old.see && later)) ends.set(key, { see, iso });
  };

  for (const r of rules) {
    if (r.can_add) a.create = true;
    if (r.can_delete || r.others_can_delete) a.del = true;
    switch (r.scope) {
      case 'all':
        a.all = more(a.all, seeOf(r));
        note(rowKey.all, seeOf(r), r.expires_at);
        break;
      case 'people':
        for (const id of r.scope_ids) {
          a.items[rowKey.person(id)] = more(a.items[rowKey.person(id)], seeOf(r));
          note(rowKey.person(id), seeOf(r), r.expires_at);
        }
        break;
      case 'cities':
      case 'banquets':
      case 'brands': {
        if (r.scope !== placeScope) break;
        for (const id of r.scope === 'brands' ? r.scope_values : r.scope_ids) {
          a.items[rowKey.place(id)] = more(a.items[rowKey.place(id)], seeOf(r));
          note(rowKey.place(id), seeOf(r), r.expires_at);
        }
        break;
      }
      case 'own':
        break;
    }
  }
  // The overall end: the adding rule's, else the "all" row's, else one end every rule shares.
  const own = rules.find((r) => r.scope === 'own');
  const shared = new Set(rules.map((r) => r.expires_at)).size === 1 ? rules[0]?.expires_at ?? null : null;
  const overall = own ? own.expires_at : ends.get(rowKey.all)?.iso ?? shared;
  if (overall) {
    a.until = 'keep';
    a.iso = overall;
  }
  // Rows that end at another time keep it as their own limit.
  for (const [key, e] of ends) {
    if (e.iso === overall) continue;
    a.limits[key] = e.iso ? { until: 'keep', date: null, iso: e.iso } : { until: 'none', date: null, iso: null };
  }
  return a;
}

// ---------------------------------------------------------------------------
// Words

/** "see all bills · see and change Navgrah · add new bills · delete what they can change". */
export function describeAccess(
  a: SimpleAccess,
  noun: string,
  placeName: (id: string) => string,
  personName: (id: string) => string,
): string {
  const when = (key: string) => {
    const l = a.limits[key];
    const t = l ? limitText(l) : '';
    return t ? ` (${t})` : '';
  };
  const verb = (s: See) => (s === 'change' ? 'see and change' : 'see');
  const parts: string[] = [];
  if (a.all !== 'none') parts.push(`${verb(a.all)} all ${noun}${when(rowKey.all)}`);
  const placeIds: string[] = [];
  for (const [key, see] of Object.entries(a.items)) {
    if (see === 'none' || a.all === 'change' || (a.all === 'see' && see === 'see')) continue;
    const name = key.startsWith('place:') ? placeName(key.slice(6)) : `${personName(key.slice(7))}’s ${noun}`;
    if (key.startsWith('place:')) placeIds.push(key.slice(6));
    parts.push(`${a.all === 'see' ? 'change' : verb(see)} ${name}${when(key)}`);
  }
  if (a.create) {
    const inside = a.all === 'none' && placeIds.length ? ` in ${placeIds.map(placeName).join(', ')}` : '';
    parts.push(`add new ${noun}${inside}`);
  }
  if (a.del) parts.push(a.create || a.all === 'change' || parts.length ? 'delete what they can change' : 'delete');
  return parts.length ? parts.join(' · ') : 'nothing yet';
}
