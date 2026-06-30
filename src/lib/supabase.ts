// ============================================================================
// VEBOSSO EMS — Supabase Client
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SQLite from 'expo-sqlite';
import 'react-native-url-polyfill/auto';

// SQLite-based storage adapter for persistent auth sessions
class SupabaseStorage {
  private db: SQLite.SQLiteDatabase | null = null;
  private initPromise: Promise<SQLite.SQLiteDatabase> | null = null;
  private isInitializing: boolean = false;

  private async getDb() {
    // Return existing database if already initialized
    if (this.db && !this.isInitializing) {
      return this.db;
    }
    
    // Wait for ongoing initialization
    if (this.initPromise) {
      return this.initPromise;
    }
    
    // Start new initialization
    if (!this.db && !this.isInitializing) {
      this.isInitializing = true;
      this.initPromise = (async () => {
        try {
          this.db = await SQLite.openDatabaseAsync('supabase-auth.db');
          await this.db.execAsync(
            'CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT);'
          );
          return this.db;
        } catch (error) {
          console.error('SQLite initialization error:', error);
          throw error;
        } finally {
          this.isInitializing = false;
          this.initPromise = null;
        }
      })();
      return this.initPromise;
    }
    return this.db;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const db = await this.getDb();
      const result = await db.getFirstAsync<{ value: string }>(
        'SELECT value FROM kv_store WHERE key = ?;',
        [key]
      );
      return result?.value ?? null;
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync(
        'INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?);',
        [key, value]
      );
    } catch (error) {
      console.error('SupabaseStorage setItem error:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      const db = await this.getDb();
      await db.runAsync('DELETE FROM kv_store WHERE key = ?;', [key]);
    } catch (error) {
      console.error('SupabaseStorage removeItem error:', error);
    }
  }
}

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  const errorMessage = '⚠️ Supabase URL or Anon Key is missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file.';
  console.error(errorMessage);
  
  // In production, log error but don't throw to prevent crash on startup
  // The app will handle auth failures gracefully
  if (process.env.NODE_ENV === 'production') {
    console.error('Missing Supabase configuration. App may not function correctly.');
  }
  
  // In development, show clear warning but allow continuation for setup
  console.warn('⚠️ Development mode: App will fail without proper Supabase configuration.');
}

const storage = new SupabaseStorage();

// Use 'any' generic to prevent 'never' errors from manual schema types.
// Our Database interface still provides IDE intellisense via explicit casts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
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
