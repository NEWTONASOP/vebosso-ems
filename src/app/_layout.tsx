// ============================================================================
// VEBOSSO EMS — Root Layout
// ============================================================================

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OfflineBanner } from '../components/OfflineBanner';
import { Colors, PaperThemeColors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...PaperThemeColors,
  },
  roundness: 12,
};

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isInitialized, profile, isLoading } = useAuthStore();

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (!isInitialized || isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (!isAuthenticated || !profile) return;

    if (profile.must_change_password) {
      router.replace('/(auth)/force-change-password');
      return;
    }

    if (inAuthGroup) {
      switch (profile.role) {
        case 'owner':
          router.replace('/(owner)/dashboard');
          break;
        case 'manager':
          router.replace('/(manager)/dashboard');
          break;
        case 'member':
          router.replace('/(member)/home');
          break;
      }
    }
  }, [
    isAuthenticated,
    isInitialized,
    profile,
    segments,
    isLoading,
    rootNavigationState?.key,
    router,
  ]);

  return null;
}

export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);

  useEffect(() => {
    initialize().finally(() => {
      SplashScreen.hideAsync();
    });
  }, [initialize]);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.container}>
        <PaperProvider 
          theme={theme}
          settings={{
            icon: props => <MaterialCommunityIcons {...props} />,
          }}
        >
          <StatusBar style="dark" />
          <OfflineBanner />
          <AuthGuard />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: Colors.background },
              animation: 'fade',
            }}
          />
        </PaperProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
