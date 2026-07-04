// ============================================================================
// VEBOSSO EMS — Shared Notification Logs Screen (Premium Fintech Aesthetic)
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';

import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { EmptyState } from './EmptyState';
import { Colors } from '../constants/colors';
import { Alert } from '../lib/alert';
import { PageTransition } from './PageTransition';

export default function NotificationLogScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    notifications,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAllNotifications,
    setupSubscription,
  } = useNotificationStore();

  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!profile) return;
    await fetchNotifications(profile.id);
  }, [profile, fetchNotifications]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Set up real-time updates
  useEffect(() => {
    if (!profile) return;
    const unsubscribe = setupSubscription(profile.id);
    return () => unsubscribe();
  }, [profile, setupSubscription]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (item: any) => {
    try {
      if (!item.read) {
        await markAsRead(item.id);
      }

      // Navigate based on type
      const type = item.data?.type || '';
      const role = profile?.role;

      if (type === 'check_in_request' || type === 'leave_request') {
        if (role === 'owner') {
          router.push('/(owner)/approvals' as any);
        } else if (role === 'manager') {
          router.push('/(manager)/approvals' as any);
        }
      } else if (
        type === 'task_assigned' ||
        type === 'task_completed' ||
        type === 'task_reassigned'
      ) {
        if (role === 'owner') {
          router.push('/(owner)/tasks' as any);
        } else if (role === 'manager') {
          router.push('/(manager)/tasks' as any);
        } else if (role === 'member') {
          router.push('/(member)/tasks' as any);
        }
      } else if (type === 'announcement') {
        if (role === 'member') {
          router.push('/(member)/announcements' as any);
        }
      }
    } catch (err) {
      console.error('Error handling notification tap:', err);
    }
  };

  const handleDeletePress = (id: string) => {
    Alert.alert('Delete Notification', 'Are you sure you want to delete this notification?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNotification(id) },
    ]);
  };

  const handleMarkAllReadPress = () => {
    if (!profile) return;
    markAllAsRead(profile.id);
  };

  const handleClearAllPress = () => {
    if (!profile) return;
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear your entire notification history? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear All', style: 'destructive', onPress: () => clearAllNotifications(profile.id) },
      ]
    );
  };

  const getNotificationIconInfo = (title: string, type?: string) => {
    const text = (title + ' ' + (type || '')).toLowerCase();
    
    if (text.includes('check-in') || text.includes('checkin') || text.includes('checked in')) {
      return {
        name: 'clock' as const,
        bg: Colors.warningLight,
        color: Colors.warning,
      };
    }
    if (text.includes('check-out') || text.includes('checkout') || text.includes('checked out')) {
      return {
        name: 'log-out' as const,
        bg: Colors.infoLight,
        color: Colors.info,
      };
    }
    if (text.includes('task') || text.includes('assigned')) {
      return {
        name: 'check-square' as const,
        bg: Colors.successLight,
        color: Colors.success,
      };
    }
    if (text.includes('leave') || text.includes('request')) {
      return {
        name: 'calendar' as const,
        bg: Colors.warningLight,
        color: Colors.warning,
      };
    }
    if (text.includes('announcement') || text.includes('news')) {
      return {
        name: 'volume-2' as const,
        bg: Colors.errorLight,
        color: Colors.error,
      };
    }
    return {
      name: 'bell' as const,
      bg: Colors.accentSubtle,
      color: Colors.accent,
    };
  };

  const getRelativeTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
    } catch {
      return 'just now';
    }
  };

  const hasUnread = notifications.some((n) => !n.read);

  return (
    <PageTransition>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={18} color={Colors.textPrimary} />
          </Pressable>
          
          <Text style={styles.title}>Notifications</Text>
          <View style={{ flex: 1 }} />

          {notifications.length > 0 && (
            <View style={styles.headerActions}>
              {hasUnread && (
                <Pressable
                  style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
                  onPress={handleMarkAllReadPress}
                >
                  <Feather name="check-square" size={18} color={Colors.success} />
                </Pressable>
              )}
              <Pressable
                style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]}
                onPress={handleClearAllPress}
              >
                <Feather name="trash-2" size={18} color={Colors.error} />
              </Pressable>
            </View>
          )}
        </View>

        {/* Content */}
        {isLoading && !refreshing && notifications.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </View>
        ) : (
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors.accent}
                colors={[Colors.accent]}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <EmptyState
                  icon="bell-off-outline"
                  title="All Clear"
                  subtitle="You don't have any notifications right now."
                />
              </View>
            }
            renderItem={({ item }) => {
              const iconInfo = getNotificationIconInfo(item.title, item.data?.type as string);
              return (
                <View style={[styles.card, !item.read && styles.unreadCard]}>
                  <Pressable
                    style={styles.cardPressable}
                    onPress={() => handleNotificationPress(item)}
                  >
                    <View style={[styles.iconContainer, { backgroundColor: iconInfo.bg }]}>
                      <Feather name={iconInfo.name} size={18} color={iconInfo.color} />
                    </View>

                    <View style={styles.textContainer}>
                      <View style={styles.cardHeader}>
                        <Text style={[styles.cardTitle, !item.read && styles.unreadTitle]}>
                          {item.title}
                        </Text>
                        {!item.read && <View style={styles.unreadDot} />}
                      </View>
                      <Text style={styles.cardBody} numberOfLines={3}>
                        {item.body}
                      </Text>
                      <Text style={styles.cardTime}>{getRelativeTime(item.created_at)}</Text>
                    </View>
                  </Pressable>

                  <Pressable
                    style={({ pressed }) => [styles.deleteBtn, pressed && styles.btnPressed]}
                    onPress={() => handleDeletePress(item.id)}
                  >
                    <Feather name="x" size={16} color={Colors.textTertiary} />
                  </Pressable>
                </View>
              );
            }}
          />
        )}
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
    gap: 12,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
    elevation: 1,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 14,
    gap: 12,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
    marginTop: 20,
  },
  card: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    position: 'relative',
    ...Colors.shadow,
    elevation: 1,
  },
  unreadCard: {
    borderColor: Colors.border,
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  cardPressable: {
    flex: 1,
    flexDirection: 'row',
    padding: 16,
    paddingRight: 40, // Space for delete X button
    gap: 14,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
  },
  unreadTitle: {
    color: Colors.textPrimary,
    fontFamily: 'Inter_700Bold',
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.info,
  },
  cardBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  cardTime: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  deleteBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
});
