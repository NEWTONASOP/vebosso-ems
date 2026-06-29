// ============================================================================
// VEBOSSO EMS — Auth Store (Zustand)
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { create } from 'zustand';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile, UserRole } from '../types/database';

interface AuthState {
  // State
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Computed
  isAuthenticated: boolean;
  userRole: UserRole | null;
  userId: string | null;

  // Actions
  initialize: () => Promise<void>;
  signIn: (employeeId: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  session: null,
  profile: null,
  isLoading: true,
  isInitialized: false,
  error: null,
  isAuthenticated: false,
  userRole: null,
  userId: null,

  // Initialize auth state - called once on app start
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // Get existing session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('Session error:', sessionError);
        set({ isLoading: false, isInitialized: true });
        return;
      }

      if (session?.user) {
        const profile = await get().fetchProfile(session.user.id);
        set({
          session,
          profile,
          isAuthenticated: true,
          userRole: profile?.role || null,
          userId: session.user.id,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        set({ isLoading: false, isInitialized: true });
      }

      // Listen for auth state changes
      supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const profile = await get().fetchProfile(newSession.user.id);
          set({
            session: newSession,
            profile,
            isAuthenticated: true,
            userRole: profile?.role || null,
            userId: newSession.user.id,
            isLoading: false,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            session: null,
            profile: null,
            isAuthenticated: false,
            userRole: null,
            userId: null,
            isLoading: false,
          });
        } else if (event === 'TOKEN_REFRESHED' && newSession) {
          set({ session: newSession });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({ isLoading: false, isInitialized: true, error: 'Failed to initialize authentication' });
    }
  },

  // Sign in with employee ID and password
  signIn: async (employeeId: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      // First, look up the employee's email by their employee_id
      // We need to construct the internal email format used by create-member
      const internalEmail = `${employeeId.toLowerCase().replace(/[^a-z0-9]/g, '')}@vebosso.local`;

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

      if (data.user) {
        const profile = await get().fetchProfile(data.user.id);

        if (!profile) {
          await supabase.auth.signOut();
          const msg =
            'Account setup incomplete. Your profile was not found — ask your admin to run the database seed.';
          set({ isLoading: false, error: msg });
          return { success: false, error: msg };
        }

        if (!profile.is_active) {
          await supabase.auth.signOut();
          const msg = 'Your account has been deactivated. Contact your admin.';
          set({ isLoading: false, error: msg });
          return { success: false, error: msg };
        }

        set({
          session: data.session,
          profile,
          isAuthenticated: true,
          userRole: profile?.role || null,
          userId: data.user.id,
          isLoading: false,
        });

        // Track session
        try {
          await supabase.from('sessions').insert({
            user_id: data.user.id,
            supabase_session_token: data.session?.access_token || null,
            device_info: `Mobile App`,
            last_active: new Date().toISOString(),
            is_active: true,
          });
        } catch (e) {
          console.warn('Could not track session:', e);
        }

        return { success: true };
      }

      set({ isLoading: false });
      return { success: false, error: 'An unexpected error occurred' };
    } catch (error) {
      const msg = 'Network error. Please check your connection and try again.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      set({ isLoading: true });

      // Deactivate current session
      const userId = get().userId;
      if (userId) {
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
      console.error('Sign out error:', error);
      set({ isLoading: false });
    }
  },

  // Fetch user profile from profiles table
  fetchProfile: async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Fetch profile error:', error);
        return null;
      }

      return data as Profile;
    } catch (error) {
      console.error('Fetch profile error:', error);
      return null;
    }
  },

  // Update profile
  updateProfile: async (updates: Partial<Profile>) => {
    const userId = get().userId;
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) {
        console.error('Update profile error:', error);
        throw error;
      }

      set({ profile: data as Profile });
    } catch (error) {
      throw error;
    }
  },

  // Change password
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

      // Update must_change_password flag
      const userId = get().userId;
      if (userId) {
        await supabase
          .from('profiles')
          .update({ must_change_password: false })
          .eq('id', userId);

        // Update local profile
        const profile = get().profile;
        if (profile) {
          set({ profile: { ...profile, must_change_password: false } });
        }
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const msg = 'Failed to change password. Please try again.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),
}));
