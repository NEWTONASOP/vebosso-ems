// ============================================================================
// VEBOSSO EMS — Owner Accounts Layout
// ============================================================================

import { Stack } from 'expo-router';
import { AppTheme } from '../../../constants/theme';

// The list always sits under a detail screen, so back (on-screen or Android's)
// returns to it — even when the detail was opened from another tab.
export const unstable_settings = {
  initialRouteName: 'index',
};

export default function AccountsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTheme.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
