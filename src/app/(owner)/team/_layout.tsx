// ============================================================================
// VEBOSSO EMS — Owner Team Layout
// ============================================================================

import { Stack } from 'expo-router';
import { AppTheme } from '../../../constants/theme';

export default function TeamLayout() {
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
