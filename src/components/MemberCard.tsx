// ============================================================================
// VEBOSSO EMS — Member Card Component
// ============================================================================

import { StyleSheet, View } from 'react-native';
import { Avatar, Icon, Text } from 'react-native-paper';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';
import { Colors } from '../constants/colors';
import { ROLE_LABELS, WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { Profile, WorkLogStatus } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';

interface MemberCardProps {
  member: Profile;
  currentStatus?: WorkLogStatus | 'offline' | 'on_leave';
  checkInTime?: string;
  onPress?: (pageY: number) => void;
  index?: number;
}

export function MemberCard({ member, currentStatus = 'offline', checkInTime, onPress, index = 0 }: MemberCardProps) {
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
    return { label: config?.label || 'Unknown', color: config?.color || Colors.textTertiary, bg: config?.backgroundColor || Colors.surfaceLight };
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

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      layout={LinearTransition.springify()}
      style={styles.cardContainer}
    >
      <AnimatedPressable
        style={styles.card}
        onPress={handlePress}
      >
      <Avatar.Text
        size={44}
        label={member.full_name.substring(0, 2).toUpperCase()}
        style={[styles.avatar, { backgroundColor: avatarColors.bg }]}
        labelStyle={[styles.avatarLabel, { color: avatarColors.text }]}
      />

      <View style={styles.info}>
        <Text style={styles.name}>{member.full_name}</Text>
        <Text style={styles.details}>
          {member.employee_id} {member.department ? `• ${member.department}` : ''}
        </Text>
        {checkInTime && (
          <View style={styles.checkInRow}>
            <Icon source="clock-outline" size={13} color={Colors.accent} />
            <Text style={styles.checkInTime}>{checkInTime}</Text>
          </View>
        )}
      </View>

      <View style={styles.rightSection}>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
        </View>
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
  avatar: {
  },
  avatarLabel: {
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
  checkInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  checkInTime: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
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
    color: Colors.textSecondary, // Changed from textTertiary for better small text contrast
    fontWeight: '500',
  },
});
