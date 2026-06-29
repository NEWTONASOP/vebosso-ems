// ============================================================================
// VEBOSSO EMS — Root Layout
// ============================================================================

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
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
  const [isCheckingVersion, setIsCheckingVersion] = useState(true);
  const [versionCheck, setVersionCheck] = useState<{
    needsUpdate: boolean;
    forceUpdate: boolean;
    currentVersion: string;
    minimumVersion: string;
    latestVersion: string;
    updateMessage?: string;
  } | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check version first
        const { checkAppVersion } = await import('../lib/versionCheck');
        const result = await checkAppVersion();
        
        if (result.forceUpdate) {
          // Show force update screen
          setVersionCheck(result);
          setIsCheckingVersion(false);
          return;
        }
        
        // If no force update needed, initialize auth
        await initialize();
      } catch (error) {
        console.error('App initialization error:', error);
        // Even if version check fails, try to initialize
        await initialize();
      } finally {
        setIsCheckingVersion(false);
        SplashScreen.hideAsync();
      }
    };

    initializeApp();
  }, [initialize]);

  // Show update screen if force update is required
  if (!isCheckingVersion && versionCheck?.forceUpdate) {
    const { UpdateRequired } = require('../components/UpdateRequired');
    return (
      <ErrorBoundary>
        <GestureHandlerRootView style={styles.container}>
          <PaperProvider theme={theme}>
            <StatusBar style="dark" />
            <UpdateRequired
              currentVersion={versionCheck.currentVersion}
              minimumVersion={versionCheck.minimumVersion}
              latestVersion={versionCheck.latestVersion}
              message={versionCheck.updateMessage}
              forceUpdate={versionCheck.forceUpdate}
            />
          </PaperProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    );
  }

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
