// ============================================================================
// VEBOSSO EMS — Owner Settings Layout
// ============================================================================

import { Stack } from 'expo-router';
import { Colors } from '../../../constants/colors';

export default function SettingsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
        animation: 'slide_from_right',
      }}
    />
  );
}
