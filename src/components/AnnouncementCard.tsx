// ============================================================================
// VEBOSSO EMS — Announcement Card Component (Premium Fintech Aesthetic)
// ============================================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { formatDistanceToNow } from 'date-fns';
import { Colors } from '../constants/colors';
import { AnnouncementWithCreator } from '../types/database';
import { Feather } from '@expo/vector-icons';

interface AnnouncementCardProps {
  announcement: AnnouncementWithCreator;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const timeAgo = formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true });

  return (
    <View style={styles.card}>
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
    </View>
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
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  meta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#8E8E93',
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
    color: '#8E8E93',
  },
  body: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: '#3A3A3C',
    lineHeight: 22,
  },
});
