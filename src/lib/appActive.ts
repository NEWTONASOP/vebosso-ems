// ============================================================================
// VEBOSSO EMS — Is anyone looking?
// Screens that refresh on a timer skip a round while the app is in the
// background (phone) or its tab is hidden (web): every refresh is a download
// from the database, and a tab left open all day used to keep pulling data
// nobody saw.
// ============================================================================

import { AppState, Platform } from 'react-native';

export const isAppVisible = (): boolean =>
  Platform.OS === 'web'
    ? typeof document === 'undefined' || document.visibilityState === 'visible'
    : AppState.currentState === 'active';
