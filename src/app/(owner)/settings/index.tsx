// ============================================================================
// VEBOSSO EMS — Owner Settings Screen (Tab)
// ============================================================================

import React from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Text, Divider, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';
import { Colors } from '../../../constants/colors';
import { APP_NAME } from '../../../constants/roles';

export default function OwnerSettingsScreen() {
  const router = useRouter();
  const { signOut, profile } = useAuthStore();
  const { settings, updateSetting } = useWorkStore();

  const requireCheckoutApproval = settings['require_checkout_approval'] === 'true';

  const handleToggleCheckout = async () => {
    try {
      await updateSetting('require_checkout_approval', requireCheckoutApproval ? 'false' : 'true');
    } catch (e) {
      console.error(e);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      {/* Profile Section */}
      <View style={styles.profileCard}>
        <View style={styles.profileAvatar}>
          <Text style={styles.avatarText}>
            {profile?.full_name?.substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View>
          <Text style={styles.profileName}>{profile?.full_name}</Text>
          <Text style={styles.profileRole}>Owner • {profile?.employee_id}</Text>
        </View>
      </View>

      {/* Team Management */}
      <Text style={styles.sectionLabel}>Team Management</Text>
      <View style={styles.section}>
        <SettingsRow
          emoji="➕"
          title="Add New Member"
          subtitle="Create employee accounts"
          onPress={() => router.push('/(owner)/settings/add-member')}
        />
        <Divider style={styles.divider} />
        <SettingsRow
          emoji="📢"
          title="Announcements"
          subtitle="Send announcements to team"
          onPress={() => router.push('/(owner)/settings/announcements')}
        />
        <Divider style={styles.divider} />
        <SettingsRow
          emoji="📱"
          title="Session Management"
          subtitle="View and manage active sessions"
          onPress={() => router.push('/(owner)/settings/session-management')}
        />
      </View>

      {/* App Settings */}
      <Text style={styles.sectionLabel}>App Settings</Text>
      <View style={styles.section}>
        <View style={styles.settingToggle}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Require Checkout Approval</Text>
            <Text style={styles.settingSubtitle}>
              Members need approval when ending their day
            </Text>
          </View>
          <Switch
            value={requireCheckoutApproval}
            onValueChange={handleToggleCheckout}
            color={Colors.accent}
          />
        </View>
      </View>

      {/* Account */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.section}>
        <SettingsRow
          emoji="🔑"
          title="Change Password"
          subtitle="Update your password"
          onPress={() => router.push('/(auth)/force-change-password')}
        />
        <Divider style={styles.divider} />
        <TouchableOpacity style={styles.settingRow} onPress={handleSignOut}>
          <Text style={styles.settingEmoji}>🚪</Text>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: Colors.error }]}>Sign Out</Text>
            <Text style={styles.settingSubtitle}>Log out of your account</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{APP_NAME} EMS</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function SettingsRow({
  emoji,
  title,
  subtitle,
  onPress,
}: {
  emoji: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={0.6}>
      <Text style={styles.settingEmoji}>{emoji}</Text>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  profileAvatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.accent, fontSize: 18, fontWeight: '700' },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.text },
  profileRole: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textTertiary,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  settingEmoji: { fontSize: 22, width: 32, textAlign: 'center' },
  settingInfo: { flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  settingSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 1 },
  chevron: { fontSize: 22, color: Colors.textTertiary },
  settingToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  divider: { backgroundColor: Colors.divider },
  appInfo: { alignItems: 'center', paddingVertical: 24 },
  appName: { fontSize: 14, fontWeight: '700', color: Colors.textTertiary },
  appVersion: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
});
