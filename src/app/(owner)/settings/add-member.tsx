// ============================================================================
// VEBOSSO EMS — Add Member Screen (Premium Fintech Aesthetic)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Pressable, ActivityIndicator, KeyboardAvoidingView } from 'react-native';
import { TextInput, Text, Snackbar } from 'react-native-paper';
import { Colors } from '../../../constants/colors';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../../lib/supabase';
import { useWorkStore } from '../../../store/workStore';
import { EMPLOYEE_ID_PREFIX } from '../../../constants/roles';
import { Feather } from '@expo/vector-icons';

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
    const nextNum = (teamMembers.length + 2).toString().padStart(4, '0');
    // @ts-ignore
    // eslint-disable-next-line
    setEmployeeId(`${EMPLOYEE_ID_PREFIX}-${nextNum}`);
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
    if (!password.trim() || password.length < 6) {
      setSnackMessage('Password must be at least 6 characters');
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
        setSnackMessage(error.message || 'Failed to create member');
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
      setSnackMessage('Member created successfully! 🎉');
      fetchTeamMembers();
    } catch (e: any) {
      setSnackMessage(e.message || 'Failed to create member');
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
            <Text style={styles.successEmoji}>🎉</Text>
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
            >
              <Feather name="copy" size={14} color={Colors.white} />
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
                const nextNum = (teamMembers.length + 3).toString().padStart(4, '0');
                setEmployeeId(`${EMPLOYEE_ID_PREFIX}-${nextNum}`);
              }}
            >
              <Text style={styles.addAnotherBtnText}>Add Another Member</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.backTextBtn,
                pressed && { opacity: 0.7 }
              ]}
              onPress={() => router.back()}
            >
              <Text style={styles.backText}>Back to Settings</Text>
            </Pressable>
          </View>
        </ScrollView>

        <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>{snackMessage}</Snackbar>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Header with circular back chevron */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              pressed && styles.btnPressed
            ]}
            onPress={() => router.back()}
          >
            <Feather name="arrow-left" size={18} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.title}>Add Member</Text>
        </View>

        {/* Form Card */}
        <View style={styles.formSection}>
          <TextInput
            mode="outlined"
            label="Full Name *"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.textPrimary}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.systemGray6 } }}
          />

          <TextInput
            mode="outlined"
            label="Designation (e.g. Designer)"
            value={department}
            onChangeText={setDepartment}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.textPrimary}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.systemGray6 } }}
          />

          {/* Role Segment Selector */}
          <Text style={styles.fieldLabel}>Role</Text>
          <View style={styles.segmentedContainer}>
            <Pressable
              style={[styles.segmentBtn, role === 'member' && styles.segmentBtnActive]}
              onPress={() => setRole('member')}
            >
              <Text style={[styles.segmentText, role === 'member' && styles.segmentTextActive]}>Member</Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, role === 'manager' && styles.segmentBtnActive]}
              onPress={() => setRole('manager')}
            >
              <Text style={[styles.segmentText, role === 'manager' && styles.segmentTextActive]}>Manager</Text>
            </Pressable>
          </View>

          {/* Manager chips */}
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

          <TextInput
            mode="outlined"
            label="Employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.textPrimary}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.systemGray6 } }}
          />

          <TextInput
            mode="outlined"
            label="Temporary Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.textPrimary}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.systemGray6 } }}
            secureTextEntry={!showPassword}
            right={<TextInput.Icon icon={showPassword ? 'eye-off' : 'eye'} onPress={() => setShowPassword(!showPassword)} color={Colors.textSecondary} />}
          />

          {/* Action button */}
          <Pressable
            style={({ pressed }) => [
              styles.createBtn,
              pressed && styles.btnPressed,
              isLoading && styles.btnDisabled
            ]}
            onPress={handleCreate}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <>
                <Feather name="user-plus" size={16} color={Colors.white} />
                <Text style={styles.createBtnText}>Create Member</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>{snackMessage}</Snackbar>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background, // Premium Fintech light grey
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
    elevation: 1,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  formSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    marginTop: 14,
  },
  input: {
    marginBottom: 14,
    backgroundColor: Colors.systemGray6,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1,
  },
  fieldLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Custom segment control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.systemGray6,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
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
  // Manager section
  managerSection: {
    marginBottom: 16,
  },
  managerList: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  managerChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    ...Colors.shadow,
  },
  managerChipActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  managerChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: Colors.textSecondary,
  },
  managerChipTextActive: {
    color: Colors.white,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent, // Solid Black pill
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 8,
    gap: 8,
  },
  createBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.white,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  btnDisabled: {
    backgroundColor: Colors.surfaceLighter,
  },
  // Success content styles
  successContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  successTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  credentialBox: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.divider,
    marginBottom: 20,
  },
  credRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  credRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginVertical: 10,
  },
  credLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  credValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent, // Solid Black
    borderRadius: 24,
    width: '100%',
    height: 46,
    gap: 8,
    marginBottom: 10,
  },
  copyBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.white,
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfacePressed, // Muted Gray
    borderRadius: 24,
    width: '100%',
    height: 46,
    marginBottom: 16,
  },
  addAnotherBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  backTextBtn: {
    paddingVertical: 4,
  },
  backText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
    textDecorationLine: 'underline',
  },
});
