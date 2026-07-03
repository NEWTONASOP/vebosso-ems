// ============================================================================
// VEBOSSO EMS — Owner: Profile Management & Control Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert as RNAlert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Button, Divider, IconButton, Portal, Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { useWorkStore } from '../../../store/workStore';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../../lib/supabase';
import { parseSupabaseError, parseFunctionError } from '../../../lib/errors';
import { Colors } from '../../../constants/colors';
import { ROLE_LABELS } from '../../../constants/roles';
import { Profile } from '../../../types/database';
import { InlineError } from '../../../components/InlineError';
import { formatDistanceToNow } from 'date-fns';

interface SessionInfo {
  id: string;
  device_info: string | null;
  last_active: string;
  is_active: boolean;
}

export default function MemberProfileManagementScreen() {
  const router = useRouter();
  const { id: memberId } = useLocalSearchParams<{ id: string }>();
  const { profile: currentOwner } = useAuthStore();
  const { teamMembers, fetchTeamMembers } = useWorkStore();

  // Profile data state
  const [member, setMember] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [role, setRole] = useState<'manager' | 'member'>('member');
  const [managerId, setManagerId] = useState<string>('');

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  // Statuses
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOutSessions, setIsLoggingOutSessions] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [snackMessage, setSnackMessage] = useState('');

  // Manager dropdown picker visible
  const [showManagerPicker, setShowManagerPicker] = useState(false);

  const managers = teamMembers.filter((m) => m.role === 'manager' && m.id !== memberId);

  const loadMemberData = useCallback(async () => {
    if (!memberId) return;
    setIsLoading(true);
    setFetchError(null);

    try {
      // 1. Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', memberId)
        .single();

      if (profileError) throw profileError;

      const profile = profileData as Profile;
      setMember(profile);
      setFullName(profile.full_name);
      setDepartment(profile.department || '');
      setEmployeeId(profile.employee_id);
      setRole(profile.role === 'owner' ? 'member' : (profile.role as 'manager' | 'member'));
      setManagerId(profile.manager_id || '');
      setMustChangePassword(profile.must_change_password);

      // 2. Fetch active sessions
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('id, device_info, last_active, is_active')
        .eq('user_id', memberId)
        .eq('is_active', true)
        .order('last_active', { ascending: false });

      if (sessionError) throw sessionError;
      setSessions((sessionData || []) as SessionInfo[]);
    } catch (err) {
      setFetchError(parseSupabaseError(err));
    } finally {
      setIsLoading(false);
    }
  }, [memberId]);

  useEffect(() => {
    loadMemberData();
    fetchTeamMembers();
  }, [loadMemberData, fetchTeamMembers]);

  const handleSaveProfile = async () => {
    if (!memberId || !member) return;
    if (!fullName.trim()) {
      setSnackMessage('Full Name is required');
      return;
    }
    if (!employeeId.trim()) {
      setSnackMessage('Employee ID is required');
      return;
    }

    setIsSaving(true);
    try {
      const updates = {
        full_name: fullName.trim(),
        department: department.trim() || null,
        employee_id: employeeId.trim(),
        role: role,
        manager_id: role === 'member' && managerId ? managerId : null,
        must_change_password: mustChangePassword,
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates as any)
        .eq('id', memberId);

      if (error) throw error;

      setSnackMessage('Profile updated successfully! ✓');
      await fetchTeamMembers();
      loadMemberData();
    } catch (err) {
      setSnackMessage(parseSupabaseError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!memberId) return;
    if (!newPassword.trim() || newPassword.length < 6) {
      setSnackMessage('Password must be at least 6 characters');
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-update-member', {
        body: {
          action: 'update-password',
          user_id: memberId,
          password: newPassword.trim(),
        },
      });

      if (error) {
        setSnackMessage(parseFunctionError(error));
        return;
      }

      if (data?.error) {
        setSnackMessage(data.error);
        return;
      }

      setSnackMessage('Password updated successfully! 🔐');
      setNewPassword('');
    } catch (err: any) {
      setSnackMessage(err.message || 'Failed to update password');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleToggleActive = async (newValue: boolean) => {
    if (!memberId) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: newValue } as any)
        .eq('id', memberId);

      if (error) throw error;

      // Force logout all sessions if deactivating
      if (!newValue) {
        await supabase.functions.invoke('force-logout', {
          body: { user_id: memberId },
        });
      }

      setSnackMessage(newValue ? 'Account activated! ✓' : 'Account deactivated & sessions terminated.');
      loadMemberData();
    } catch (err) {
      setSnackMessage(parseSupabaseError(err));
    }
  };

  const handleForceLogoutSession = async (sessionId: string) => {
    if (!memberId) return;
    setIsLoggingOutSessions(sessionId);
    try {
      const { error } = await supabase.functions.invoke('force-logout', {
        body: { user_id: memberId, session_id: sessionId },
      });

      if (error) throw error;

      setSnackMessage('Session terminated successfully.');
      loadMemberData();
    } catch (err) {
      setSnackMessage('Failed to logout session');
    } finally {
      setIsLoggingOutSessions(null);
    }
  };

  const handleDeleteMember = () => {
    if (!member) return;
    RNAlert.alert(
      'PERMANENT DELETE',
      `Are you absolutely sure you want to permanently delete ${member.full_name}?\n\nThis will completely delete their account and CASCADE delete all their check-in logs, completed tasks, and historical records. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const { data, error } = await supabase.functions.invoke('admin-update-member', {
                body: {
                  action: 'delete-member',
                  user_id: memberId,
                },
              });

              if (error) {
                setSnackMessage(parseFunctionError(error));
                setIsDeleting(false);
                return;
              }

              if (data?.error) {
                setSnackMessage(data.error);
                setIsDeleting(false);
                return;
              }

              RNAlert.alert('Deleted', 'Member has been deleted successfully.', [
                {
                  text: 'OK',
                  onPress: () => {
                    router.back();
                    fetchTeamMembers();
                  },
                },
              ]);
            } catch (err: any) {
              setSnackMessage(err.message || 'Failed to delete member');
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const getSelectedManagerName = () => {
    const mgr = managers.find((m) => m.id === managerId);
    return mgr ? mgr.full_name : 'No manager assigned';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>Loading profile controls...</Text>
      </View>
    );
  }

  if (fetchError || !member) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <IconButton icon="arrow-left" iconColor={Colors.text} size={24} onPress={() => router.back()} />
          <Text style={styles.headerTitle}>Error</Text>
        </View>
        <View style={{ padding: 20 }}>
          <InlineError message={fetchError || 'Profile not found'} onRetry={loadMemberData} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor={Colors.text} size={24} onPress={() => router.back()} style={styles.backBtn} />
        <Text style={styles.headerTitle}>Manage Profile</Text>
        <View style={{ width: 48 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Top Profile Summary Card */}
        <View style={styles.heroCard}>
          <View style={[styles.avatar, { backgroundColor: member.role === 'manager' ? Colors.managerAccent : Colors.memberAccent }]}>
            <Text style={styles.avatarText}>{member.full_name.substring(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{member.full_name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: Colors.accent }]}>
                <Text style={styles.badgeText}>{ROLE_LABELS[member.role]}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: member.is_active ? Colors.successLight : Colors.errorLight }]}>
                <Text style={[styles.badgeText, { color: member.is_active ? Colors.success : Colors.error }]}>
                  {member.is_active ? 'Active' : 'Deactivated'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Profile Editor Section */}
        <Text style={styles.sectionLabel}>Profile Details</Text>
        <View style={styles.card}>
          <TextInput
            mode="outlined"
            label="Full Name"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { surface: Colors.surface } }}
          />

          <TextInput
            mode="outlined"
            label="Designation / Department"
            value={department}
            onChangeText={setDepartment}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { surface: Colors.surface } }}
          />

          <TextInput
            mode="outlined"
            label="Employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { surface: Colors.surface } }}
          />

          {/* Role Segment */}
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.segmentedContainer}>
            <Pressable
              style={[styles.segmentBtn, role === 'member' && styles.segmentBtnActive]}
              onPress={() => {
                setRole('member');
                setShowManagerPicker(false);
              }}
            >
              <Text style={[styles.segmentText, role === 'member' && styles.segmentTextActive]}>Member</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, role === 'manager' && styles.segmentBtnActive]}
              onPress={() => {
                setRole('manager');
                setManagerId('');
                setShowManagerPicker(false);
              }}
            >
              <Text style={[styles.segmentText, role === 'manager' && styles.segmentTextActive]}>Manager</Text>
            </Pressable>
          </View>

          {/* Assigned Manager Dropdown (only visible for member role) */}
          {role === 'member' && (
            <View style={{ marginBottom: 16 }}>
              <Text style={styles.fieldLabel}>Assigned Manager</Text>
              <Pressable
                style={styles.dropdownBtn}
                onPress={() => setShowManagerPicker(!showManagerPicker)}
              >
                <Text style={styles.dropdownBtnText}>{getSelectedManagerName()}</Text>
                <Feather name={showManagerPicker ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textSecondary} />
              </Pressable>

              {showManagerPicker && (
                <View style={styles.dropdownMenu}>
                  <Pressable
                    style={[styles.dropdownItem, managerId === '' && styles.dropdownItemActive]}
                    onPress={() => {
                      setManagerId('');
                      setShowManagerPicker(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, managerId === '' && styles.dropdownItemTextActive]}>
                      No Manager (Unassigned)
                    </Text>
                  </Pressable>
                  {managers.map((mgr) => (
                    <Pressable
                      key={mgr.id}
                      style={[styles.dropdownItem, managerId === mgr.id && styles.dropdownItemActive]}
                      onPress={() => {
                        setManagerId(mgr.id);
                        setShowManagerPicker(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, managerId === mgr.id && styles.dropdownItemTextActive]}>
                        {mgr.full_name} ({mgr.employee_id})
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          <Button
            mode="contained"
            onPress={handleSaveProfile}
            loading={isSaving}
            disabled={isSaving}
            style={styles.saveBtn}
            buttonColor={Colors.accent}
            textColor={Colors.white}
          >
            Save Profile Details
          </Button>
        </View>

        {/* Security / Password section */}
        <Text style={styles.sectionLabel}>Security & Password</Text>
        <View style={styles.card}>
          <TextInput
            mode="outlined"
            label="Set New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showPassword}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { surface: Colors.surface } }}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
                color={Colors.textSecondary}
              />
            }
          />

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleLabel}>Force Password Change</Text>
              <Text style={styles.toggleSubtitle}>Require password update on next sign-in</Text>
            </View>
            <Switch
              value={mustChangePassword}
              onValueChange={setMustChangePassword}
              color={Colors.accent}
            />
          </View>

          <Button
            mode="contained"
            onPress={handleUpdatePassword}
            loading={isUpdatingPassword}
            disabled={isUpdatingPassword || !newPassword.trim()}
            style={styles.saveBtn}
            buttonColor={Colors.accent}
            textColor={Colors.white}
          >
            Update Password
          </Button>
        </View>

        {/* Active Sessions */}
        <Text style={styles.sectionLabel}>Active Sessions ({sessions.length})</Text>
        <View style={styles.card}>
          {sessions.length > 0 ? (
            sessions.map((session, index) => (
              <View key={session.id}>
                <View style={styles.sessionRow}>
                  <View style={styles.sessionInfo}>
                    <Text style={styles.sessionDevice}>{session.device_info || 'Unknown device'}</Text>
                    <Text style={styles.sessionTime}>
                      Active {formatDistanceToNow(new Date(session.last_active), { addSuffix: true })}
                    </Text>
                  </View>
                  <Button
                    mode="outlined"
                    compact
                    onPress={() => handleForceLogoutSession(session.id)}
                    loading={isLoggingOutSessions === session.id}
                    disabled={isLoggingOutSessions !== null}
                    textColor={Colors.error}
                    style={styles.sessionLogoutBtn}
                  >
                    Logout
                  </Button>
                </View>
                {index < sessions.length - 1 && <Divider style={styles.divider} />}
              </View>
            ))
          ) : (
            <Text style={styles.noSessionsText}>No active sessions</Text>
          )}
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, { color: Colors.error }]}>Danger Zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.toggleLabel, { color: Colors.error }]}>Account Deactivated</Text>
              <Text style={styles.toggleSubtitle}>Deactivating immediately logs user out & prevents login</Text>
            </View>
            <Switch
              value={!member.is_active}
              onValueChange={(deactivate) => handleToggleActive(!deactivate)}
              color={Colors.error}
            />
          </View>

          <Divider style={[styles.divider, { marginVertical: 16 }]} />

          <Button
            mode="contained"
            onPress={handleDeleteMember}
            loading={isDeleting}
            disabled={isDeleting}
            style={styles.deleteBtn}
            buttonColor={Colors.error}
            textColor={Colors.white}
            icon="trash-can-outline"
          >
            Delete Member Account
          </Button>
        </View>
      </ScrollView>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snackMessage}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  backBtn: {
    margin: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 50,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.white,
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
  },
  heroInfo: {
    marginLeft: 16,
    flex: 1,
  },
  heroName: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
  },
  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 26,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  dangerCard: {
    borderColor: Colors.error + '40',
  },
  input: {
    marginBottom: 14,
    backgroundColor: Colors.surface,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 6,
    marginLeft: 2,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.systemGray6,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  segmentBtn: {
    flex: 1,
    height: 36,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.surface,
    ...Colors.shadow,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.accent,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    height: 48,
  },
  dropdownBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.text,
  },
  dropdownMenu: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    marginTop: 6,
    overflow: 'hidden',
    ...Colors.shadowHeavy,
  },
  dropdownItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dropdownItemActive: {
    backgroundColor: Colors.accentSubtle,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.text,
  },
  dropdownItemTextActive: {
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  saveBtn: {
    borderRadius: 12,
    marginTop: 6,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  toggleSubtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  sessionInfo: {
    flex: 1,
    paddingRight: 10,
  },
  sessionDevice: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  sessionTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  sessionLogoutBtn: {
    borderColor: Colors.border,
    borderRadius: 8,
  },
  noSessionsText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: 12,
  },
  deleteBtn: {
    borderRadius: 12,
  },
  divider: {
    backgroundColor: Colors.border,
  },
});
