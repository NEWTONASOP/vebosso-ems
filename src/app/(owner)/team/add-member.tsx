// ============================================================================
// VEBOSSO EMS — Add Member Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text, TextInput } from 'react-native-paper';
import {
  AppRadius,
  AppSpace,
  AppTheme as T,
  screenChrome,
  appShadow,
  appSoftShadow,
} from '../../../constants/theme';
import { EMPLOYEE_ID_PREFIX } from '../../../constants/roles';
import { parseFunctionError } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import { useWorkStore } from '../../../store/workStore';

export default function AddMemberScreen() {
  const router = useRouter();
  const { teamMembers, fetchTeamMembers } = useWorkStore();

  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'manager' | 'member'>('member');
  const [managerId, setManagerId] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ employeeId: string; password: string } | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Auto-generate employee ID
  useEffect(() => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    // @ts-ignore
    // eslint-disable-next-line
    setEmployeeId(`${EMPLOYEE_ID_PREFIX}-${randomNum}`);
  }, [teamMembers]);

  // Generate random password
  useEffect(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // @ts-ignore
    // eslint-disable-next-line
    setPassword(pwd);
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const managers = teamMembers.filter((m) => m.role === 'manager');

  const handleCreate = async () => {
    if (!fullName.trim()) {
      setSnackMessage('Full name is required');
      return;
    }
    if (!employeeId.trim()) {
      setSnackMessage('Employee ID is required');
      return;
    }
    if (!password.trim() || password.length < 8) {
      setSnackMessage('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-member', {
        body: {
          full_name: fullName.trim(),
          employee_id: employeeId.trim(),
          role,
          department: department.trim() || null,
          manager_id: managerId || null,
          password,
        },
      });

      if (error) {
        setSnackMessage(parseFunctionError(error));
        setIsLoading(false);
        return;
      }

      if (data?.error) {
        setSnackMessage(data.error);
        setIsLoading(false);
        return;
      }

      setCreatedCredentials({
        employeeId: data.credentials.employee_id,
        password: data.credentials.password,
      });
      setSnackMessage('Member created successfully!');
      fetchTeamMembers();
    } catch (e: any) {
      setSnackMessage(e.message || 'Failed to create member. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdCredentials) return;
    const text = `VEBOSSO EMS Credentials\nEmployee ID: ${createdCredentials.employeeId}\nPassword: ${createdCredentials.password}`;
    await Clipboard.setStringAsync(text);
    setSnackMessage('Credentials copied to clipboard!');
  };

  if (createdCredentials) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.successContent} showsVerticalScrollIndicator={false}>
          <View style={styles.successCard}>
            <View style={styles.successIconWrap}>
              <Feather name="check" size={28} color={T.green} />
            </View>
            <Text style={styles.successTitle}>Member Created!</Text>
            <Text style={styles.successSubtitle}>
              Share these credentials with the new member
            </Text>

            <View style={styles.credentialBox}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Employee ID</Text>
                <Text style={styles.credValue}>{createdCredentials.employeeId}</Text>
              </View>
              <View style={styles.credRowDivider} />
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Temporary Password</Text>
                <Text style={styles.credValue}>{createdCredentials.password}</Text>
              </View>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.copyBtn,
                pressed && styles.btnPressed
              ]}
              onPress={handleCopyCredentials}
              accessibilityLabel="Copy Credentials"
            >
              <Feather name="copy" size={14} color={T.white} />
              <Text style={styles.copyBtnText}>Copy Credentials</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.addAnotherBtn,
                pressed && styles.btnPressed
              ]}
              onPress={() => {
                setCreatedCredentials(null);
                setFullName('');
                setDepartment('');
                setRole('member');
                setManagerId('');
                const randomNum = Math.floor(100000 + Math.random() * 900000);
                setEmployeeId(`${EMPLOYEE_ID_PREFIX}-${randomNum}`);
              }}
              accessibilityLabel="Add Another Member"
            >
              <Text style={styles.addAnotherBtnText}>Add Another Member</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.backTextBtn,
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => router.back()}
              accessibilityLabel="Back to Team"
            >
              <Text style={styles.backText}>Back to Team</Text>
            </Pressable>
          </View>
        </ScrollView>

        <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>{snackMessage}</Snackbar>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              screenChrome.iconButton,
              pressed && styles.btnPressed
            ]}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={18} color={T.charcoal} />
          </Pressable>
          <View style={styles.headerText}>
            <Text style={styles.title}>Add Member</Text>
            <Text style={screenChrome.sectionHint}>Create credentials and assign a role</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Profile</Text>

          <TextInput
            mode="outlined"
            label="Full Name *"
            value={fullName}
            onChangeText={setFullName}
            maxLength={100}
            style={styles.input}
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />

          <TextInput
            mode="outlined"
            label="Designation (e.g. Designer)"
            value={department}
            onChangeText={setDepartment}
            maxLength={100}
            style={styles.input}
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />

          <Text style={styles.fieldLabel}>Role</Text>
          <View style={screenChrome.segmentTrack}>
            <Pressable
              style={[screenChrome.segmentBtn, role === 'member' && screenChrome.segmentBtnActive]}
              onPress={() => setRole('member')}
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
              onPress={() => setRole('manager')}
              accessibilityRole="button"
              accessibilityState={{ selected: role === 'manager' }}
              accessibilityLabel="Manager"
            >
              <Text style={[screenChrome.segmentText, role === 'manager' && screenChrome.segmentTextActive]}>
                Manager
              </Text>
            </Pressable>
          </View>

          {role === 'member' && managers.length > 0 && (
            <View style={styles.managerSection}>
              <Text style={styles.fieldLabel}>Assign Manager (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.managerList}>
                {managers.map((mgr) => {
                  const isSelected = managerId === mgr.id;
                  return (
                    <Pressable
                      key={mgr.id}
                      style={[styles.managerChip, isSelected && styles.managerChipActive]}
                      onPress={() => setManagerId(isSelected ? '' : mgr.id)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={mgr.full_name}
                    >
                      <Text style={[styles.managerChipText, isSelected && styles.managerChipTextActive]}>
                        {mgr.full_name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          <Text style={[styles.sectionLabel, styles.sectionLabelSpaced]}>Credentials</Text>

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

          <TextInput
            mode="outlined"
            label="Temporary Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            outlineColor={T.soft}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
            secureTextEntry={!showPassword}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} color={T.mute} />}
          />

          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              pressed && styles.btnPressed,
              isLoading && styles.btnDisabled
            ]}
            onPress={handleCreate}
            disabled={isLoading}
            accessibilityLabel="Create Member"
          >
            {isLoading ? (
              <ActivityIndicator color={T.white} size="small" />
            ) : (
              <>
                <Feather name="user-plus" size={16} color={T.white} />
                <Text style={styles.createBtnText}>Create Member</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>{snackMessage}</Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scrollContent: {
    paddingBottom: 40,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpace.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: AppSpace.md,
    gap: AppSpace.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...screenChrome.title,
  },
  formSection: {
    backgroundColor: T.card,
    marginHorizontal: AppSpace.screen,
    borderRadius: 22,
    padding: AppSpace.xl,
    ...appSoftShadow,
    marginTop: AppSpace.md,
  },
  sectionLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.3,
    marginBottom: AppSpace.md,
  },
  sectionLabelSpaced: {
    marginTop: AppSpace.lg,
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
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
    marginBottom: AppSpace.sm,
    marginLeft: 2,
  },
  managerSection: {
    marginTop: AppSpace.md,
    marginBottom: AppSpace.md,
  },
  managerList: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  managerChip: {
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: AppRadius.pill,
    marginRight: AppSpace.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  managerChipActive: {
    backgroundColor: T.violetSoft,
  },
  managerChipText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.inkSoft,
  },
  managerChipTextActive: {
    fontFamily: 'Inter_600SemiBold',
    color: T.violet,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.charcoal,
    borderRadius: AppRadius.pill,
    width: '100%',
    height: 48,
    marginTop: AppSpace.sm,
    gap: AppSpace.sm,
    ...appSoftShadow,
  },
  createBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
    letterSpacing: -0.1,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  successContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: AppSpace.screen,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  successCard: {
    backgroundColor: T.card,
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    ...appShadow,
  },
  successIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: T.greenSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AppSpace.md,
  },
  successTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: T.ink,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    marginTop: 4,
    marginBottom: AppSpace.xl,
    textAlign: 'center',
  },
  credentialBox: {
    backgroundColor: T.soft,
    borderRadius: 16,
    padding: AppSpace.lg,
    width: '100%',
    marginBottom: AppSpace.xl,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  credRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.hairline,
    marginVertical: 10,
  },
  credLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: T.mute,
  },
  credValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: T.ink,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.charcoal,
    borderRadius: AppRadius.pill,
    width: '100%',
    height: 48,
    gap: AppSpace.sm,
    marginBottom: 10,
    ...appSoftShadow,
  },
  copyBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
    letterSpacing: -0.1,
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.soft,
    borderRadius: AppRadius.pill,
    width: '100%',
    height: 48,
    marginBottom: AppSpace.lg,
  },
  addAnotherBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.inkSoft,
  },
  backTextBtn: {
    paddingVertical: AppSpace.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  backText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
  },
});
