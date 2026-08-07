// ============================================================================
// VEBOSSO EMS — Auth Layout
// ============================================================================

import { Stack } from 'expo-router';
import { AppTheme } from '../../constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: AppTheme.bg },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="force-change-password" />
    </Stack>
  );
}
