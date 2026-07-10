// ============================================================================
// VEBOSSO EMS — Auth session lifecycle (foreground refresh, AppState)
// ============================================================================

import { AppState, AppStateStatus, Platform } from 'react-native';
import { supabase } from './supabase';

type ResumeHandler = () => Promise<void>;

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;
let visibilityHandler: (() => void) | null = null;
let resumeHandler: ResumeHandler | null = null;

function onAppActive() {
  supabase.auth.startAutoRefresh();
  resumeHandler?.().catch((error) => {
    if (__DEV__) console.warn('Session resume failed:', error);
  });
}

function onAppInactive() {
  supabase.auth.stopAutoRefresh();
}

export function registerAuthResumeHandler(handler: ResumeHandler) {
  resumeHandler = handler;
}

export function setupAuthSessionLifecycle() {
  teardownAuthSessionLifecycle();

  supabase.auth.startAutoRefresh();

  appStateSubscription = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') {
      onAppActive();
    } else {
      onAppInactive();
    }
  });

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        onAppActive();
      } else {
        onAppInactive();
      }
    };
    document.addEventListener('visibilitychange', visibilityHandler);
  }
}

export function teardownAuthSessionLifecycle() {
  appStateSubscription?.remove();
  appStateSubscription = null;

  if (visibilityHandler && typeof document !== 'undefined') {
    document.removeEventListener('visibilitychange', visibilityHandler);
    visibilityHandler = null;
  }

  supabase.auth.stopAutoRefresh();
}
