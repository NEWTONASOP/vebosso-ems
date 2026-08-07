// ============================================================================
// VEBOSSO EMS — Member Profile Screen
// ============================================================================

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { Alert } from '../../lib/alert';
import { Text } from 'react-native-paper';
import { APP_NAME, ROLE_LABELS } from '../../constants/roles';
import {
  AppTheme as T,
  AppSpace,
  AppRadius,
  appSoftShadow,
  screenChrome,
  RoleAccent,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import Constants from 'expo-constants';

import { InfoRow } from '../../components/InfoRow';
import { PageTransition } from '../../components/PageTransition';

export default function MemberProfileScreen() {
  const router = useRouter();
  const { profile, signOut } = useAuthStore();

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
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.miniAvatar, { backgroundColor: roleAccent.soft }]}>
              <Text style={[styles.miniAvatarText, { color: roleAccent.color }]}>
                {profile.full_name.substring(0, 1).toUpperCase()}
              </Text>
            </View>
          </View>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerRight} />
        </View>

        <View style={styles.heroSection}>
          <Text style={styles.heroLabel}>Employee code</Text>
          <Text style={styles.heroValue}>{profile.employee_id}</Text>
          <View style={[styles.rolePill, { backgroundColor: roleAccent.soft }]}>
            <Text style={[styles.rolePillText, { color: roleAccent.color }]}>
              {ROLE_LABELS[profile.role]}
            </Text>
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
          <Text style={styles.sectionTitle}>Security & Settings</Text>
          <View style={styles.groupedCard}>
            <ActionRow
              label="Change Password"
              icon="key"
              onPress={() => router.push('/(auth)/change-password')}
            />
            <ActionRow
              label="Leave Requests"
              icon="calendar"
              onPress={() => router.push('/(member)/leaves')}
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

        <View style={styles.appInfo}>
          <Text style={styles.appName}>{APP_NAME} EMS</Text>
          <Text style={styles.appVersion}>
            Version {Constants.expoConfig?.version || '1.0.0'}
          </Text>
        </View>
      </ScrollView>
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
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.hairline,
    marginHorizontal: 16,
  },
});

const styles = StyleSheet.create({
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
    paddingHorizontal: AppSpace.screen,
    paddingTop: screenChrome.header.paddingTop,
    paddingBottom: 12,
  },
  headerLeft: {
    width: 44,
    alignItems: 'flex-start',
  },
  miniAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniAvatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
  },
  headerRight: {
    width: 44,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  heroLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.mute,
    letterSpacing: -0.1,
  },
  heroValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 40,
    color: T.ink,
    letterSpacing: -0.9,
    marginVertical: 4,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 28,
    borderRadius: AppRadius.pill,
    marginTop: 6,
  },
  rolePillText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
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
