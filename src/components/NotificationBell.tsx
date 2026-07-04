// ============================================================================
// VEBOSSO EMS — Notification Bell Component with Realtime Badge Count
// ============================================================================

import React, { useEffect } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { useNotificationStore } from '../store/notificationStore';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../constants/colors';

interface NotificationBellProps {
  role: 'owner' | 'manager' | 'member';
}

export function NotificationBell({ role }: NotificationBellProps) {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { unreadCount, fetchNotifications, setupSubscription } = useNotificationStore();

  useEffect(() => {
    if (!profile?.id) return;
    
    // Initial fetch
    fetchNotifications(profile.id);

    // Setup subscription
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
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed
      ]}
      onPress={handlePress}
    >
      <Feather name="bell" size={20} color={Colors.textPrimary} />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
    ...Colors.shadow,
    elevation: 2,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
    opacity: 0.9,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FF3B30', // Vibrant system red
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    zIndex: 10,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    lineHeight: 12,
  },
});
