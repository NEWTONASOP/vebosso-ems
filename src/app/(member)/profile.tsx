// ============================================================================
// VEBOSSO EMS — Member Profile Screen
// ============================================================================

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Alert } from '../../lib/alert';
import { Switch, Text } from 'react-native-paper';
import { APP_NAME, ROLE_LABELS } from '../../constants/roles';
import {
  AppTheme as T,
  AppSpace,
  AppRadius,
  appShadow,
  appSoftShadow,
  screenChrome,
  RoleAccent,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { ProfilePhotoEditor } from '../../components/ProfilePhotoEditor';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import Constants from 'expo-constants';

import { InfoRow } from '../../components/InfoRow';
import { DocumentsSheet } from '../../components/DocumentsSheet';
import { ExpensesSheet } from '../../components/ExpensesSheet';
import { PageTransition } from '../../components/PageTransition';
import { SalarySheet } from '../../components/SalarySheet';
import { useState } from 'react';
import { useSundayReminder } from '../../lib/useSundayReminder';

export default function MemberProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();
  const [openSheet, setOpenSheet] = useState<'documents' | 'salary' | 'expenses' | null>(null);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (!profile) return null;

  const roleAccent =
    profile.role === 'owner'
      ? RoleAccent.owner
      : profile.role === 'manager'
        ? RoleAccent.manager
        : RoleAccent.member;

  const getJoinedDate = () => {
    try {
      return format(new Date(profile.created_at), 'MMM d, yyyy');
    } catch {
      return new Date(profile.created_at).toLocaleDateString();
    }
  };

  return (
    <PageTransition>
      <ScrollView
        style={screenChrome.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={screenChrome.header}>
          <Text style={screenChrome.title}>Profile</Text>
        </View>

        {/* Profile card — same as the owner and manager settings */}
        <View style={styles.profileCard}>
          <ProfilePhotoEditor size={60} color={roleAccent.color} bg={roleAccent.soft} />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName} numberOfLines={2}>{profile.full_name}</Text>
            <View style={styles.roleBadge}>
              <View style={[styles.roleDot, { backgroundColor: roleAccent.color }]} />
              <Text style={styles.profileRole}>
                {ROLE_LABELS[profile.role]} • {profile.employee_id}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.groupedCard}>
            <InfoRow
              label="Status"
              value="Active"
              valueBadge
              badgeColor={T.greenSoft}
              badgeTextColor={T.green}
            />
            <InfoRow label="Full Name" value={profile.full_name} />
            <InfoRow label="Designation" value={profile.department || 'Not assigned'} />
            <InfoRow label="Joined" value={getJoinedDate()} isLast />
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Work & Pay</Text>
          <View style={styles.groupedCard}>
            <ActionRow
              label="My Documents"
              icon="file-text"
              onPress={() => setOpenSheet('documents')}
            />
            <ActionRow
              label="Salary"
              icon="credit-card"
              onPress={() => setOpenSheet('salary')}
            />
            <ActionRow
              label="Travel expenses"
              icon="navigation"
              onPress={() => setOpenSheet('expenses')}
            />
            <ActionRow
              label="Leave Requests"
              icon="calendar"
              onPress={() => router.push('/(member)/leaves')}
              isLast
            />
          </View>
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Security & Settings</Text>
          <View style={styles.groupedCard}>
            <ActionRow
              label="Change Password"
              icon="key"
              onPress={() => router.push('/(auth)/change-password')}
            />
            <SundayReminderRow />
            <ActionRow
              label="Sign Out"
              icon="log-out"
              onPress={handleSignOut}
              isDestructive
              isLast
            />
          </View>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME} EMS</Text>
          <Text style={styles.appVersion}>
            Version {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </View>
      </ScrollView>
      {openSheet === 'documents' ? (
        <DocumentsSheet
          visible
          onDismiss={() => setOpenSheet(null)}
          userId={profile.id}
          userName={profile.full_name}
          currentUserId={profile.id}
          canManage={false}
        />
      ) : null}
      {openSheet === 'salary' ? (
        <SalarySheet
          visible
          onDismiss={() => setOpenSheet(null)}
          userId={profile.id}
          userName={profile.full_name}
          mode="self"
        />
      ) : null}
      {openSheet === 'expenses' ? (
        <ExpensesSheet
          onDismiss={() => setOpenSheet(null)}
          userId={profile.id}
          userName={profile.full_name}
          mode="self"
        />
      ) : null}
    </PageTransition>
  );
}

interface ActionRowProps {
  label: string;
  icon: string;
  onPress: () => void;
  isDestructive?: boolean;
  isLast?: boolean;
}

/** On/off for the 11:30 AM check-in reminder on Sundays. */
function SundayReminderRow() {
  const { enabled, saving, setEnabled } = useSundayReminder();
  const toggle = async (value: boolean) => {
    const error = await setEnabled(value);
    if (error) Alert.alert(error);
  };
  return (
    <View style={rowStyles.rowWrapper}>
      <View style={rowStyles.rowContent}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={rowStyles.label}>Sunday check-in reminder</Text>
          <Text style={rowStyles.hint}>The 11:30 AM reminder, on Sundays too</Text>
        </View>
        <Switch value={enabled} onValueChange={(v) => void toggle(v)} disabled={saving} color={T.green} />
      </View>
      <View style={rowStyles.separator} />
    </View>
  );
}

function ActionRow({ label, icon, onPress, isDestructive, isLast }: ActionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [rowStyles.rowWrapper, pressed && rowStyles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={rowStyles.rowContent}>
        <Text style={[rowStyles.label, isDestructive && rowStyles.destructiveText]}>
          {label}
        </Text>
        <Feather
          name={icon as any}
          size={16}
          color={isDestructive ? T.coral : T.inkSoft}
        />
      </View>
      {!isLast && <View style={rowStyles.separator} />}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: T.mute,
    marginTop: 2,
  },
  rowWrapper: {
    backgroundColor: T.card,
  },
  pressed: {
    backgroundColor: T.soft,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: T.inkSoft,
  },
  destructiveText: {
    fontFamily: 'Inter_600SemiBold',
    color: T.coral,
  },
  // A whole pixel: a hairline (0.5px) lands crisp on some rows and faded on
  // others, so the dividers looked uneven.
  separator: {
    height: 1,
    backgroundColor: 'rgba(18, 20, 25, 0.06)',
    marginHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    marginHorizontal: AppSpace.screen,
    marginTop: 8,
    borderRadius: AppRadius.hero,
    padding: 20,
    ...appShadow,
    gap: 16,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: T.ink,
    letterSpacing: -0.3,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  profileRole: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
  },
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  sectionContainer: {
    marginTop: AppSpace.xxl,
    paddingHorizontal: AppSpace.screen,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
    marginBottom: 10,
  },
  groupedCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    overflow: 'hidden',
    ...appSoftShadow,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  appName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: T.mute,
  },
  appVersion: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.mute,
    marginTop: 2,
  },
});
