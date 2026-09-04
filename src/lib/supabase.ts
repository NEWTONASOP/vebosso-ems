// ============================================================================
// VEBOSSO EMS — Supabase Client
// ============================================================================
 

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

// SecureStore-based storage adapter for persistent auth sessions (Mobile)
class ExpoSecureStoreAdapter {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      if (__DEV__) console.error('SecureStore setItem error:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      if (__DEV__) console.error('SecureStore removeItem error:', error);
    }
  }
}

// Browser-friendly storage adapter for web
class WebStorage {
  async getItem(key: string): Promise<string | null> {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  }

  async removeItem(key: string): Promise<void> {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(key);
    }
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = '⚠️ Supabase URL or Anon Key is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.';
  if (__DEV__) console.error(errorMessage);
  
  // In production, log error but don't throw to prevent crash on startup
  // The app will handle auth failures gracefully
  if (process.env.NODE_ENV === 'production') {
    if (__DEV__) console.error('Missing Supabase configuration. App may not function correctly.');
  }
  
  // In development, show clear warning but allow continuation for setup
  if (__DEV__) console.warn('⚠️ Development mode: App will fail without proper Supabase configuration.');
}

const storage = Platform.OS === 'web' ? new WebStorage() : new ExpoSecureStoreAdapter();

// createClient() throws synchronously on an empty URL ("supabaseUrl is
// required"). This module is imported eagerly from the root layout, so that
// throw happens before React ever renders — on web that's a blank white page
// with no visible error, not the graceful degradation the comment above
// promises. A syntactically valid placeholder keeps the client constructible;
// every real request against it still fails (network error), which existing
// try/catch + snackbar error handling throughout the app already surfaces.
const safeSupabaseUrl = supabaseUrl || 'https://missing-config.invalid';
const safeSupabaseAnonKey = supabaseAnonKey || 'missing-anon-key';

// Use 'any' generic to prevent 'never' errors from manual schema types.
// Our Database interface still provides IDE intellisense via explicit casts.
export const supabase = createClient(safeSupabaseUrl, safeSupabaseAnonKey, {
  auth: {
    storage: {
      getItem: (key: string) => storage.getItem(key),
      setItem: (key: string, value: string) => storage.setItem(key, value),
      removeItem: (key: string) => storage.removeItem(key),
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
}) as SupabaseClient<any>;

export default supabase;
