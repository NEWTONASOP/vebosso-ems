// ============================================================================
// VEBOSSO EMS — Owner: Profile Management & Control Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    Alert as RNAlert,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { Snackbar, Switch, Text, TextInput } from 'react-native-paper';
import { InlineError } from '../../../components/InlineError';
import {
  AppRadius,
  AppSpace,
  AppTheme as T,
  screenChrome,
  appShadow,
  appSoftShadow,
} from '../../../constants/theme';
import { ROLE_LABELS } from '../../../constants/roles';
import { parseFunctionError, parseSupabaseError } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';
import { Profile } from '../../../types/database';

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

  // Expo Router reuses member/[id] when switching members — reset action UI state
  useEffect(() => {
    setIsDeleting(false);
    setIsSaving(false);
    setIsUpdatingPassword(false);
    setIsLoggingOutSessions(null);
    setSnackMessage('');
    setNewPassword('');
    setShowPassword(false);
    setShowManagerPicker(false);
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
    if (!newPassword.trim() || newPassword.length < 8) {
      setSnackMessage('Password must be at least 8 characters');
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

      setSnackMessage('Password updated successfully!');
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
    if (__DEV__) console.log('[Delete] Button pressed, member:', member?.id, 'isDeleting:', isDeleting);
    if (!member) {
      setSnackMessage('Error: No member loaded');
      return;
    }

    const confirmed = Platform.OS === 'web'
      ? window.confirm(`Permanently delete ${member.full_name}?\n\nThis will delete their account, check-in logs, tasks, and all related records. This cannot be undone.`)
      : true; // on native, we show the Alert below instead

    if (Platform.OS === 'web') {
      if (!confirmed) return;
      performDelete();
      return;
    }

    RNAlert.alert(
      'PERMANENT DELETE',
      `Are you absolutely sure you want to permanently delete ${member.full_name}?\n\nThis will completely delete their account and CASCADE delete all their check-in logs, completed tasks, and historical records. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: performDelete,
        },
      ]
    );
  };

  const performDelete = async () => {
    setIsDeleting(true);
    setSnackMessage('Deleting member...');
    try {
      if (__DEV__) console.log('[Delete] Invoking edge function for user_id:', memberId);
      const { data, error } = await supabase.functions.invoke('admin-update-member', {
        body: {
          action: 'delete-member',
          user_id: memberId,
        },
      });

      if (__DEV__) console.log('[Delete] Response — data:', JSON.stringify(data), 'error:', JSON.stringify(error));

      if (error) {
        const msg = parseFunctionError(error);
        if (__DEV__) console.error('[Delete] Function invoke error:', error);
        setSnackMessage('Delete failed: ' + msg);
        return;
      }

      if (data?.error) {
        if (__DEV__) console.error('[Delete] Function returned error:', data.error);
        setSnackMessage('Delete failed: ' + data.error);
        return;
      }

      // Success — go back and refresh team
      await fetchTeamMembers();
      router.back();
    } catch (err: any) {
      if (__DEV__) console.error('[Delete] Unexpected error:', err);
      setSnackMessage('Delete failed: ' + (err?.message || 'Unknown error'));
    } finally {
      // Always clear so a reused member/[id] screen is not stuck loading
      setIsDeleting(false);
    }
  };
  const getSelectedManagerName = () => {
    const mgr = managers.find((m) => m.id === managerId);
    return mgr ? mgr.full_name : 'No manager assigned';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={T.charcoal} />
        <Text style={styles.loadingText}>Loading profile controls...</Text>
      </View>
    );
  }

  if (fetchError || !member) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={screenChrome.iconButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={18} color={T.charcoal} />
          </Pressable>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorPad}>
          <InlineError message={fetchError || 'Profile not found'} onRetry={loadMemberData} />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable
          style={screenChrome.iconButton}
          onPress={() => router.back()}
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={18} color={T.charcoal} />
        </Pressable>
        <Text style={styles.headerTitle}>Manage Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Top Profile Summary Card */}
        <View style={styles.heroCard}>
          <View style={[styles.avatar, { backgroundColor: member.role === 'manager' ? T.violetSoft : T.blueSoft }]}>
            <Text style={[styles.avatarText, { color: member.role === 'manager' ? T.violet : T.blue }]}>
              {member.full_name.substring(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>{member.full_name}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: member.role === 'manager' ? T.violetSoft : T.blueSoft }]}>
                <Text style={[styles.badgeText, { color: member.role === 'manager' ? T.violet : T.blue }]}>
                  {ROLE_LABELS[member.role]}
                </Text>
              </View>
              <View style={[styles.badge, { backgroundColor: member.is_active ? T.greenSoft : T.coralSoft }]}>
                <Text style={[styles.badgeText, { color: member.is_active ? T.green : T.coral }]}>
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
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />

          <TextInput
            mode="outlined"
            label="Designation / Department"
            value={department}
            onChangeText={setDepartment}
            style={styles.input}
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />

          <TextInput
            mode="outlined"
            label="Employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            style={styles.input}
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />

          {/* Role Segment */}
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={[screenChrome.segmentTrack, styles.segmentSpacing]}>
            <Pressable
              style={[screenChrome.segmentBtn, role === 'member' && screenChrome.segmentBtnActive]}
              onPress={() => {
                setRole('member');
                setShowManagerPicker(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: role === 'member' }}
              accessibilityLabel="Member"
            >
              <Text style={[screenChrome.segmentText, role === 'member' && screenChrome.segmentTextActive]}>
                Member
              </Text>
            </Pressable>
            <Pressable
              style={[screenChrome.segmentBtn, role === 'manager' && screenChrome.segmentBtnActive]}
              onPress={() => {
                setRole('manager');
                setManagerId('');
                setShowManagerPicker(false);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: role === 'manager' }}
              accessibilityLabel="Manager"
            >
              <Text style={[screenChrome.segmentText, role === 'manager' && screenChrome.segmentTextActive]}>
                Manager
              </Text>
            </Pressable>
          </View>

          {/* Assigned Manager Dropdown (only visible for member role) */}
          {role === 'member' && (
            <View style={styles.managerBlock}>
              <Text style={styles.fieldLabel}>Assigned Manager</Text>
              <Pressable
                style={styles.dropdownBtn}
                onPress={() => setShowManagerPicker(!showManagerPicker)}
                accessibilityLabel="Assigned Manager"
              >
                <Text style={styles.dropdownBtnText}>{getSelectedManagerName()}</Text>
                <Feather name={showManagerPicker ? 'chevron-up' : 'chevron-down'} size={18} color={T.mute} />
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

          <Pressable
            style={({ pressed }) => [
              styles.primaryBtn,
              pressed && styles.btnPressed,
              isSaving && styles.btnDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={isSaving}
            accessibilityLabel="Save Profile Details"
          >
            {isSaving ? (
              <ActivityIndicator color={T.white} size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Save Profile Details</Text>
            )}
          </Pressable>
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
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                onPress={() => setShowPassword(!showPassword)}
                color={T.mute}
              />
            }
          />

          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Force Password Change</Text>
              <Text style={styles.toggleSubtitle}>Require password update on next sign-in</Text>
            </View>
            <Switch
              value={mustChangePassword}
              onValueChange={setMustChangePassword}
              color={T.charcoal}
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.secondaryBtn,
              pressed && styles.btnPressed,
              (isUpdatingPassword || !newPassword.trim()) && styles.btnDisabled,
            ]}
            onPress={handleUpdatePassword}
            disabled={isUpdatingPassword || !newPassword.trim()}
            accessibilityLabel="Update Password"
          >
            {isUpdatingPassword ? (
              <ActivityIndicator color={T.ink} size="small" />
            ) : (
              <Text style={styles.secondaryBtnText}>Update Password</Text>
            )}
          </Pressable>
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
                  <Pressable
                    style={({ pressed }) => [
                      styles.sessionLogoutBtn,
                      pressed && styles.btnPressed,
                      isLoggingOutSessions !== null && styles.btnDisabled,
                    ]}
                    onPress={() => handleForceLogoutSession(session.id)}
                    disabled={isLoggingOutSessions !== null}
                    accessibilityLabel="Logout session"
                  >
                    {isLoggingOutSessions === session.id ? (
                      <ActivityIndicator color={T.coral} size="small" />
                    ) : (
                      <Text style={styles.sessionLogoutText}>Logout</Text>
                    )}
                  </Pressable>
                </View>
                {index < sessions.length - 1 && <View style={styles.divider} />}
              </View>
            ))
          ) : (
            <Text style={styles.noSessionsText}>No active sessions</Text>
          )}
        </View>

        {/* Danger Zone */}
        <Text style={[styles.sectionLabel, styles.dangerLabel]}>Danger Zone</Text>
        <View style={[styles.card, styles.dangerCard]}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleLabel, styles.dangerLabel]}>Account Deactivated</Text>
              <Text style={styles.toggleSubtitle}>Deactivating immediately logs user out & prevents login</Text>
            </View>
            <Switch
              value={!member.is_active}
              onValueChange={(deactivate) => handleToggleActive(!deactivate)}
              color={T.coral}
            />
          </View>

          <View style={[styles.divider, styles.dangerDivider]} />

          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              pressed && styles.btnPressed,
              isDeleting && styles.btnDisabled,
            ]}
            onPress={handleDeleteMember}
            disabled={isDeleting}
            accessibilityLabel="Delete Member Account"
          >
            {isDeleting ? (
              <ActivityIndicator color={T.white} size="small" />
            ) : (
              <>
                <Feather name="trash-2" size={15} color={T.white} />
                <Text style={styles.deleteBtnText}>Delete Member Account</Text>
              </>
            )}
          </Pressable>
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
    backgroundColor: T.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.bg,
    gap: AppSpace.md,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: T.mute,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: AppSpace.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: AppSpace.md,
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: T.ink,
    letterSpacing: -0.4,
  },
  errorPad: {
    padding: AppSpace.screen,
  },
  scrollContent: {
    paddingHorizontal: AppSpace.screen,
    paddingBottom: 120,
  },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: 22,
    padding: AppSpace.xl,
    marginTop: AppSpace.md,
    ...appShadow,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    letterSpacing: -0.4,
  },
  heroInfo: {
    marginLeft: AppSpace.lg,
    flex: 1,
  },
  heroName: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: T.ink,
    letterSpacing: -0.3,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: AppSpace.sm,
    marginTop: 6,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: AppRadius.chip,
  },
  badgeText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
  },
  sectionLabel: {
    fontSize: 17,
    fontFamily: 'Inter_600SemiBold',
    color: T.ink,
    letterSpacing: -0.3,
    marginTop: 24,
    marginBottom: 10,
  },
  dangerLabel: {
    color: T.coral,
  },
  card: {
    backgroundColor: T.card,
    borderRadius: 22,
    padding: AppSpace.lg,
    ...appSoftShadow,
  },
  dangerCard: {
    backgroundColor: T.card,
  },
  input: {
    marginBottom: 14,
    backgroundColor: T.soft,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: T.mute,
    marginBottom: AppSpace.sm,
    marginLeft: 2,
  },
  segmentSpacing: {
    marginBottom: AppSpace.lg,
  },
  managerBlock: {
    marginBottom: AppSpace.lg,
  },
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.soft,
    borderRadius: 14,
    paddingHorizontal: AppSpace.lg,
    minHeight: 48,
  },
  dropdownBtnText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.ink,
  },
  dropdownMenu: {
    backgroundColor: T.card,
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    ...appSoftShadow,
  },
  dropdownItem: {
    paddingVertical: 14,
    paddingHorizontal: AppSpace.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  dropdownItemActive: {
    backgroundColor: T.violetSoft,
  },
  dropdownItemText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: T.ink,
  },
  dropdownItemTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: T.violet,
  },
  primaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.charcoal,
    borderRadius: AppRadius.pill,
    height: 48,
    marginTop: 6,
    ...appSoftShadow,
  },
  primaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
    letterSpacing: -0.1,
  },
  secondaryBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.soft,
    borderRadius: AppRadius.pill,
    height: 48,
    marginTop: 6,
  },
  secondaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
    letterSpacing: -0.1,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: AppSpace.lg,
    minHeight: 44,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: AppSpace.md,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: T.ink,
    letterSpacing: -0.2,
  },
  toggleSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T.mute,
    marginTop: 2,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: AppSpace.md,
    minHeight: 56,
  },
  sessionInfo: {
    flex: 1,
    paddingRight: 10,
  },
  sessionDevice: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: T.ink,
    letterSpacing: -0.2,
  },
  sessionTime: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T.mute,
    marginTop: 2,
  },
  sessionLogoutBtn: {
    backgroundColor: T.coralSoft,
    borderRadius: AppRadius.pill,
    paddingHorizontal: 14,
    minHeight: 44,
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionLogoutText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.coral,
  },
  noSessionsText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: T.mute,
    textAlign: 'center',
    paddingVertical: AppSpace.md,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.coral,
    borderRadius: AppRadius.pill,
    height: 48,
    gap: AppSpace.sm,
  },
  deleteBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
    letterSpacing: -0.1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.hairline,
  },
  dangerDivider: {
    marginVertical: AppSpace.lg,
  },
});
