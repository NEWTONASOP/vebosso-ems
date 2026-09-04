// ============================================================================
// VEBOSSO EMS — Member attendance sheet
// Tapping someone on a team list opens their attendance day by day, without
// making the reviewer go to the Attendance tab and pick them again.
// ============================================================================

import { ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Modal, Portal, Text } from 'react-native-paper';
import { MemberAttendancePanel } from './MemberAttendancePanel';
import { ROLE_LABELS } from '../constants/roles';
import { AppTheme, appSoftShadow } from '../constants/theme';
import { Profile } from '../types/database';

interface MemberAttendanceModalProps {
  visible: boolean;
  member: Profile | null;
  onDismiss: () => void;
  accentColor?: string;
}

export function MemberAttendanceModal({
  visible,
  member,
  onDismiss,
  accentColor,
}: MemberAttendanceModalProps) {
  if (!visible || !member) return null;

  return (
    <Portal>
      <Modal visible onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Avatar.Text
            size={44}
            label={member.full_name.substring(0, 2).toUpperCase()}
            style={styles.avatar}
            labelStyle={styles.avatarLabel}
          />
          <View style={styles.headerText}>
            <Text style={styles.name} numberOfLines={1}>
              {member.full_name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {member.employee_id} · {ROLE_LABELS[member.role]}
            </Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
        >
          <MemberAttendancePanel
            memberId={member.id}
            accentColor={accentColor}
            enableDetailSheet={false}
            showLocation
          />
        </ScrollView>

        <Button
          mode="contained"
          onPress={onDismiss}
          style={styles.closeButton}
          contentStyle={styles.closeButtonContent}
          buttonColor={AppTheme.soft}
          textColor={AppTheme.charcoal}
        >
          Close
        </Button>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    marginTop: 'auto',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 20,
    maxHeight: '88%',
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: AppTheme.blueSoft,
  },
  avatarLabel: {
    color: AppTheme.blue,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 18,
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  meta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: AppTheme.mute,
    marginTop: 2,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  closeButton: {
    borderRadius: 999,
    marginTop: 12,
  },
  closeButtonContent: {
    height: 46,
  },
});
