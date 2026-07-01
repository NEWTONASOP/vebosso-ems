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
        return Colors.ownerAccent || '#8B5CF6';
      case 'manager':
        return Colors.managerAccent || '#3B82F6';
      default:
        return Colors.memberAccent || '#17B877';
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
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} activeOpacity={0.7}>
            <Feather name="bell" size={18} color="#1C1C1E" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Hero Code/Balance View */}
      <View style={styles.heroSection}>
        <Text style={styles.heroLabel}>EMPLOYEE CODE</Text>
        <Text style={styles.heroValue}>{profile.employee_id}</Text>
        
        {/* Capsule Badge */}
        <View style={styles.badgeContainer}>
          <View style={[styles.rolePill, { backgroundColor: '#000000' }]}>
            <Text style={styles.rolePillText}>{ROLE_LABELS[profile.role]}</Text>
            <Feather name="chevron-right" size={10} color="#FFFFFF" style={styles.roleChevron} />
          </View>
        </View>
      </View>

      {/* Card 1: Operations / Details */}
      <View style={styles.sectionContainer}>
        <Text style={styles.sectionTitle}>Details</Text>
        <View style={styles.groupedCard}>
          <InfoRow label="Status" value="Active" valueBadge badgeColor="#E6F4EA" badgeTextColor="#137333" />
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
        <Text style={styles.appVersion}>v1.0.0</Text>
      </View>
    </ScrollView>
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
          color={isDestructive ? '#FF3B30' : '#8E8E93'}
        />
      </View>
      {!isLast && <View style={rowStyles.separator} />}
    </Pressable>
  );
}



const rowStyles = StyleSheet.create({
  rowWrapper: {
    backgroundColor: '#FFFFFF',
  },
  pressed: {
    backgroundColor: '#F2F2F7',
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
    color: '#8E8E93', // Muted Gray
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: '#1C1C1E', // Dark Value
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
    color: '#FF3B30',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 16,
  },
});



const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED', // True Fintech Light Gray background
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
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
    color: '#FFFFFF',
    fontSize: 14,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#1C1C1E',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Hero section
  heroSection: {
    alignItems: 'center',
    paddingVertical: 28,
  },
  heroLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#8E8E93',
    letterSpacing: 1,
  },
  heroValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 42,
    color: '#000000',
    letterSpacing: -1,
    marginVertical: 4,
  },
  badgeContainer: {
    marginTop: 6,
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 4,
    borderRadius: 16,
  },
  rolePillText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    fontSize: 12,
  },
  roleChevron: {
    marginLeft: 4,
  },
  // Sections
  sectionContainer: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24, // High-end rounded corners
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },

  // Footer
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
