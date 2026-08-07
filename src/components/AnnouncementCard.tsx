// ============================================================================
// VEBOSSO EMS — Announcement Card
// ============================================================================

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { formatDistanceToNow } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { AnnouncementWithCreator } from '../types/database';
import { AppTheme, AppRadius, appSoftShadow } from '../constants/theme';

interface AnnouncementCardProps {
  announcement: AnnouncementWithCreator;
  index?: number;
  canDelete?: boolean;
  onDelete?: (announcementId: string) => void;
}

export function AnnouncementCard({ announcement, index = 0, canDelete = false, onDelete }: AnnouncementCardProps) {
  const timeAgo = formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true });

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
      style={styles.card}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Feather name="bell" color={AppTheme.blue} size={16} />
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.meta}>
            By {announcement.creator?.full_name || 'Admin'} • {timeAgo}
          </Text>
        </View>

        {canDelete && (
          <Pressable
            onPress={() => onDelete?.(announcement.id)}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel="Delete announcement"
            hitSlop={4}
          >
            <Feather name="trash-2" size={16} color={AppTheme.coral} />
          </Pressable>
        )}

        {announcement.target_role && announcement.target_role !== 'all' && (
          <View style={styles.targetBadge}>
            <Text style={styles.targetText}>
              {announcement.target_role === 'manager' ? 'Managers' : 'Members'}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.body}>{announcement.body}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.card,
    padding: 18,
    marginBottom: 12,
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: AppTheme.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  deleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.coralSoft,
  },
  deleteBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 2,
  },
  targetBadge: {
    backgroundColor: AppTheme.soft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginLeft: 6,
  },
  targetText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 10,
    color: AppTheme.inkSoft,
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.inkSoft,
    lineHeight: 22,
  },
});
