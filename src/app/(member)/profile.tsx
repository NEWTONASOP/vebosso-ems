// ============================================================================
// VEBOSSO EMS — Member Profile Screen (Fintech / Neo-Brutalist Aesthetic)
// ============================================================================

import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View, TouchableOpacity, Platform, Pressable } from 'react-native';
import { Alert } from '../../lib/alert';
import { Text } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { APP_NAME, ROLE_LABELS } from '../../constants/roles';
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

  // Dynamically set accent color based on user role (Owner, Manager, Member)
  const getRoleAccent = () => {
    switch (profile.role) {
      case 'owner':
        return Colors.ownerAccent;
      case 'manager':
        return Colors.managerAccent;
      default:
        return Colors.memberAccent;
    }
  };

  const roleColor = getRoleAccent();

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
      {/* Header bar: Avatar left, Outline icons right */}
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

      {/* Hero Code/Balance View */}
      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>EMPLOYEE CODE</Text>
        <Text style={styles.heroValue}>{profile.employee_id}</Text>
        
        {/* Capsule Badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.rolePill, { backgroundColor: Colors.accent }]}>
            <Text style={styles.rolePillText}>{ROLE_LABELS[profile.role]}</Text>
          </View>
        </View>
      </View>

      {/* Card 1: Operations / Details */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.groupedCard}>
          <InfoRow label="Status" value="Active" valueBadge badgeColor={Colors.successLight} badgeTextColor={Colors.success} />
          <InfoRow label="Full Name" value={profile.full_name} />
          <InfoRow label="Designation" value={profile.department || 'Not assigned'} />
          <InfoRow label="Joined" value={getJoinedDate()} isLast />
        </View>
      </View>

      {/* Card 2: Security & Actions */}
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
      style={({ pressed }) => [
        rowStyles.rowWrapper,
        pressed && rowStyles.pressed
      ]}
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
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Hero section
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  rolePillText: {
    fontFamily: 'Inter_600SemiBold',
    color: Colors.white,
    fontSize: 12,
  },
  roleChevron: {
    marginLeft: 4,
  },
  // Sections
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

  // Footer
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
