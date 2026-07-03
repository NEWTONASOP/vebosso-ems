// ============================================================================
// VEBOSSO EMS — Auth Store (Zustand)
// ============================================================================
 

import { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
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
  updateProfile: (updates: Partial<Profile>) => Promise<{ success: boolean; error?: string }>;
  changePassword: (newPassword: string) => Promise<{ success: boolean; error?: string }>;
  setError: (error: string | null) => void;
  clearError: () => void;
  cleanup: () => void;
}

// Store auth subscription outside the store to prevent memory leaks
let authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

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

      // Clean up any existing subscription
      if (authSubscription) {
        authSubscription.data.subscription.unsubscribe();
        authSubscription = null;
      }

      // Get existing session with timeout
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Session timeout')), 10000)
      );

      const { data: { session }, error: sessionError } = await Promise.race([
        sessionPromise, 
        timeoutPromise
      ]);

      if (sessionError) {
        console.error('Session error:', sessionError);
        set({ isLoading: false, isInitialized: true, error: sessionError.message });
        return;
      }

      if (session?.user) {
        const profile = await get().fetchProfile(session.user.id);
        
        // If profile doesn't exist (user deleted from database), sign out
        if (!profile) {
          console.warn('Profile not found for authenticated user. Signing out...');
          await supabase.auth.signOut();
          set({ 
            session: null,
            profile: null,
            isAuthenticated: false,
            userRole: null,
            userId: null,
            isLoading: false,
            isInitialized: true,
            error: 'Your account was not found. Please contact your administrator.'
          });
          return;
        }
        
        // If profile is inactive, sign out
        if (!profile.is_active) {
          console.warn('User account is inactive. Signing out...');
          await supabase.auth.signOut();
          set({
            session: null,
            profile: null,
            isAuthenticated: false,
            userRole: null,
            userId: null,
            isLoading: false,
            isInitialized: true,
            error: 'Your account has been deactivated. Please contact your administrator.'
          });
          return;
        }
        
        set({
          session,
          profile,
          isAuthenticated: true,
          userRole: profile.role,
          userId: session.user.id,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        set({ isLoading: false, isInitialized: true });
      }

      // Listen for auth state changes
      authSubscription = supabase.auth.onAuthStateChange(async (event, newSession) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_IN' && newSession?.user) {
          const profile = await get().fetchProfile(newSession.user.id);
          
          // Handle deleted or inactive users
          if (!profile) {
            console.warn('Profile not found during sign in. Signing out...');
            await supabase.auth.signOut();
            set({
              session: null,
              profile: null,
              isAuthenticated: false,
              userRole: null,
              userId: null,
              isLoading: false,
              error: 'Your account was not found. Please contact your administrator.'
            });
            return;
          }
          
          if (!profile.is_active) {
            console.warn('User account is inactive during sign in. Signing out...');
            await supabase.auth.signOut();
            set({
              session: null,
              profile: null,
              isAuthenticated: false,
              userRole: null,
              userId: null,
              isLoading: false,
              error: 'Your account has been deactivated. Please contact your administrator.'
            });
            return;
          }
          
          set({
            session: newSession,
            profile,
            isAuthenticated: true,
            userRole: profile.role,
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

      // Normalize employee ID (e.g. "2" -> "VB-0002", "VB-2" -> "VB-0002")
      let normalizedId = employeeId.trim().toUpperCase();
      if (/^\d+$/.test(normalizedId)) {
        normalizedId = `VB-${normalizedId.padStart(4, '0')}`;
      } else if (/^VB-?\d+$/i.test(normalizedId)) {
        const numPart = normalizedId.replace(/[^0-9]/g, '');
        normalizedId = `VB-${numPart.padStart(4, '0')}`;
      }

      // First, look up the employee's email by their employee_id
      // We need to construct the internal email format used by create-member
      let internalEmail = `${normalizedId.toLowerCase().replace(/[^a-z0-9]/g, '')}@vebosso.local`;

      // Special mapping for the seeded owner account
      if (normalizedId === 'VB-0001' || normalizedId === 'OWNER') {
        internalEmail = 'owner@vebosso.com';
      }

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
    } catch {
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
        console.error('Update profile error:', error);
        return { success: false, error: error.message || 'Failed to update profile' };
      }

      set({ profile: data as Profile });
      return { success: true };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to update profile';
      console.error('Update profile error:', error);
      return { success: false, error: errorMsg };
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
    } catch {
      const msg = 'Failed to change password. Please try again.';
      set({ isLoading: false, error: msg });
      return { success: false, error: msg };
    }
  },

  setError: (error: string | null) => set({ error }),
  clearError: () => set({ error: null }),

  // Cleanup auth subscription to prevent memory leaks
  cleanup: () => {
    if (authSubscription) {
      authSubscription.data.subscription.unsubscribe();
      authSubscription = null;
    }
  },
}));
