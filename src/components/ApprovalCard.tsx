// ============================================================================
// VEBOSSO EMS — Approval Card Component (Premium Fintech Aesthetic)
// ============================================================================

import { format } from 'date-fns';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';

import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors } from '../constants/colors';
import { WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { WorkLogWithProfile } from '../types/database';

interface ApprovalCardProps {
  workLog: WorkLogWithProfile;
  onApprove: (workLogId: string) => void;
  onReject: (workLogId: string) => void;
  onAssignAndApprove?: (workLog: WorkLogWithProfile) => void;
  index?: number;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export function ApprovalCard({ workLog, onApprove, onReject, onAssignAndApprove, index = 0, isApproving = false, isRejecting = false }: ApprovalCardProps) {
  const [showTaskDialog, setShowTaskDialog] = useState(false);
  
  const profile = workLog.profiles;
  const statusConfig = WORK_LOG_STATUS_CONFIG[workLog.status];
  
  const checkInTime = workLog.check_in_time
    ? format(new Date(workLog.check_in_time), 'hh:mm a')
    : '--';

  const getAvatarColors = () => {
    // @ts-ignore - role might be missing if not explicitly fetched in the join, defaulting safely
    const role = profile.role || 'member';
    switch (role) {
      case 'owner': return { bg: Colors.ownerAccent + '15', text: Colors.ownerAccent };
      case 'manager': return { bg: Colors.managerAccent + '15', text: Colors.managerAccent };
      case 'member': default: return { bg: Colors.memberAccent + '15', text: Colors.memberAccent };
    }
  };

  const avatarColors = getAvatarColors();

  const handleApproveClick = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    
    // For check-in approvals, show option to assign task
    if (workLog.status === 'pending_approval' && onAssignAndApprove) {
      setShowTaskDialog(true);
    } else {
      // For checkout approvals, directly approve
      onApprove(workLog.id);
    }
  };

  const handleApproveOnly = () => {
    setShowTaskDialog(false);
    onApprove(workLog.id);
  };

  const handleApproveWithTask = () => {
    setShowTaskDialog(false);
    onAssignAndApprove?.(workLog);
  };

  return (
    <Animated.View 
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
      style={styles.card}
    >
      {/* Header Info */}
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: avatarColors.bg, borderColor: avatarColors.text + '30' }]}>
          <Text style={[styles.avatarLabel, { color: avatarColors.text }]}>
            {profile.full_name.substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.employeeId}>{profile.employee_id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      </View>

      {/* Time & Designation Fields */}
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

      {/* Check-in Plan details */}
      {workLog.check_in_plan && (
        <View style={styles.planSection}>
          <View style={styles.planLabelRow}>
            <Feather name="clipboard" size={14} color="#007AFF" />
            <Text style={styles.planLabel}> Plan for Today</Text>
          </View>
          <Text style={styles.planText}>{workLog.check_in_plan}</Text>
        </View>
      )}

      {/* Checkout Day Report */}
      {workLog.status === 'pending_checkout' && workLog.day_report && (
        <View style={styles.planSection}>
          <View style={styles.planLabelRow}>
            <Feather name="file-text" size={14} color="#007AFF" />
            <Text style={styles.planLabel}> Day Report</Text>
          </View>
          <Text style={styles.planText}>{workLog.day_report}</Text>
        </View>
      )}

      {/* Actions (Approve/Reject) */}
      {(workLog.status === 'pending_approval' || workLog.status === 'pending_checkout') && (
        <View style={styles.actions}>
          <AnimatedPressable
            style={({ pressed }) => [
              styles.rejectBtn,
              pressed && styles.btnPressed
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onReject(workLog.id);
            }}
            disabled={isApproving || isRejecting}
          >
            <Feather name="x" size={14} color="#FF3B30" />
            <Text style={styles.rejectBtnText}>
              {isRejecting ? 'Rejecting...' : 'Reject'}
            </Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={({ pressed }) => [
              styles.approveBtn,
              pressed && styles.btnPressed
            ]}
            onPress={handleApproveClick}
            disabled={isApproving || isRejecting}
          >
            <Feather name="check" size={14} color="#FFFFFF" />
            <Text style={styles.approveBtnText}>
              {isApproving ? 'Approving...' : 'Approve'}
            </Text>
          </AnimatedPressable>
        </View>
      )}

      {/* Task Assignment Dialog */}
      <Portal>
        <Dialog 
          visible={showTaskDialog} 
          onDismiss={() => setShowTaskDialog(false)}
          style={styles.dialog}
        >
          <Dialog.Title style={styles.dialogTitle}>Assign a Task?</Dialog.Title>
          <Dialog.Content>
            <Text style={styles.dialogText}>
              Would you like to assign a task to {profile.full_name} along with the approval?
            </Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <Button 
              mode="contained"
              onPress={handleApproveOnly}
              style={styles.dialogButtonSecondary}
              contentStyle={styles.dialogButtonContent}
              buttonColor={Colors.systemGray6}
              textColor={Colors.textPrimary}
              labelStyle={styles.dialogButtonSecondaryText}
            >
              Just Approve
            </Button>
            <Button 
              mode="contained"
              onPress={handleApproveWithTask}
              style={styles.dialogButtonPrimary}
              contentStyle={styles.dialogButtonContent}
              buttonColor={Colors.accent}
              textColor="#FFFFFF"
              labelStyle={styles.dialogButtonPrimaryText}
            >
              Assign Task
            </Button>
          </View>
        </Dialog>
      </Portal>
    </Animated.View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
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
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#8B5CF6' + '15',
    borderWidth: 1,
    borderColor: '#8B5CF6' + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: 'Inter_800ExtraBold',
    color: '#8B5CF6',
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  employeeId: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#5E6672', // Raised from #8E8E93 for readable contrast
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  timeRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 12,
  },
  timeItem: {
    flex: 1,
    backgroundColor: '#F4F4F6', // System Gray 6
    padding: 12,
    borderRadius: 14,
  },
  timeLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#5E6672', // Raised from #8E8E93 for contrast on Gray 6 background
    marginBottom: 4,
  },
  timeValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#1C1C1E',
  },
  planSection: {
    marginTop: 14,
    backgroundColor: 'rgba(0, 122, 255, 0.04)', // Tinted soft blue
    borderRadius: 14,
    padding: 14,
  },
  planLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  planLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#007AFF',
  },
  planText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#3A3A3C',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.08)', // Soft red
    borderRadius: 20,
    height: 40,
    gap: 6,
  },
  rejectBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#FF3B30',
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000', // Solid black
    borderRadius: 20,
    height: 40,
    gap: 6,
  },
  approveBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  dialog: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  dialogTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  dialogText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    gap: 10,
  },
  dialogButtonContent: {
    height: 44,
  },
  dialogButtonSecondary: {
    flex: 1,
    borderRadius: 14,
  },
  dialogButtonSecondaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  dialogButtonPrimary: {
    flex: 1,
    borderRadius: 14,
  },
  dialogButtonPrimaryText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
