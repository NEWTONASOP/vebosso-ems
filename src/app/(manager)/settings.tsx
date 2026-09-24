// ============================================================================
// VEBOSSO EMS — Manager Profile Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { InfoRow } from '../../components/InfoRow';
import { DocumentsSheet } from '../../components/DocumentsSheet';
import { ExpensesSheet } from '../../components/ExpensesSheet';
import { PageTransition } from '../../components/PageTransition';
import { SalarySheet } from '../../components/SalarySheet';
import { useState } from 'react';
import { APP_NAME, ROLE_LABELS } from '../../constants/roles';
import {
  AppRadius,
  AppSpace,
  AppTheme,
  RoleAccent,
  appShadow,
  appSoftShadow,
  screenChrome,
} from '../../constants/theme';
import { Alert } from '../../lib/alert';
import { useAuthStore } from '../../store/authStore';
import { ProfilePhotoEditor } from '../../components/ProfilePhotoEditor';

export default function ManagerSettingsScreen() {
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

        {/* Profile card — role accent on avatar only */}
        <View style={styles.profileCard}>
          <ProfilePhotoEditor
            size={60}
            color={RoleAccent.manager.color}
            bg={RoleAccent.manager.soft}
          />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile.full_name}</Text>
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.profileRole}>
                {ROLE_LABELS[profile.role]} • {profile.employee_id}
              </Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionLabel}>Details</Text>
        <View style={styles.groupedCard}>
          <InfoRow
            label="Status"
            value="Active"
            valueBadge
            badgeColor={AppTheme.greenSoft}
            badgeTextColor={AppTheme.green}
          />
          <InfoRow label="Full Name" value={profile.full_name} />
          <InfoRow label="Designation" value={profile.department || 'Not assigned'} />
          <InfoRow label="Joined" value={getJoinedDate()} isLast />
        </View>

        <Text style={styles.sectionLabel}>Work & pay</Text>
        <View style={styles.groupedCard}>
          <ActionRow
            label="My Documents"
            subtitle="Upload ID, certificates and other papers"
            icon="file-text"
            iconColor={AppTheme.violet}
            iconBg={AppTheme.violetSoft}
            onPress={() => setOpenSheet('documents')}
          />
          <View style={styles.separator} />
          <ActionRow
            label="Salary"
            subtitle="Ask the boss and confirm when it arrives"
            icon="credit-card"
            iconColor={AppTheme.green}
            iconBg={AppTheme.greenSoft}
            onPress={() => setOpenSheet('salary')}
          />
          <View style={styles.separator} />
          <ActionRow
            label="Travel expenses"
            subtitle="Send what you spent; confirm when it’s paid"
            icon="navigation"
            iconColor={AppTheme.violet}
            iconBg={AppTheme.violetSoft}
            onPress={() => setOpenSheet('expenses')}
          />
        </View>

        <Text style={styles.sectionLabel}>Security & settings</Text>
        <View style={styles.groupedCard}>
          <ActionRow
            label="Change Password"
            subtitle="Update your account password"
            icon="key"
            iconColor={AppTheme.amber}
            iconBg={AppTheme.amberSoft}
            onPress={() => router.push('/(auth)/change-password')}
          />
          <View style={styles.separator} />
          <ActionRow
            label="Leave Requests"
            subtitle="Apply for time off and track status"
            icon="calendar"
            iconColor={AppTheme.blue}
            iconBg={AppTheme.blueSoft}
            onPress={() => router.push('/(manager)/leaves')}
          />
        </View>

        <View style={styles.signOutCard}>
          <Pressable
            style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
          >
            <View style={[styles.iconContainer, { backgroundColor: AppTheme.coralSoft }]}>
              <Feather name="log-out" size={18} color={AppTheme.coral} />
            </View>
            <View style={styles.actionInfo}>
              <Text style={styles.signOutTitle}>Sign Out</Text>
              <Text style={styles.actionSubtitle}>Log out of your account</Text>
            </View>
            <Feather name="chevron-right" size={16} color={AppTheme.coral} />
          </Pressable>
        </View>

        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME} EMS</Text>
          <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
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

// ============================================================================
// Row Components
// ============================================================================

interface ActionRowProps {
  label: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  onPress: () => void;
}

function ActionRow({ label, subtitle, icon, iconColor, iconBg, onPress }: ActionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, pressed && styles.rowPressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.actionInfo}>
        <Text style={styles.actionTitle}>{label}</Text>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={AppTheme.mute} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
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
    color: AppTheme.ink,
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
    backgroundColor: RoleAccent.manager.color,
    marginRight: 6,
  },
  profileRole: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: AppTheme.mute,
  },
  sectionLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: AppTheme.mute,
    letterSpacing: -0.1,
    paddingHorizontal: AppSpace.screen,
    marginTop: 24,
    marginBottom: 10,
  },
  groupedCard: {
    backgroundColor: AppTheme.card,
    marginHorizontal: AppSpace.screen,
    borderRadius: AppRadius.card,
    overflow: 'hidden',
    ...appSoftShadow,
  },
  signOutCard: {
    backgroundColor: AppTheme.card,
    marginHorizontal: AppSpace.screen,
    marginTop: 16,
    borderRadius: AppRadius.card,
    overflow: 'hidden',
    ...appSoftShadow,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    backgroundColor: AppTheme.card,
  },
  rowPressed: {
    backgroundColor: AppTheme.soft,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  actionInfo: {
    flex: 1,
    paddingRight: 8,
  },
  actionTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  actionSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginTop: 2,
  },
  signOutTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.coral,
    letterSpacing: -0.2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppTheme.hairline,
    marginLeft: 64,
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  appName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: AppTheme.mute,
  },
  appVersion: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    marginTop: 2,
  },
});
