// ============================================================================
// VEBOSSO EMS — Member Card Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { StyleSheet, View } from 'react-native';
import { Avatar, Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { ROLE_LABELS, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Profile, WorkLogStatus } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';

interface MemberCardProps {
  member: Profile;
  currentStatus?: WorkLogStatus | 'offline' | 'on_leave';
  checkInTime?: string | null;
  checkInPlan?: string | null;
  pendingTaskCount?: number;
  onPress?: (pageY: number) => void;
  index?: number;
}

export function MemberCard({
  member,
  currentStatus = 'offline',
  checkInTime,
  checkInPlan,
  pendingTaskCount = 0,
  onPress,
  index = 0,
}: MemberCardProps) {
  const handlePress = (e: any) => {
    if (!onPress) return;
    const pageY = e?.nativeEvent?.pageY ?? 200;
    onPress(pageY);
  };

  const getStatusDisplay = () => {
    if (currentStatus === 'offline') {
      return { label: 'Offline', color: Colors.textTertiary, bg: Colors.surfaceLight };
    }
    if (currentStatus === 'on_leave') {
      return { label: 'On Leave', color: Colors.warning, bg: Colors.warningLight };
    }
    const config = WORK_LOG_STATUS_CONFIG[currentStatus as WorkLogStatus];
    return {
      label: config?.label || 'Unknown',
      color: config?.color || Colors.textTertiary,
      bg: config?.backgroundColor || Colors.surfaceLight,
    };
  };

  const getAvatarColors = () => {
    switch (member.role) {
      case 'owner': return { bg: Colors.ownerAccent + '15', text: Colors.ownerAccent };
      case 'manager': return { bg: Colors.managerAccent + '15', text: Colors.managerAccent };
      case 'member': default: return { bg: Colors.memberAccent + '15', text: Colors.memberAccent };
    }
  };

  const status = getStatusDisplay();
  const avatarColors = getAvatarColors();
  const isActive = currentStatus !== 'offline';

  const formattedCheckIn = checkInTime
    ? format(new Date(checkInTime), 'hh:mm a')
    : null;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
      style={styles.cardContainer}
    >
      <AnimatedPressable style={styles.card} onPress={handlePress}>
        {/* Avatar */}
        <Avatar.Text
          size={44}
          label={member.full_name.substring(0, 2).toUpperCase()}
          style={[styles.avatar, { backgroundColor: avatarColors.bg }]}
          labelStyle={[styles.avatarLabel, { color: avatarColors.text }]}
        />

        {/* Main info */}
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{member.full_name}</Text>
            {isActive && (
              <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
              </View>
            )}
          </View>

          <Text style={styles.details}>
            {member.employee_id}{member.department ? ` • ${member.department}` : ''}
          </Text>

          {/* Live activity row */}
          {isActive && (
            <View style={styles.activityRow}>
              {formattedCheckIn && (
                <View style={styles.activityChip}>
                  <Feather name="log-in" size={11} color={Colors.success} />
                  <Text style={styles.activityChipText}>{formattedCheckIn}</Text>
                </View>
              )}
              {pendingTaskCount > 0 && (
                <View style={styles.activityChip}>
                  <Feather name="check-square" size={11} color={Colors.warning} />
                  <Text style={styles.activityChipText}>
                    {pendingTaskCount} task{pendingTaskCount > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Today's plan snippet */}
          {checkInPlan && isActive && (
            <Text style={styles.planSnippet} numberOfLines={1}>
              {checkInPlan}
            </Text>
          )}
        </View>

        {/* Right side — role + offline status */}
        <View style={styles.rightSection}>
          {!isActive && (
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
            </View>
          )}
          <Text style={styles.roleLabel}>{ROLE_LABELS[member.role]}</Text>
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    marginBottom: 10,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  avatar: {},
  avatarLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    flexShrink: 1,
  },
  details: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  activityRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  activityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  activityChipText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  planSnippet: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 5,
    fontStyle: 'italic',
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 6,
    marginLeft: 8,
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
    fontFamily: 'Inter_600SemiBold',
  },
  roleLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
