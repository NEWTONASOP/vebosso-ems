// ============================================================================
// VEBOSSO EMS — Announcement Card Component
// ============================================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Chip } from 'react-native-paper';
import { format, formatDistanceToNow } from 'date-fns';
import { Colors } from '../constants/colors';
import { AnnouncementWithCreator } from '../types/database';

interface AnnouncementCardProps {
  announcement: AnnouncementWithCreator;
}

export function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const timeAgo = formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>📢</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.title}>{announcement.title}</Text>
          <Text style={styles.meta}>
            By {announcement.creator?.full_name || 'Admin'} • {timeAgo}
          </Text>
        </View>
        {announcement.target_role && announcement.target_role !== 'all' && (
          <Chip compact style={styles.targetChip} textStyle={styles.targetText}>
            {announcement.target_role === 'manager' ? 'Managers' : 'Members'}
          </Chip>
        )}
      </View>

      <Text style={styles.body}>{announcement.body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    borderLeftColor: Colors.info,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  icon: {
    fontSize: 18,
  },
  headerInfo: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  meta: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  targetChip: {
    backgroundColor: Colors.infoLight,
    height: 24,
  },
  targetText: {
    fontSize: 10,
    color: Colors.info,
  },
  body: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
});
