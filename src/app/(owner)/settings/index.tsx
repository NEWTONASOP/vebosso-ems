// ============================================================================
// VEBOSSO EMS — Owner Settings Screen (Premium Fintech Aesthetic)
// ============================================================================

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, Platform, Pressable } from 'react-native';
import { Alert } from '../../../lib/alert';
import { Switch, Text } from 'react-native-paper';

import { APP_NAME } from '../../../constants/roles';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';
import { Feather } from '@expo/vector-icons';

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
          icon="user-plus"
          iconColor="#007AFF"
          title="Add New Member"
          subtitle="Create employee accounts"
          onPress={() => router.push('/(owner)/settings/add-member')}
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="bell"
          iconColor="#FF9500"
          title="Announcements"
          subtitle="Send announcements to team"
          onPress={() => router.push('/(owner)/settings/announcements')}
        />
        <View style={styles.separator} />
        <SettingsRow
          icon="cpu"
          iconColor="#5856D6"
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
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(142, 142, 147, 0.12)' }]}>
            <Feather name="check-square" size={18} color="#8E8E93" />
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
            color="#000000" // Custom black switch to match fintech design
          />
        </View>
      </View>

      {/* Account Actions Group */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.groupedCard}>
        <SettingsRow
          icon="lock"
          iconColor="#FFCC00"
          title="Change Password"
          subtitle="Update your password"
          onPress={() => router.push('/(auth)/change-password')}
        />
        <View style={styles.separator} />
        <Pressable
          style={({ pressed }) => [
            styles.settingRow,
            pressed && styles.rowPressed
          ]}
          onPress={handleSignOut}
        >
          <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 59, 48, 0.12)' }]}>
            <Feather name="log-out" size={18} color="#FF3B30" />
          </View>
          <View style={styles.settingInfo}>
            <Text style={[styles.settingTitle, { color: '#FF3B30' }]}>Sign Out</Text>
            <Text style={styles.settingSubtitle}>Log out of your account</Text>
          </View>
          <Feather name="chevron-right" size={16} color="#C7C7CC" />
        </Pressable>
      </View>

      {/* App Info Footer */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{APP_NAME} EMS</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>
    </ScrollView>
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
      <Feather name="chevron-right" size={16} color="#C7C7CC" />
    </Pressable>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED', // Premium Fintech light grey
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
    color: '#1C1C1E',
    letterSpacing: -0.7,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    gap: 16,
    elevation: 3,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#8B5CF6' + '15', // Violet role tint
    borderWidth: 1,
    borderColor: '#8B5CF6' + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_800ExtraBold',
    color: '#8B5CF6',
    fontSize: 20,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: '#1C1C1E',
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
    backgroundColor: '#8B5CF6',
    marginRight: 6,
  },
  profileRole: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#8E8E93',
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#8E8E93',
    paddingHorizontal: 28,
    marginTop: 26,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
  },
  rowPressed: {
    backgroundColor: '#F2F2F7',
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
    color: '#1C1C1E',
  },
  settingSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    minHeight: 52,
    backgroundColor: '#FFFFFF',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginLeft: 62, // Padding left (14) + Icon width (32) + Icon margin (16)
  },
  appInfo: {
    alignItems: 'center',
    paddingVertical: 36,
  },
  appName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#AEAEB2',
  },
  appVersion: {
    fontFamily: 'Inter_500Medium',
    fontSize: 10,
    color: '#C7C7CC',
    marginTop: 2,
  },
});
