// ============================================================================
// VEBOSSO EMS — Manager Settings Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Alert } from '../../lib/alert';

import { Colors } from '../../constants/colors';
import { APP_NAME, ROLE_LABELS } from '../../constants/roles';
import { useAuthStore } from '../../store/authStore';

export default function ManagerSettingsScreen() {
  const { profile, signOut } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
      </View>

      <View style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: Colors.managerAccent }]}> 
          <Text style={styles.avatarText}>{profile.full_name?.substring(0, 2).toUpperCase()}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{profile.full_name}</Text>
          <Text style={styles.profileMeta}>{ROLE_LABELS[profile.role]} • {profile.employee_id}</Text>
          {profile.department ? <Text style={styles.profileMeta}>{profile.department}</Text> : null}
        </View>
      </View>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.groupedCard}>
        <Pressable
          style={({ pressed }) => [styles.settingRow, pressed && styles.rowPressed]}
          onPress={handleSignOut}
        >
          <View style={[styles.iconContainer, { backgroundColor: Colors.errorLight }]}> 
            <Feather name="log-out" size={18} color={Colors.error} />
          </View>
          <View style={styles.settingInfo}>
            <Text style={styles.settingTitle}>Sign Out</Text>
            <Text style={styles.settingSubtitle}>Log out of your manager account</Text>
          </View>
        </Pressable>
      </View>

      <View style={styles.appInfo}>
        <Text style={styles.appName}>{APP_NAME} EMS</Text>
        <Text style={styles.appVersion}>v1.0.0</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 16,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.text,
    letterSpacing: -0.7,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
  },
  profileInfo: {
    marginLeft: 16,
    flex: 1,
  },
  profileName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: Colors.text,
  },
  profileMeta: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  sectionLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.text,
    marginTop: 28,
    marginBottom: 12,
  },
  groupedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    ...Colors.shadow,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  rowPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: Colors.text,
  },
  settingSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  appInfo: {
    marginTop: 40,
    alignItems: 'center',
  },
  appName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.textSecondary,
  },
  appVersion: {
    marginTop: 4,
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
