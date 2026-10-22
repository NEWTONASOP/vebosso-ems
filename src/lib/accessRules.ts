// ============================================================================
// VEBOSSO EMS — Detailed access for Venues, Bills and Leads (migration 062)
// A person can have several rules per feature. Each says what they can see
// (their own, everyone's, named people's, named cities / banquets / brands),
// whether they can add / edit / delete, and until when. The database enforces
// it (RLS); this file reads and writes the rules and describes them in words.
// ============================================================================

import { addDays, addMonths, endOfDay, format, parseISO } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { parseSupabaseError } from './errors';
import { sendPushNotification } from './notifications';
import { supabase } from './supabase';

export type RuleFeature = 'venues' | 'bills' | 'leads';
export type RuleScope = 'own' | 'all' | 'people' | 'cities' | 'banquets' | 'brands';

export interface AccessRule {
  id: string;
  user_id: string;
  feature: RuleFeature;
  scope: RuleScope;
  scope_ids: string[];
  scope_values: string[];
  can_add: boolean;
  /** On rows they added themselves. */
  can_edit: boolean;
  can_delete: boolean;
  /** On rows someone else added, inside what the rule lets them see. */
  others_can_edit: boolean;
  others_can_delete: boolean;
  /** A "hide" rule (066): nothing the people in scope_ids added is shown. Ticks ignored. */
  deny?: boolean;
  /** A 'people' rule only reaches their items inside these cities / banquets… (068). Empty = everywhere. */
  within_ids?: string[];
  /** …or these brands (bills). */
  within_values?: string[];
  starts_at: string;
  expires_at: string | null;
}

/** What the owner edits: a rule before it is saved. */
export type RuleDraft = Pick<
  AccessRule,
  | 'scope'
  | 'scope_ids'
  | 'scope_values'
  | 'can_add'
  | 'can_edit'
  | 'can_delete'
  | 'others_can_edit'
  | 'others_can_delete'
  | 'deny'
  | 'within_ids'
  | 'within_values'
  | 'expires_at'
>;

type Result<T = undefined> = { success: true; data: T } | { success: false; error: string };
const fail = (e: unknown): { success: false; error: string } => ({ success: false, error: parseSupabaseError(e) });

export const RULE_FEATURES: RuleFeature[] = ['venues', 'bills', 'leads'];
export const isRuleFeature = (f: string): f is RuleFeature => (RULE_FEATURES as string[]).includes(f);

/** The list a scope picks from, per feature. */
export const SCOPE_BY_FEATURE: Record<RuleFeature, RuleScope> = {
  venues: 'cities',
  bills: 'brands',
  leads: 'banquets',
};

export const FEATURE_NOUN: Record<RuleFeature, string> = { venues: 'venues', bills: 'bills', leads: 'leads' };

export const isActive = (r: Pick<AccessRule, 'starts_at' | 'expires_at'>, now = Date.now()) =>
  new Date(r.starts_at).getTime() <= now && (!r.expires_at || new Date(r.expires_at).getTime() > now);

/** Presets: one tap sets everything. */
export const PRESETS: { key: string; label: string; hint: string; draft: RuleDraft }[] = [
  {
    key: 'own',
    label: 'Only their own',
    hint: 'Sees, adds, edits and deletes only what they add',
    draft: { scope: 'own', scope_ids: [], scope_values: [], can_add: true, can_edit: true, can_delete: true, others_can_edit: false, others_can_delete: false, expires_at: null },
  },
  {
    key: 'view',
    label: 'See all · view only',
    hint: 'Sees everything, changes nothing',
    draft: { scope: 'all', scope_ids: [], scope_values: [], can_add: false, can_edit: false, can_delete: false, others_can_edit: false, others_can_delete: false, expires_at: null },
  },
  {
    key: 'edit',
    label: 'See all · can edit',
    hint: 'Sees, adds and edits everything; no delete',
    draft: { scope: 'all', scope_ids: [], scope_values: [], can_add: true, can_edit: true, can_delete: false, others_can_edit: true, others_can_delete: false, expires_at: null },
  },
];

// ---------------------------------------------------------------------------
// Owner: read and write a person's rules

/**
 * Who it makes sense to offer in "added by others": people who have this
 * feature, plus anyone who has added something in it. Owner only (RLS).
 */
export async function fetchContributorIds(feature: RuleFeature): Promise<Set<string>> {
  const col = feature === 'venues' ? 'added_by' : 'created_by';
  const [made, given] = await Promise.all([
    supabase.from(feature).select(col),
    supabase.from('feature_access').select('user_id').eq('feature', feature),
  ]);
  const ids = new Set<string>();
  for (const r of (made.data || []) as unknown as Record<string, string | null>[]) if (r[col]) ids.add(r[col] as string);
  for (const r of (given.data || []) as { user_id: string }[]) ids.add(r.user_id);
  return ids;
}

export async function fetchRules(userId: string, feature?: RuleFeature): Promise<Result<AccessRule[]>> {
  let q = supabase.from('access_rules').select('*').eq('user_id', userId).order('created_at', { ascending: true });
  if (feature) q = q.eq('feature', feature);
  const { data, error } = await q;
  if (error) return fail(error);
  return { success: true, data: (data || []) as AccessRule[] };
}

/**
 * Replace a person's rules for one feature. No rules at all takes the feature
 * away. The new rules go in before the old ones come out, so a failure part-way
 * never leaves the person with nothing.
 */
export async function saveRules(
  userId: string,
  feature: RuleFeature,
  drafts: RuleDraft[],
  ownerId: string,
  summary: string,
): Promise<Result> {
  const old = await fetchRules(userId, feature);
  if (!old.success) return old;
  const hadAccess = old.data.length > 0;

  if (drafts.length === 0) {
    const del = await supabase.from('access_rules').delete().eq('user_id', userId).eq('feature', feature);
    if (del.error) return fail(del.error);
    const off = await supabase.from('feature_access').delete().eq('user_id', userId).eq('feature', feature);
    if (off.error) return fail(off.error);
    if (hadAccess) {
      void sendPushNotification(userId, `${labelOf(feature)} access`, `${labelOf(feature)} access was removed.`, {
        type: 'feature_access',
        feature,
      });
    }
    return { success: true, data: undefined };
  }

  const on = await supabase
    .from('feature_access')
    .upsert({ user_id: userId, feature, granted_by: ownerId }, { onConflict: 'user_id,feature', ignoreDuplicates: true });
  if (on.error) return fail(on.error);

  const ins = await supabase
    .from('access_rules')
    // Every row sends every column: a column left out of some rows would go in empty.
    .insert(
      drafts.map((d) => ({
        ...d,
        deny: d.deny ?? false,
        within_ids: d.within_ids ?? [],
        within_values: d.within_values ?? [],
        user_id: userId,
        feature,
        granted_by: ownerId,
      })),
    );
  if (ins.error) return fail(ins.error);

  if (old.data.length) {
    const del = await supabase
      .from('access_rules')
      .delete()
      .in('id', old.data.map((r) => r.id));
    if (del.error) return fail(del.error);
  }

  void sendPushNotification(
    userId,
    `${labelOf(feature)} access ${hadAccess ? 'changed' : 'given'}`,
    summary,
    { type: 'feature_access', feature },
  );
  return { success: true, data: undefined };
}

const labelOf = (f: RuleFeature) => (f === 'leads' ? 'Navgrah Leads' : f === 'bills' ? 'Bills' : 'Venues');

// ---------------------------------------------------------------------------
// Words

/** When a rule ends, as the owner picked it. */
export const expiryFrom = (choice: 'none' | '1d' | '1w' | '1m' | 'date', date: string | null): string | null => {
  const now = new Date();
  if (choice === '1d') return addDays(now, 1).toISOString();
  if (choice === '1w') return addDays(now, 7).toISOString();
  if (choice === '1m') return addMonths(now, 1).toISOString();
  if (choice === 'date' && date) return endOfDay(parseISO(date)).toISOString();
  return null;
};

export type Names = { people: Record<string, string>; places: Record<string, string> };

const join = (xs: string[]) => (xs.length > 3 ? `${xs.slice(0, 3).join(', ')} +${xs.length - 3}` : xs.join(', '));

export function scopeText(r: Pick<AccessRule, 'scope' | 'scope_ids' | 'scope_values'>, names: Names, feature: RuleFeature): string {
  const noun = FEATURE_NOUN[feature];
  switch (r.scope) {
    case 'own':
      return `Only their own ${noun}`;
    case 'all':
      return `Everyone's ${noun}`;
    case 'people':
      return `${join(r.scope_ids.map((id) => names.people[id] ?? 'Someone'))}'s ${noun} + their own`;
    case 'cities':
    case 'banquets':
      return `${join(r.scope_ids.map((id) => names.places[id] ?? 'Removed'))} + their own`;
    case 'brands':
      return `${join(r.scope_values.map((b) => (b === 'navgrah' ? 'Navgrah' : 'VEBOSSO')))} + their own`;
  }
}

/**
 * What a rule lets them do, in words: "view · own: add, edit · others': edit".
 * With "only their own" there are no others' items, so that part is left out.
 */
export function doText(
  r: Pick<AccessRule, 'can_add' | 'can_edit' | 'can_delete' | 'others_can_edit' | 'others_can_delete'> & { scope?: RuleScope },
): string {
  const own = [r.can_add && 'add', r.can_edit && 'edit', r.can_delete && 'delete'].filter(Boolean) as string[];
  const others = r.scope === 'own' ? [] : ([r.others_can_edit && 'edit', r.others_can_delete && 'delete'].filter(Boolean) as string[]);
  if (!own.length && !others.length) return 'view only';
  return ['view', own.length && `own: ${own.join(', ')}`, others.length && `others': ${others.join(', ')}`]
    .filter(Boolean)
    .join(' · ');
}

export function untilText(r: Pick<AccessRule, 'starts_at' | 'expires_at'>): string {
  if (new Date(r.starts_at).getTime() > Date.now()) return `from ${format(new Date(r.starts_at), 'd MMM')}`;
  if (!r.expires_at) return '';
  const end = new Date(r.expires_at);
  return end.getTime() > Date.now() ? `until ${format(end, 'd MMM')}` : 'ended';
}

/** One line for the member sheet: "Mumbai, Pune · view, add · until 30 Nov". */
export function ruleLine(r: AccessRule, names: Names, feature: RuleFeature): string {
  return [scopeText(r, names, feature), doText(r), untilText(r)].filter(Boolean).join(' · ');
}

/** A rule that is on right now and gives access (not a "hide" rule). */
export const isLiveAllow = (r: AccessRule) => isActive(r) && !r.deny;

/** People whose items a live "hide" rule takes away. */
const hiddenOwners = (rules: AccessRule[]) => new Set(rules.filter((r) => r.deny && isActive(r)).flatMap((r) => r.scope_ids));

/** The summary of all of a person's rules for one feature (several shown as a count). */
export function rulesSummary(rules: AccessRule[], names: Names, feature: RuleFeature): string {
  const live = rules.filter(isLiveAllow);
  if (!rules.some((r) => !r.deny)) return 'Off';
  if (live.length === 0) return 'Ended';
  const hidden = [...hiddenOwners(rules)].map((id) => names.people[id] ?? 'someone');
  const main = live.length === 1 ? ruleLine(live[0], names, feature) : `${live.length} rules · ${ruleLine(live[0], names, feature)} …`;
  return hidden.length ? `${main} · hides ${join(hidden)}` : main;
}

// ---------------------------------------------------------------------------
// The signed-in person's own access

export type RuleAction = 'view' | 'add' | 'edit' | 'delete';
/** The facts about one row that rules look at (same as access_ok in 062). */
export type RuleRow = { owner?: string | null; target?: string | null; value?: string | null };

/** Is this action ticked? Edit / delete depend on whether the row is theirs. */
const tick = (r: AccessRule, a: RuleAction, mine: boolean) =>
  a === 'view' ||
  (a === 'add' && r.can_add) ||
  (a === 'edit' && (mine ? r.can_edit : r.others_can_edit)) ||
  (a === 'delete' && (mine ? r.can_delete : r.others_can_delete));

/** Mirror of the database check, so buttons can be hidden per row. */
export function allows(rules: AccessRule[], action: RuleAction, me: string, row: RuleRow = {}): boolean {
  // Hidden people's items are off whatever else allows them (066).
  if (row.owner && row.owner !== me && hiddenOwners(rules).has(row.owner)) return false;
  return rules.some((r) => {
    const own = !!row.owner && row.owner === me;
    if (!isLiveAllow(r) || !tick(r, action, own)) return false;
    const mine = action !== 'add' && own;
    switch (r.scope) {
      case 'all':
        return true;
      case 'own':
        return action === 'add' || (!!row.owner && row.owner === me);
      case 'people': {
        if (action === 'add' || (!!row.owner && row.owner === me)) return true;
        if (!row.owner || !r.scope_ids.includes(row.owner)) return false;
        // Kept inside some cities / banquets / brands (068)?
        const ids = r.within_ids ?? [];
        const values = r.within_values ?? [];
        if (!ids.length && !values.length) return true;
        return (!!row.target && ids.includes(row.target)) || (!!row.value && values.includes(row.value));
      }
      case 'cities':
      case 'banquets':
        return (!!row.target && r.scope_ids.includes(row.target)) || mine;
      case 'brands':
        return (!!row.value && r.scope_values.includes(row.value)) || mine;
    }
  });
}

/** Can they see bills of this brand at all? (Mirror of access_brand_visible in 064.) */
export function seesBrand(rules: AccessRule[], brand: string): boolean {
  return rules.some(
    (r) =>
      isLiveAllow(r) &&
      (r.scope === 'all' ||
        r.scope === 'own' ||
        (r.scope === 'people' && (!(r.within_values ?? []).length || (r.within_values ?? []).includes(brand))) ||
        (r.scope === 'brands' && r.scope_values.includes(brand))),
  );
}

/** May they add / change / remove a city or banquet itself (not just rows in one)? */
export function allowsList(rules: AccessRule[], action: Exclude<RuleAction, 'view'>): boolean {
  return rules.some(
    (r) =>
      isLiveAllow(r) &&
      r.scope !== 'cities' &&
      r.scope !== 'banquets' &&
      (action === 'add' ? r.can_add : action === 'edit' ? r.can_edit || r.others_can_edit : r.can_delete || r.others_can_delete),
  );
}

export interface MyAccess {
  loading: boolean;
  /** At least one rule is on right now. */
  has: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** May they do this to this particular row? */
  can: (action: RuleAction, row?: RuleRow) => boolean;
  /** May they add / edit / remove a city or banquet itself? */
  canList: (action: Exclude<RuleAction, 'view'>) => boolean;
  /** Bills: can they see this brand at all? */
  canSeeBrand: (brand: string) => boolean;
}

const OWNER_ACCESS: MyAccess = {
  loading: false,
  has: true,
  canAdd: true,
  canEdit: true,
  canDelete: true,
  can: () => true,
  canList: () => true,
  canSeeBrand: () => true,
};
const NO_ACCESS: MyAccess = { ...OWNER_ACCESS, loading: true, has: false, canAdd: false, canEdit: false, canDelete: false, can: () => false, canList: () => false, canSeeBrand: () => false };

/**
 * What the signed-in person may do with a feature, from their active rules —
 * for hiding buttons they can't use. The database is what actually stops them.
 * The owner can do everything. Re-read whenever the screen is focused.
 */
export function useMyAccess(feature: RuleFeature): MyAccess {
  const profile = useAuthStore((s) => s.profile);
  const isOwner = profile?.role === 'owner';
  const userId = profile?.id;
  const [state, setState] = useState<MyAccess>(NO_ACCESS);

  useFocusEffect(
    useCallback(() => {
      if (isOwner || !userId) return;
      let active = true;
      supabase
        .from('access_rules')
        .select('*')
        .eq('user_id', userId)
        .eq('feature', feature)
        .then(({ data }) => {
          if (!active) return;
          const rules = (data || []) as AccessRule[];
          const live = rules.filter(isLiveAllow);
          setState({
            loading: false,
            has: live.length > 0,
            canAdd: live.some((r) => r.can_add),
            canEdit: live.some((r) => r.can_edit || r.others_can_edit),
            canDelete: live.some((r) => r.can_delete || r.others_can_delete),
            can: (action, row) => allows(rules, action, userId, row),
            canList: (action) => allowsList(rules, action),
            canSeeBrand: (brand) => seesBrand(rules, brand),
          });
        });
      return () => {
        active = false;
      };
    }, [isOwner, userId, feature]),
  );

  return isOwner ? OWNER_ACCESS : state;
}
