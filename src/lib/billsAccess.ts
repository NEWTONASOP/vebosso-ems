// ============================================================================
// VEBOSSO EMS — Who can use Bills
// The owner always can; anyone else only if the owner gave them Bills
// (bill_access, migration 030). The same screens serve every role, so links
// inside Bills are built from the role group the screen is running in.
// ============================================================================

import { useFocusEffect, useSegments } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { parseSupabaseError } from './errors';
import { sendPushNotification } from './notifications';
import { supabase } from './supabase';

type Result = { success: true } | { success: false; error: string };

/** Owner only (RLS). */
export async function fetchHasBillsAccess(userId: string): Promise<boolean> {
  const { data } = await supabase.from('bill_access').select('user_id').eq('user_id', userId).maybeSingle();
  return !!data;
}

/** Owner only (RLS). Tells the person when Bills is given to them. */
export async function setBillsAccess(userId: string, grant: boolean, ownerId: string): Promise<Result> {
  const { error } = grant
    ? await supabase.from('bill_access').upsert({ user_id: userId, granted_by: ownerId }, { onConflict: 'user_id' })
    : await supabase.from('bill_access').delete().eq('user_id', userId);
  if (error) return { success: false, error: parseSupabaseError(error) };

  if (grant) {
    sendPushNotification(userId, 'Bills access 🧾', 'You can now create and manage bills — find Bills on your home screen.', {
      type: 'bills_access',
    });
  }
  return { success: true };
}

/** Can the signed-in person use Bills? Re-checked whenever the screen is focused. */
export function useCanManageBills(): boolean {
  const profile = useAuthStore((s) => s.profile);
  const [granted, setGranted] = useState(false);
  const isOwner = profile?.role === 'owner';
  const userId = profile?.id;

  useFocusEffect(
    useCallback(() => {
      if (isOwner || !userId) return;
      let active = true;
      // Readable by the person themselves (read_own_bill_access).
      supabase
        .from('bill_access')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle()
        .then(({ data }) => active && setGranted(!!data));
      return () => {
        active = false;
      };
    }, [isOwner, userId])
  );

  return isOwner || granted;
}

/** "/(owner)/bills", "/(manager)/bills" or "/(member)/bills" — wherever Bills is open. */
export function useBillsBase(): string {
  const segments = useSegments();
  const group = segments.find((s) => s === '(owner)' || s === '(manager)' || s === '(member)') ?? '(owner)';
  return `/${group}/bills`;
}
