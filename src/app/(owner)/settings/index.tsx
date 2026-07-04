// ============================================================================
// VEBOSSO EMS — Owner Settings Screen (Premium Fintech Aesthetic)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Switch, Text } from 'react-native-paper';
import { Colors } from '../../../constants/colors';
import { APP_NAME } from '../../../constants/roles';
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
    <View style={{ flex: 1 }}>
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Profile Card (Apple ID Style) */}
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

      {/* Team Management Group */}
      <Text style={styles.sectionLabel}>Team Management</Text>
      <View style={styles.groupedCard}>
        <SettingsRow
          icon="bell"
          iconColor={Colors.warning}
          title="Announcements"
          subtitle="Send announcements to team"
          onPress={() => router.push('/(owner)/settings/announcements')}
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="cpu"
          iconColor={Colors.ownerAccent}
          title="Session Management"
          subtitle="View and manage active sessions"
          onPress={() => router.push('/(owner)/settings/session-management')}
          isLast
        />
      </View>

      {/* App Settings Group */}
      <Text style={styles.sectionLabel}>App Settings</Text>
      <View style={styles.groupedCard}>
        <View style={styles.toggleRow}>
          <View style={[styles.iconContainer, { backgroundColor: Colors.textSecondary + '1A' }]}>
            <Feather name="check-square" size={18} color={Colors.textSecondary} />
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
            color={Colors.accent} // Custom switch to match fintech design
          />
        </View>
      </View>

      {/* Account Actions Group */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.groupedCard}>
        <SettingsRow
          icon="lock"
          iconColor={Colors.warning}
          title="Change Password"
          subtitle="Update your password"
          onPress={() => router.push('/(auth)/change-password')}
        />
        <Pressable
          style={({ pressed }) => [
            styles.settingRow,
            pressed && styles.rowPressed
          ]}
          onPress={handleSignOut}
        >
          <View style={[styles.iconContainer, { backgroundColor: Colors.errorLight }]}>
            <Feather name="log-out" size={18} color={Colors.error} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: Colors.error }]}>Sign Out</Text>
            <Text style={styles.settingSubtitle}>Log out of your account</Text>
          </View>
          <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
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
  title: string;
  subtitle: string;
  onPress: () => void;
  isLast?: boolean;
}

function SettingsRow({ icon, iconColor, title, subtitle, onPress }: SettingsRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingRow,
        pressed && styles.rowPressed
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: iconColor + '12' }]}>
        <Feather name={icon as any} size={18} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textTertiary} />
    </Pressable>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background, // Premium Fintech light grey
  },
  scrollContent: {
    paddingBottom: 110, // Increased bottom padding to clear tab bar
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 24,
    padding: 20,
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.ownerAccent + '15', // Violet role tint
    borderWidth: 1,
    borderColor: Colors.ownerAccent + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.ownerAccent,
    fontSize: 20,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
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
    backgroundColor: Colors.ownerAccent,
    marginRight: 6,
  },
  profileRole: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 28,
    marginTop: 26,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupedCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 52,
    backgroundColor: Colors.surface,
  },
  rowPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8, // iOS Squircle style
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
    color: Colors.textPrimary,
  },
  settingSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 52,
    backgroundColor: Colors.surface,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginLeft: 62, // Padding left (14) + Icon width (32) + Icon margin (16)
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  appName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  appVersion: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: Colors.textTertiary,
    marginTop: 2,
  },
});
