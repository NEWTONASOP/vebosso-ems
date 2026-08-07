// ============================================================================
// VEBOSSO EMS — Owner Settings Layout
// ============================================================================

import { Stack } from 'expo-router';
import { AppTheme } from '../../../constants/theme';

export default function SettingsLayout() {
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
