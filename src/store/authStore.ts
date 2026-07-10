// ============================================================================
// VEBOSSO EMS — Auth Store (Zustand)
// ============================================================================

import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { fetchProfileReliable, isRefreshTokenFatal } from '../lib/authProfile';
import { registerAuthResumeHandler } from '../lib/authSessionLifecycle';
import { supabase } from '../lib/supabase';
import { Profile, UserRole } from '../types/database';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
  isAuthenticated: boolean;
  userRole: UserRole | null;
  userId: string | null;

  initialize: () => Promise<void>;
  resumeSession: () => Promise<void>;
  signIn: (employeeId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setError: (error: string | null) => void;
  clearError: () => void;
  cleanup: () => void;
}

let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

function applyAuthenticatedState(
  set: (partial: Partial<AuthState>) => void,
  session: Session,
  profile: Profile,
) {
  set({
    session,
    profile,
    isAuthenticated: true,
    userRole: profile.role,
    userId: session.user.id,
    isLoading: false,
    error: null,
  });
}

async function resolveSessionFromStorage(): Promise<Session | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: refreshed, error } = await supabase.auth.refreshSession();
  if (error) {
    if (isRefreshTokenFatal(error)) {
      await supabase.auth.signOut();
      return null;
    }
    return session;
  }

  return refreshed.session ?? session;
}

async function loadProfileForSession(
  userId: string,
  signOutOnFailure: boolean,
): Promise<
  | { ok: true; profile: Profile }
  | { ok: false; error: string; shouldSignOut: boolean }
> {
  const result = await fetchProfileReliable(userId);

  if (result.status === 'ok') {
    return { ok: true, profile: result.profile };
  }

  if (result.status === 'not_found') {
    return {
      ok: false,
      error: 'Your account was not found. Please contact your administrator.',
      shouldSignOut: signOutOnFailure,
    };
  }

  if (result.status === 'inactive') {
    return {
      ok: false,
      error: 'Your account has been deactivated. Please contact your administrator.',
      shouldSignOut: signOutOnFailure,
    };
  }

  return {
    ok: false,
    error: 'Could not load your profile. Check your connection and try again.',
    shouldSignOut: false,
  };
}

export const useAuthStore = create<AuthState>((set, get) => {
  const hydrateFromSession = async (session: Session, signOutOnHardFailure: boolean) => {
    const profileResult = await loadProfileForSession(session.user.id, signOutOnHardFailure);

    if (profileResult.ok) {
      applyAuthenticatedState(set, session, profileResult.profile);
      return true;
    }

    if (profileResult.shouldSignOut) {
      await supabase.auth.signOut();
      set({
        session: null,
        profile: null,
        isAuthenticated: false,
        userRole: null,
        userId: null,
        isLoading: false,
        error: profileResult.error,
      });
      return false;
    }

    set({
      session,
      profile: get().profile,
      isAuthenticated: true,
      userRole: get().userRole,
      userId: session.user.id,
      isLoading: !get().profile,
      error: profileResult.error,
    });
    return true;
  };

  registerAuthResumeHandler(async () => {
    await get().resumeSession();
  });

  return {
    session: null,
    profile: null,
    isLoading: true,
    isInitialized: false,
    error: null,
    isAuthenticated: false,
    userRole: null,
    userId: null,

    initialize: async () => {
      try {
        set({ isLoading: true, error: null });

        if (authSubscription) {
          authSubscription.data.subscription.unsubscribe();
          authSubscription = null;
        }

        const session = await resolveSessionFromStorage();

        if (session?.user) {
          await hydrateFromSession(session, true);
        } else {
          set({ isLoading: false });
        }

        set({ isInitialized: true });

        authSubscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
          if (__DEV__) console.log('Auth state changed:', event);

          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession?.user) {
            await hydrateFromSession(newSession, true);
            return;
          }

          if (event === 'SIGNED_OUT') {
            set({
              session: null,
              profile: null,
              isAuthenticated: false,
              userRole: null,
              userId: null,
              isLoading: false,
              error: null,
            });
            return;
          }

          if (event === 'TOKEN_REFRESHED' && newSession) {
            set({ session: newSession });
            const { profile, userId } = get();
            if (!profile && userId === newSession.user.id) {
              const profileResult = await loadProfileForSession(newSession.user.id, false);
              if (profileResult.ok) {
                set({ profile: profileResult.profile, userRole: profileResult.profile.role, error: null });
              }
            }
          }
        });
      } catch (error) {
        if (__DEV__) console.error('Auth initialization error:', error);
        set({
          isLoading: false,
          isInitialized: true,
          error: 'Failed to initialize authentication',
        });
      }
    },

    resumeSession: async () => {
      const { isAuthenticated, userId } = get();
      if (!isAuthenticated && !userId) {
        const session = await resolveSessionFromStorage();
        if (!session?.user) return;
        await hydrateFromSession(session, false);
        return;
      }

      const { data: refreshed, error } = await supabase.auth.refreshSession();
      if (error) {
        if (isRefreshTokenFatal(error)) {
          await supabase.auth.signOut();
        }
        return;
      }

      const session = refreshed.session ?? get().session;
      if (!session?.user) return;

      set({ session });

      const profileResult = await loadProfileForSession(session.user.id, false);
      if (profileResult.ok) {
        applyAuthenticatedState(set, session, profileResult.profile);
      } else if (!profileResult.shouldSignOut) {
        set({ error: profileResult.error });
      } else {
        await supabase.auth.signOut();
        set({
          session: null,
          profile: null,
          isAuthenticated: false,
          userRole: null,
          userId: null,
          error: profileResult.error,
        });
      }
    },

    signIn: async (employeeId: string, password: string) => {
      try {
        set({ isLoading: true, error: null });

        let normalizedId = employeeId.trim().toUpperCase();
        if (/^\d+$/.test(normalizedId)) {
          normalizedId = `VB-${normalizedId.padStart(4, '0')}`;
        } else if (/^VB-?\d+$/i.test(normalizedId)) {
          const numPart = normalizedId.replace(/[^0-9]/g, '');
          normalizedId = `VB-${numPart.padStart(4, '0')}`;
        }

        const internalEmail = `${normalizedId.toLowerCase().replace(/[^a-z0-9]/g, '')}@vebosso.com`;

        const { data, error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password,
        });

        if (error) {
          let friendlyError = 'Invalid credentials. Please check your Employee ID and password.';
          if (error.message.includes('Invalid login credentials')) {
            friendlyError = 'Invalid Employee ID or password. Please try again.';
          } else if (error.message.includes('Email not confirmed')) {
            friendlyError = 'Your account is not yet activated. Contact your admin.';
          }
          set({ isLoading: false, error: friendlyError });
          return { success: false, error: friendlyError };
        }

        if (data.user && data.session) {
          const profileResult = await loadProfileForSession(data.user.id, true);

          if (!profileResult.ok) {
            if (profileResult.shouldSignOut) {
              await supabase.auth.signOut();
            }
            set({ isLoading: false, error: profileResult.error });
            return { success: false, error: profileResult.error };
          }

          applyAuthenticatedState(set, data.session, profileResult.profile);

          try {
            await supabase.from('sessions').insert({
              user_id: data.user.id,
              supabase_session_token: null,
              device_info: `Mobile App`,
              last_active: new Date().toISOString(),
              is_active: true,
            });
          } catch (e) {
            if (__DEV__) console.warn('Could not track session:', e);
          }

          return { success: true };
        }

        set({ isLoading: false });
        return { success: false, error: 'An unexpected error occurred' };
      } catch {
        const msg = 'Network error. Please check your connection and try again.';
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }
    },

    signOut: async () => {
      try {
        set({ isLoading: true });

        const userId = get().userId;
        if (userId) {
          await supabase
            .from('profiles')
            .update({ expo_push_token: null } as any)
            .eq('id', userId);

          await supabase
            .from('sessions')
            .update({ is_active: false })
            .eq('user_id', userId)
            .eq('is_active', true);
        }

        await supabase.auth.signOut();

        set({
          session: null,
          profile: null,
          isAuthenticated: false,
          userRole: null,
          userId: null,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        if (__DEV__) console.error('Sign out error:', error);
        set({ isLoading: false });
      }
    },

    fetchProfile: async (userId: string): Promise<Profile | null> => {
      const result = await fetchProfileReliable(userId, 1);
      if (result.status === 'ok') return result.profile;
      return null;
    },

    updateProfile: async (updates: Partial<Profile>) => {
      const userId = get().userId;
      if (!userId) {
        return { success: false, error: 'Not authenticated' };
      }

      try {
        const { data, error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', userId)
          .select()
          .single();

        if (error) {
          if (__DEV__) console.error('Update profile error:', error);
          return { success: false, error: error.message || 'Failed to update profile' };
        }

        set({ profile: data as Profile });
        return { success: true };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Failed to update profile';
        if (__DEV__) console.error('Update profile error:', error);
        return { success: false, error: errorMsg };
      }
    },

    changePassword: async (newPassword: string) => {
      try {
        set({ isLoading: true, error: null });

        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) {
          set({ isLoading: false, error: error.message });
          return { success: false, error: error.message };
        }

        const userId = get().userId;
        if (userId) {
          await supabase
            .from('profiles')
            .update({ must_change_password: false })
            .eq('id', userId);

          const profile = get().profile;
          if (profile) {
            set({ profile: { ...profile, must_change_password: false } });
          }
        }

        set({ isLoading: false });
        return { success: true };
      } catch {
        const msg = 'Failed to change password. Please try again.';
        set({ isLoading: false, error: msg });
        return { success: false, error: msg };
      }
    },

    setError: (error: string | null) => set({ error }),
    clearError: () => set({ error: null }),

    cleanup: () => {
      if (authSubscription) {
        authSubscription.data.subscription.unsubscribe();
        authSubscription = null;
      }
    },
  };
});
