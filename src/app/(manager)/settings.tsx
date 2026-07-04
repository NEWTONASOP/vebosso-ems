// ============================================================================
// VEBOSSO EMS — Manager Profile Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { PageTransition } from '../../components/PageTransition';
import { Colors } from '../../constants/colors';
import { APP_NAME, ROLE_LABELS } from '../../constants/roles';
import { Alert } from '../../lib/alert';
import { useAuthStore } from '../../store/authStore';

export default function ManagerSettingsScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (!profile) return null;

  const roleColor = Colors.managerAccent;

  const getJoinedDate = () => {
    try {
      return format(new Date(profile.created_at), 'MMM d, yyyy');
    } catch {
      return new Date(profile.created_at).toLocaleDateString();
    }
  };

  return (
    <PageTransition>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.miniAvatar, { backgroundColor: roleColor }]}>
              <Text style={styles.miniAvatarText}>
                {profile.full_name.substring(0, 1).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>EMPLOYEE CODE</Text>
          <Text style={styles.heroValue}>{profile.employee_id}</Text>
          <View style={styles.badgeContainer}>
            <View style={[styles.rolePill, { backgroundColor: roleColor }]}>
              <Text style={styles.rolePillText}>{ROLE_LABELS[profile.role]}</Text>
            </View>
          </View>
        </View>

        {/* Details Card */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Details</Text>
          <View style={styles.groupedCard}>
            <InfoRow label="Status" value="Active" valueBadge badgeColor={Colors.successLight} badgeTextColor={Colors.success} />
            <InfoRow label="Full Name" value={profile.full_name} />
            <InfoRow label="Designation" value={profile.department || 'Not assigned'} />
            <InfoRow label="Joined" value={getJoinedDate()} isLast />
          </View>
        </View>

        {/* Security & Settings Card */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Security & Settings</Text>
          <View style={styles.groupedCard}>
            <ActionRow
              label="Change Password"
              icon="key"
              onPress={() => router.push('/(auth)/change-password')}
            />
            <ActionRow
              label="Sign Out"
              icon="log-out"
              onPress={handleSignOut}
              isDestructive
              isLast
            />
          </View>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME} EMS</Text>
          <Text style={styles.appVersion}>Version {Constants.expoConfig?.version || '1.0.0'}</Text>
        </View>
      </ScrollView>
    </PageTransition>
  );
}

// ============================================================================
// Row Components
// ============================================================================

interface InfoRowProps {
  label: string;
  value: string;
  isLast?: boolean;
  valueBadge?: boolean;
  badgeColor?: string;
  badgeTextColor?: string;
}

function InfoRow({ label, value, isLast, valueBadge, badgeColor, badgeTextColor }: InfoRowProps) {
  return (
    <View style={rowStyles.rowWrapper}>
      <View style={rowStyles.rowContent}>
        <Text style={rowStyles.label}>{label}</Text>
        {valueBadge ? (
          <View style={[rowStyles.badge, { backgroundColor: badgeColor }]}>
            <Text style={[rowStyles.badgeText, { color: badgeTextColor }]}>{value}</Text>
          </View>
        ) : (
          <Text style={rowStyles.value}>{value}</Text>
        )}
      </View>
      {!isLast && <View style={rowStyles.separator} />}
    </View>
  );
}

interface ActionRowProps {
  label: string;
  icon: string;
  onPress: () => void;
  isDestructive?: boolean;
  isLast?: boolean;
}

function ActionRow({ label, icon, onPress, isDestructive, isLast }: ActionRowProps) {
  return (
    <Pressable
      style={({ pressed }) => [rowStyles.rowWrapper, pressed && rowStyles.pressed]}
      onPress={onPress}
    >
      <View style={rowStyles.rowContent}>
        <Text style={[rowStyles.label, isDestructive && rowStyles.destructiveText]}>
          {label}
        </Text>
        <Feather
          name={icon as any}
          size={16}
          color={isDestructive ? Colors.error : Colors.textSecondary}
        />
      </View>
      {!isLast && <View style={rowStyles.separator} />}
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  rowWrapper: {
    backgroundColor: Colors.surface,
  },
  pressed: {
    backgroundColor: Colors.surfacePressed,
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
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  destructiveText: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.error,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
  },
  headerLeft: {
    width: 40,
    alignItems: 'flex-start',
  },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    fontFamily: 'Inter_700Bold',
    color: Colors.white,
    fontSize: 14,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colors.textPrimary,
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  heroLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textSecondary,
    letterSpacing: 1,
  },
  heroValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 42,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginVertical: 4,
  },
  badgeContainer: {
    marginTop: 6,
  },
  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  rolePillText: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.white,
    fontSize: 12,
  },
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  groupedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
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
