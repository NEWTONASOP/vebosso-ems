// ============================================================================
// VEBOSSO EMS — Approval Card Component
// ============================================================================

import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, Button, Avatar, Chip } from 'react-native-paper';
import { format } from 'date-fns';
import { Colors } from '../constants/colors';
import { WorkLogWithProfile } from '../types/database';
import { WORK_LOG_STATUS_CONFIG } from '../constants/roles';

interface ApprovalCardProps {
  workLog: WorkLogWithProfile;
  onApprove: (workLogId: string) => void;
  onReject: (workLogId: string) => void;
}

export function ApprovalCard({ workLog, onApprove, onReject }: ApprovalCardProps) {
  const profile = workLog.profiles;
  const statusConfig = WORK_LOG_STATUS_CONFIG[workLog.status];
  const checkInTime = workLog.check_in_time
    ? format(new Date(workLog.check_in_time), 'hh:mm a')
    : '--';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Avatar.Text
          size={44}
          label={profile.full_name.substring(0, 2).toUpperCase()}
          style={styles.avatar}
          labelStyle={styles.avatarLabel}
        />
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.employeeId}>{profile.employee_id}</Text>
        </View>
        <Chip
          style={[styles.statusChip, { backgroundColor: statusConfig.backgroundColor }]}
          textStyle={[styles.statusText, { color: statusConfig.color }]}
        >
          {statusConfig.label}
        </Chip>
      </View>

      <View style={styles.timeRow}>
        <View style={styles.timeItem}>
          <Text style={styles.timeLabel}>Check-in Time</Text>
          <Text style={styles.timeValue}>{checkInTime}</Text>
        </View>
        {profile.department && (
          <View style={styles.timeItem}>
            <Text style={styles.timeLabel}>Designation</Text>
            <Text style={styles.timeValue}>{profile.department}</Text>
          </View>
        )}
      </View>

      {workLog.check_in_plan && (
        <View style={styles.planSection}>
          <Text style={styles.planLabel}>📋 Plan for Today</Text>
          <Text style={styles.planText}>{workLog.check_in_plan}</Text>
        </View>
      )}

      {workLog.status === 'pending_approval' && (
        <View style={styles.actions}>
          <Button
            mode="outlined"
            onPress={() => onReject(workLog.id)}
            style={styles.rejectButton}
            textColor={Colors.error}
            icon="close"
          >
            Reject
          </Button>
          <Button
            mode="contained"
            onPress={() => onApprove(workLog.id)}
            style={styles.approveButton}
            buttonColor={Colors.success}
            textColor={Colors.white}
            icon="check"
          >
            Approve
          </Button>
        </View>
      )}

      {workLog.status === 'pending_checkout' && workLog.day_report && (
        <View style={styles.planSection}>
          <Text style={styles.planLabel}>📝 Day Report</Text>
          <Text style={styles.planText}>{workLog.day_report}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: Colors.accentSubtle,
  },
  avatarLabel: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  employeeId: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    height: 28,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 16,
  },
  timeItem: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600',
  },
  planSection: {
    marginTop: 14,
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 12,
  },
  planLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginBottom: 6,
  },
  planText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  rejectButton: {
    flex: 1,
    borderColor: Colors.error,
    borderRadius: 10,
  },
  approveButton: {
    flex: 1,
    borderRadius: 10,
  },
});
