// ============================================================================
// VEBOSSO EMS — Profile fetch helpers (retry + distinguish network vs missing)
// ============================================================================

import { PostgrestError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { Profile } from '../types/database';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type ProfileFetchResult =
  | { status: 'ok'; profile: Profile }
  | { status: 'not_found' }
  | { status: 'inactive'; profile: Profile }
  | { status: 'transient_error'; lastError?: string };

export async function fetchProfileReliable(
  userId: string,
  maxAttempts = 3,
): Promise<ProfileFetchResult> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data) {
      const profile = data as Profile;
      if (!profile.is_active) {
        return { status: 'inactive', profile };
      }
      return { status: 'ok', profile };
    }

    if (error) {
      lastError = error.message;
      if ((error as PostgrestError).code === 'PGRST116') {
        return { status: 'not_found' };
      }
    }

    if (attempt < maxAttempts - 1) {
      await sleep(800 * (attempt + 1));
    }
  }

  return { status: 'transient_error', lastError };
}

export function isRefreshTokenFatal(error: { message?: string } | null): boolean {
  if (!error?.message) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('refresh token') ||
    msg.includes('invalid refresh') ||
    msg.includes('session not found')
  );
}
