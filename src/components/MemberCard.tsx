// ============================================================================
// VEBOSSO EMS — Member Card Component
// ============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Avatar } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Profile, WorkLogStatus } from '../types/database';
import { WORK_LOG_STATUS_CONFIG, ROLE_LABELS } from '../constants/roles';

interface MemberCardProps {
  member: Profile;
  currentStatus?: WorkLogStatus | 'offline' | 'on_leave';
  checkInTime?: string;
  onPress?: () => void;
}

export function MemberCard({ member, currentStatus = 'offline', checkInTime, onPress }: MemberCardProps) {
  const getStatusDisplay = () => {
    if (currentStatus === 'offline') {
      return { label: 'Offline', color: Colors.textTertiary, bg: Colors.surfaceLight };
    }
    if (currentStatus === 'on_leave') {
      return { label: 'On Leave', color: Colors.warning, bg: Colors.warningLight };
    }
    const config = WORK_LOG_STATUS_CONFIG[currentStatus as WorkLogStatus];
    return { label: config?.label || 'Unknown', color: config?.color || Colors.textTertiary, bg: config?.backgroundColor || Colors.surfaceLight };
  };

  const status = getStatusDisplay();

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar.Text
        size={44}
        label={member.full_name.substring(0, 2).toUpperCase()}
        style={styles.avatar}
        labelStyle={styles.avatarLabel}
      />

      <View style={styles.info}>
        <Text style={styles.name}>{member.full_name}</Text>
        <Text style={styles.details}>
          {member.employee_id} {member.department ? `• ${member.department}` : ''}
        </Text>
        {checkInTime && (
          <Text style={styles.checkInTime}>🕐 {checkInTime}</Text>
        )}
      </View>

      <View style={styles.rightSection}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
        <Text style={styles.roleLabel}>{ROLE_LABELS[member.role]}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: {
    backgroundColor: Colors.accentSubtle,
  },
  avatarLabel: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  details: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  checkInTime: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  roleLabel: {
    fontSize: 10,
    color: Colors.textTertiary,
    fontWeight: '500',
  },
});
