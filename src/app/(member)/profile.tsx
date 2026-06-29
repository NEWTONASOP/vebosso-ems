// ============================================================================
// VEBOSSO EMS — Member Profile Screen
// ============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, Avatar, Divider } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { ROLE_LABELS, APP_NAME } from '../../constants/roles';

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <Avatar.Text
          size={72}
          label={profile.full_name.substring(0, 2).toUpperCase()}
          style={styles.avatar}
          labelStyle={styles.avatarLabel}
        />
        <Text style={styles.name}>{profile.full_name}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleText}>{ROLE_LABELS[profile.role]}</Text>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <InfoRow emoji="🆔" label="Employee ID" value={profile.employee_id} />
        <Divider style={styles.divider} />
        <InfoRow emoji="🏢" label="Department" value={profile.department || 'Not assigned'} />
        <Divider style={styles.divider} />
        <InfoRow emoji="👤" label="Role" value={ROLE_LABELS[profile.role]} />
        <Divider style={styles.divider} />
        <InfoRow emoji="📅" label="Joined" value={new Date(profile.created_at).toLocaleDateString()} />
      </View>

      {/* Actions */}
      <View style={styles.actionsSection}>
        <Button
          mode="outlined"
          onPress={() => router.push('/(auth)/force-change-password')}
          style={styles.actionButton}
          textColor={Colors.accent}
          icon="lock-reset"
        >
          Change Password
        </Button>

        <Button
          mode="contained"
          onPress={handleSignOut}
          style={styles.signOutButton}
          buttonColor={Colors.error}
          textColor={Colors.white}
          icon="logout"
        >
          Sign Out
        </Button>
      </View>

      {/* App Info */}
      <View style={styles.appInfo}>
        <Text style={styles.appName}>{APP_NAME} EMS</Text>
        <Text style={styles.appVersion}>Version 1.0.0</Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <View style={infoStyles.row}>
      <Text style={infoStyles.emoji}>{emoji}</Text>
      <View style={infoStyles.info}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  emoji: { fontSize: 22, width: 32, textAlign: 'center' },
  info: { flex: 1 },
  label: { fontSize: 12, color: Colors.textSecondary },
  value: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  profileCard: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatar: { backgroundColor: Colors.accentSubtle, marginBottom: 14 },
  avatarLabel: { color: Colors.accent, fontSize: 24, fontWeight: '700' },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  roleBadge: {
    backgroundColor: Colors.accentSubtle,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 8,
  },
  roleText: { fontSize: 13, color: Colors.accent, fontWeight: '600' },
  infoSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  divider: { backgroundColor: Colors.divider },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
    gap: 12,
  },
  actionButton: { borderColor: Colors.accent, borderRadius: 12 },
  signOutButton: { borderRadius: 12 },
  appInfo: { alignItems: 'center', paddingVertical: 24 },
  appName: { fontSize: 14, fontWeight: '700', color: Colors.textTertiary },
  appVersion: { fontSize: 12, color: Colors.textTertiary, marginTop: 2 },
});
