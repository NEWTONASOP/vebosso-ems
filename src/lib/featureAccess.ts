// ============================================================================
// VEBOSSO EMS — Who can use Bills, Venues and Accounts
// The owner always can; anyone else only if the owner gave them that feature
// (feature_access, migration 033). Off for everyone by default. The same
// screens serve every role, so links inside them are built from the role
// group the screen is running in.
// ============================================================================

import { useFocusEffect, useSegments } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { parseSupabaseError } from './errors';
import { sendPushNotification } from './notifications';
import { supabase } from './supabase';

export type Feature = 'bills' | 'venues' | 'accounts';

export const FEATURES: { key: Feature; label: string; hint: string; icon: 'file-text' | 'map-pin' | 'book' }[] = [
  { key: 'bills', label: 'Bills', hint: 'Create and manage bills', icon: 'file-text' },
  { key: 'venues', label: 'Venues', hint: 'See and add venues', icon: 'map-pin' },
  { key: 'accounts', label: 'Accounts', hint: 'Manage the account books', icon: 'book' },
];

type Result = { success: true } | { success: false; error: string };

/** Owner only (RLS). Which features this person has been given. */
export async function fetchFeatureAccess(userId: string): Promise<Record<Feature, boolean>> {
  const { data } = await supabase.from('feature_access').select('feature').eq('user_id', userId);
  const has = new Set(((data || []) as { feature: Feature }[]).map((r) => r.feature));
  return { bills: has.has('bills'), venues: has.has('venues'), accounts: has.has('accounts') };
}

/** Owner only (RLS). Tells the person when a feature is given to them. */
export async function setFeatureAccess(
  userId: string,
  feature: Feature,
  grant: boolean,
  ownerId: string,
): Promise<Result> {
  const { error } = grant
    ? await supabase
        .from('feature_access')
        .upsert({ user_id: userId, feature, granted_by: ownerId }, { onConflict: 'user_id,feature' })
    : await supabase.from('feature_access').delete().eq('user_id', userId).eq('feature', feature);
  if (error) return { success: false, error: parseSupabaseError(error) };

  if (grant) {
    const label = FEATURES.find((f) => f.key === feature)?.label ?? feature;
    sendPushNotification(userId, `${label} access`, `You can now use ${label}. Find it on your home screen.`, {
      type: 'feature_access',
      feature,
    });
  }
  return { success: true };
}

/** Can the signed-in person use this feature? Re-checked whenever the screen is focused. */
export function useHasFeature(feature: Feature): boolean {
  const profile = useAuthStore((s) => s.profile);
  const [granted, setGranted] = useState(false);
  const isOwner = profile?.role === 'owner';
  const userId = profile?.id;

  useFocusEffect(
    useCallback(() => {
      if (isOwner || !userId) return;
      let active = true;
      // Readable by the person themselves (read_own_feature_access).
      supabase
        .from('feature_access')
        .select('feature')
        .eq('user_id', userId)
        .eq('feature', feature)
        .maybeSingle()
        .then(({ data }) => active && setGranted(!!data));
      return () => {
        active = false;
      };
    }, [isOwner, userId, feature])
  );

  return isOwner || granted;
}

/** e.g. "/(manager)/bills" — the feature's route in whichever role group is open. */
export function useFeatureBase(feature: Feature): string {
  const segments = useSegments();
  const group = segments.find((s) => s === '(owner)' || s === '(manager)' || s === '(member)') ?? '(owner)';
  return `/${group}/${feature}`;
}
