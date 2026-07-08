// ============================================================================
// VEBOSSO EMS — Announcement Card Component (Premium Fintech Aesthetic)
// ============================================================================

import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { formatDistanceToNow } from 'date-fns';

import { AnnouncementWithCreator } from '../types/database';
import { Feather } from '@expo/vector-icons';

import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Colors } from '../constants/colors';

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
        {/* Squircle Blue Icon Box */}
        <View style={styles.iconContainer}>
          <Feather name="bell" color="#007AFF" size={16} />
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
            style={({ pressed }) => [
              styles.deleteBtn,
              pressed && styles.deleteBtnPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete announcement"
          >
            <Feather name="trash-2" size={16} color={Colors.error} />
          </Pressable>
        )}
        
        {/* Sleek Role Pill */}
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
    backgroundColor: '#FFFFFF',
    borderRadius: 24, // Matches grouped card corners
    padding: 20,
    marginBottom: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  deleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(190, 18, 60, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(190, 18, 60, 0.18)',
  },
  deleteBtnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.85,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#5E6672', // Raised from #8E8E93 for WCAG AA compliance (4.5:1+)
    marginTop: 2,
  },
  targetBadge: {
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  targetText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#5E6672', // Raised from #8E8E93 for WCAG AA compliance (4.5:1+)
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 22,
  },
});
