// ============================================================================
// VEBOSSO EMS — Owner Settings Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, Pressable, StyleSheet, View } from 'react-native';
import { Snackbar, Switch, Text } from 'react-native-paper';
import { APP_NAME } from '../../../constants/roles';
import {
  AppRadius,
  AppSpace,
  AppTheme,
  appShadow,
  appSoftShadow,
  screenChrome,
} from '../../../constants/theme';
import { Alert } from '../../../lib/alert';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';

export default function OwnerSettingsScreen() {
  const router = useRouter();
  const { signOut, profile } = useAuthStore();
  const { settings, updateSetting } = useWorkStore();

  const [snackMessage, setSnackMessage] = React.useState('');

  const requireCheckoutApproval = settings['require_checkout_approval'] === 'true';

  const handleToggleCheckout = async () => {
    const result = await updateSetting('require_checkout_approval', requireCheckoutApproval ? 'false' : 'true');
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to update setting. Please try again.');
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={screenChrome.root}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={screenChrome.header}>
          <Text style={screenChrome.title}>Settings</Text>
        </View>

        {/* Profile card — visual anchor */}
        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.full_name}</Text>
            <View style={styles.roleBadge}>
              <View style={styles.roleDot} />
              <Text style={styles.profileRole}>Owner • {profile?.employee_id}</Text>
            </View>
          </View>
        </View>

        {/* Team Management */}
        <Text style={styles.sectionLabel}>Team management</Text>
        <View style={styles.groupedCard}>
          <SettingsRow
            icon="bell"
            iconColor={AppTheme.amber}
            iconBg={AppTheme.amberSoft}
            title="Announcements"
            subtitle="Send announcements to team"
            onPress={() => router.push('/(owner)/settings/announcements')}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon="cpu"
            iconColor={AppTheme.violet}
            iconBg={AppTheme.violetSoft}
            title="Session Management"
            subtitle="View and manage active sessions"
            onPress={() => router.push('/(owner)/settings/session-management')}
          />
        </View>

        {/* App Settings */}
        <Text style={styles.sectionLabel}>App settings</Text>
        <View style={styles.groupedCard}>
          <View style={styles.toggleRow}>
            <View style={[styles.iconContainer, { backgroundColor: AppTheme.blueSoft }]}>
              <Feather name="check-square" size={18} color={AppTheme.blue} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Require Checkout Approval</Text>
              <Text style={styles.settingSubtitle}>
                Members need approval when ending their day
              </Text>
            </View>
            <Switch
              value={requireCheckoutApproval}
              onValueChange={handleToggleCheckout}
              color={AppTheme.charcoal}
            />
          </View>
        </View>

        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.groupedCard}>
          <SettingsRow
            icon="lock"
            iconColor={AppTheme.amber}
            iconBg={AppTheme.amberSoft}
            title="Change Password"
            subtitle="Update your password"
            onPress={() => router.push('/(auth)/change-password')}
          />
        </View>

        {/* Sign out — visually separated destructive action */}
        <View style={styles.signOutCard}>
          <Pressable
            style={({ pressed }) => [
              styles.settingRow,
              styles.signOutRow,
              pressed && styles.rowPressed,
            ]}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign Out"
          >
            <View style={[styles.iconContainer, { backgroundColor: AppTheme.coralSoft }]}>
              <Feather name="log-out" size={18} color={AppTheme.coral} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={styles.signOutTitle}>Sign Out</Text>
              <Text style={styles.settingSubtitle}>Log out of your account</Text>
            </View>
            <Feather name="chevron-right" size={16} color={AppTheme.coral} />
          </Pressable>
        </View>

        {/* App Info Footer */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME} EMS</Text>
          <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </ScrollView>

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={4000}
        theme={{ colors: { inverseSurface: AppTheme.charcoal, inverseOnSurface: AppTheme.white } }}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

// ============================================================================
// Row Component
// ============================================================================

interface SettingsRowProps {
  icon: string;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function SettingsRow({ icon, iconColor, iconBg, title, subtitle, onPress }: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        pressed && styles.rowPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconBg }]}>
        <Feather name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={AppTheme.mute} />
    </Pressable>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: AppTheme.violetSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    color: AppTheme.violet,
    fontSize: 20,
    letterSpacing: -0.4,
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
    backgroundColor: AppTheme.violet,
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    backgroundColor: AppTheme.card,
  },
  signOutRow: {
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
  settingInfo: {
    flex: 1,
    paddingRight: 8,
  },
  settingTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  settingSubtitle: {
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
    backgroundColor: AppTheme.card,
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
