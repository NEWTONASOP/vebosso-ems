// ============================================================================
// VEBOSSO EMS — Leave Card Component (Premium Fintech Aesthetic)
// ============================================================================

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { AnimatedPressable } from './AnimatedPressable';
import { Text, ActivityIndicator } from 'react-native-paper';
import { format } from 'date-fns';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { LeaveRequestWithProfile } from '../types/database';
import { LEAVE_STATUS_CONFIG } from '../constants/roles';
import { AppTheme, appSoftShadow } from '../constants/theme';

interface LeaveCardProps {
  leave: LeaveRequestWithProfile;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  index?: number;
  isApproving?: boolean;
  isRejecting?: boolean;
  showUser?: boolean;
}

export function LeaveCard({
  leave,
  onApprove,
  onReject,
  index = 0,
  isApproving = false,
  isRejecting = false,
  showUser = true,
}: LeaveCardProps) {
  const profile = leave.profiles;
  const statusConfig = LEAVE_STATUS_CONFIG[leave.status] || {
    label: leave.status,
    color: AppTheme.mute,
    backgroundColor: AppTheme.soft,
  };

  const formattedDate = leave.date
    ? format(new Date(leave.date), 'EEEE, MMMM dd, yyyy')
    : '--';

  const getAvatarColors = () => {
    if (!profile) return { bg: AppTheme.soft, text: AppTheme.inkSoft };
    const role = profile.role || 'member';
    switch (role) {
      case 'owner': return { bg: AppTheme.violetSoft, text: AppTheme.violet };
      case 'manager': return { bg: AppTheme.blueSoft, text: AppTheme.blue };
      case 'member': default: return { bg: AppTheme.soft, text: AppTheme.inkSoft };
    }
  };

  const avatarColors = getAvatarColors();

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
      style={styles.card}
    >
      {/* Header Info */}
      {showUser && profile && (
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: avatarColors.bg }]}>
            <Text style={[styles.avatarLabel, { color: avatarColors.text }]}>
              {profile.full_name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile.full_name}</Text>
            <Text style={styles.employeeId}>
              {profile.employee_id} {profile.department ? `• ${profile.department}` : ''}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>
      )}

      {/* Leave details */}
      <View style={[styles.detailsSection, !showUser && { marginTop: 0 }]}>
        <View style={styles.detailsHeader}>
          <Feather name="calendar" size={14} color={AppTheme.amber} />
          <Text style={styles.dateLabel}> Requested Leave Date</Text>
          {!showUser && (
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.backgroundColor }]}>
                <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                  {statusConfig.label}
                </Text>
              </View>
            </View>
          )}
        </View>
        <Text style={styles.dateText}>{formattedDate}</Text>

        <View style={[styles.reasonSection, { marginTop: 10 }]}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{leave.reason}</Text>
        </View>
      </View>

      {/* Actions (Approve/Reject) */}
      {leave.status === 'pending' && (onApprove || onReject) && (
        <View style={styles.actions}>
          {onReject && (
            <AnimatedPressable
              style={({ pressed }) => [
                styles.rejectBtn,
                pressed && styles.btnPressed,
                isRejecting && { opacity: 0.6 }
              ]}
              disabled={isApproving || isRejecting}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onReject(leave.id);
              }}
            >
              {isRejecting ? (
                <ActivityIndicator size="small" color={AppTheme.coral} />
              ) : (
                <>
                  <Feather name="x" size={14} color={AppTheme.coral} />
                  <Text style={styles.rejectBtnText}>Reject</Text>
                </>
              )}
            </AnimatedPressable>
          )}

          {onApprove && (
            <AnimatedPressable
              style={({ pressed }) => [
                styles.approveBtn,
                pressed && styles.btnPressed,
                isApproving && { opacity: 0.6 }
              ]}
              disabled={isApproving || isRejecting}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onApprove(leave.id);
              }}
            >
              {isApproving ? (
                <ActivityIndicator size="small" color={AppTheme.white} />
              ) : (
                <>
                  <Feather name="check" size={14} color={AppTheme.white} />
                  <Text style={styles.approveBtnText}>Approve</Text>
                </>
              )}
            </AnimatedPressable>
          )}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 22,
    padding: 20,
    marginBottom: 14,
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 16,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  employeeId: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
  },
  detailsSection: {
    marginTop: 4,
    backgroundColor: AppTheme.amberSoft,
    borderRadius: 14,
    padding: 14,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  dateLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: AppTheme.amber,
  },
  dateText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: AppTheme.ink,
  },
  reasonSection: {
    borderTopWidth: 1,
    borderTopColor: AppTheme.hairline,
    paddingTop: 8,
  },
  reasonLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: AppTheme.mute,
    marginBottom: 2,
  },
  reasonText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.inkSoft,
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
    backgroundColor: AppTheme.coralSoft,
    borderRadius: 20,
    height: 40,
    gap: 6,
  },
  rejectBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: AppTheme.coral,
  },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.charcoal,
    borderRadius: 20,
    height: 40,
    gap: 6,
  },
  approveBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: AppTheme.white,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
