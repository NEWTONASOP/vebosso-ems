// ============================================================================
// VEBOSSO EMS — Notification Bell Component with Realtime Badge Count
// ============================================================================

import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

interface NotificationBellProps {
  role: 'owner' | 'manager' | 'member';
}

export function NotificationBell({ role }: NotificationBellProps) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { unreadCount, fetchNotifications, setupSubscription } = useNotificationStore();

  useEffect(() => {
    if (!profile?.id) return;

    fetchNotifications(profile.id);

    const unsubscribe = setupSubscription(profile.id);
    return () => unsubscribe();
  }, [profile?.id, fetchNotifications, setupSubscription]);

  const handlePress = () => {
    if (role === 'owner') {
      router.push('/(owner)/notifications' as any);
    } else if (role === 'manager') {
      router.push('/(manager)/notifications' as any);
    } else if (role === 'member') {
      router.push('/(member)/notifications' as any);
    }
  };

  return (
    <AnimatedPressable style={styles.container} onPress={handlePress} scaleTo={0.92}>
      <Feather name="bell" size={19} color={AppTheme.inkSoft} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: AppTheme.card,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    ...appSoftShadow,
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: AppTheme.coral,
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: AppTheme.card,
    zIndex: 10,
  },
  badgeText: {
    color: AppTheme.white,
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    lineHeight: 11,
  },
});
