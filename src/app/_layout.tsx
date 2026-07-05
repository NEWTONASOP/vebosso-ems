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
import { configureFonts, MD3LightTheme, PaperProvider } from 'react-native-paper';
import 'react-native-reanimated';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { LoadingScreen } from '../components/LoadingScreen';
import { OfflineBanner } from '../components/OfflineBanner';
import { UpdateChecker } from '../components/UpdateChecker';
import { Colors, PaperThemeColors } from '../constants/colors';
import { useAuthStore } from '../store/authStore';

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/inter';

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync();

const fontConfig = {
  fontFamily: 'Inter_400Regular',
  displayLarge: { fontFamily: 'Inter_800ExtraBold', fontWeight: '800' as const, fontSize: 57, letterSpacing: -0.25, lineHeight: 64 },
  displayMedium: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const, fontSize: 45, letterSpacing: 0, lineHeight: 52 },
  displaySmall: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const, fontSize: 36, letterSpacing: 0, lineHeight: 44 },
  headlineLarge: { fontFamily: 'Inter_700Bold', fontWeight: '700' as const, fontSize: 32, letterSpacing: 0, lineHeight: 40 },
  headlineMedium: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 28, letterSpacing: 0, lineHeight: 36 },
  headlineSmall: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 24, letterSpacing: 0, lineHeight: 32 },
  titleLarge: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 22, letterSpacing: 0, lineHeight: 28 },
  titleMedium: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 16, letterSpacing: 0.15, lineHeight: 24 },
  titleSmall: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 14, letterSpacing: 0.1, lineHeight: 20 },
  labelLarge: { fontFamily: 'Inter_600SemiBold', fontWeight: '600' as const, fontSize: 14, letterSpacing: 0.1, lineHeight: 20 },
  labelMedium: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 12, letterSpacing: 0.5, lineHeight: 16 },
  labelSmall: { fontFamily: 'Inter_500Medium', fontWeight: '500' as const, fontSize: 11, letterSpacing: 0.5, lineHeight: 16 },
  bodyLarge: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const, fontSize: 16, letterSpacing: 0.15, lineHeight: 24 },
  bodyMedium: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const, fontSize: 14, letterSpacing: 0.25, lineHeight: 20 },
  bodySmall: { fontFamily: 'Inter_400Regular', fontWeight: '400' as const, fontSize: 12, letterSpacing: 0.4, lineHeight: 16 },
};

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    ...PaperThemeColors,
  },
  fonts: configureFonts({ config: fontConfig }),
  roundness: 16, // Softer curves for premium feel
};

function AuthGuard() {
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();
  const { isAuthenticated, isInitialized, profile, isLoading } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && profile?.id) {
      let active = true;
      let cleanup: (() => void) | undefined;

      const setupNotifications = async () => {
        try {
          const { 
            registerForPushNotificationsAsync, 
            savePushToken, 
            addNotificationResponseListener, 
            addNotificationReceivedListener 
          } = await import('../lib/notifications');
          
          const token = await registerForPushNotificationsAsync();
          if (token && active) {
            await savePushToken(profile.id, token);
          }

          if (active) {
            const responseSub = addNotificationResponseListener((response) => {
              if (__DEV__) console.log('Notification tapped:', response.notification.request.content.data);
            });
            const receivedSub = addNotificationReceivedListener((notification) => {
              if (__DEV__) console.log('Notification received in foreground:', notification);
            });

            cleanup = () => {
              responseSub.remove();
              receivedSub.remove();
            };
          }
        } catch (error) {
          console.error('Failed to setup push notifications:', error);
        }
      };

      setupNotifications();

      return () => {
        active = false;
        if (cleanup) cleanup();
      };
    }
  }, [isAuthenticated, profile?.id]);

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (!isInitialized || isLoading) return;

    const group = segments[0];
    const inAuthGroup = group === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
      return;
    }

    if (!isAuthenticated || !profile) return;

    if (profile.must_change_password) {
      router.replace('/(auth)/force-change-password');
      return;
    }

    const isChangePassword = segments[1] === 'change-password';

    // 1. If in auth group (e.g. just logged in), redirect to correct dashboard
    if (inAuthGroup && !isChangePassword) {
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
      return;
    }

    // 2. Role-based Route Guard: Enforce role group correctness (fixes web reload route collisions)
    if (group && group !== '(auth)') {
      const inOwnerGroup = group === '(owner)';
      const inManagerGroup = group === '(manager)';
      const inMemberGroup = group === '(member)';

      if (profile.role === 'owner' && !inOwnerGroup) {
        router.replace('/(owner)/dashboard');
      } else if (profile.role === 'manager' && !inManagerGroup) {
        router.replace('/(manager)/dashboard');
      } else if (profile.role === 'member' && !inMemberGroup) {
        router.replace('/(member)/home');
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
  const isInitialized = useAuthStore((s) => s.isInitialized);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
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
          <UpdateChecker />
          <AuthGuard />
          {!isInitialized ? (
            <LoadingScreen />
          ) : (
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: Colors.background },
                animation: 'slide_from_right',
              }}
            />
          )}
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

