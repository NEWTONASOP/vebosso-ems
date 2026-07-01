// ============================================================================
// VEBOSSO EMS — Add Member Screen (Premium Fintech Aesthetic)
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Platform, Pressable, ActivityIndicator } from 'react-native';
import { TextInput, Text, Snackbar } from 'react-native-paper';
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
              <Feather name="copy" size={14} color="#FFFFFF" />
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
    <View style={styles.container}>
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
            <Feather name="arrow-left" size={18} color="#1C1C1E" />
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
            outlineColor="#E5E7EB"
            activeOutlineColor="#000000"
            textColor="#1C1C1E"
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: '#AEAEB2', surface: '#F4F4F6' } }}
          />

          <TextInput
            mode="outlined"
            label="Designation (e.g. Designer)"
            value={department}
            onChangeText={setDepartment}
            style={styles.input}
            outlineColor="#E5E7EB"
            activeOutlineColor="#000000"
            textColor="#1C1C1E"
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: '#AEAEB2', surface: '#F4F4F6' } }}
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
            outlineColor="#E5E7EB"
            activeOutlineColor="#000000"
            textColor="#1C1C1E"
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: '#AEAEB2', surface: '#F4F4F6' } }}
          />

          <TextInput
            mode="outlined"
            label="Temporary Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            outlineColor="#E5E7EB"
            activeOutlineColor="#000000"
            textColor="#1C1C1E"
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: '#AEAEB2', surface: '#F4F4F6' } }}
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
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Feather name="user-plus" size={16} color="#FFFFFF" />
                <Text style={styles.createBtnText}>Create Member</Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>{snackMessage}</Snackbar>
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED', // Premium Fintech light grey
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
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
    marginTop: 14,
  },
  input: {
    marginBottom: 14,
    backgroundColor: '#F4F4F6', // System Gray 6
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1,
  },
  fieldLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  // Custom segment control
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: '#F4F4F6',
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
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: '#8E8E93',
  },
  segmentTextActive: {
    color: '#000000',
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
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    marginRight: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  managerChipActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  managerChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: '#8E8E93',
  },
  managerChipTextActive: {
    color: '#FFFFFF',
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000', // Solid Black pill
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 8,
    gap: 8,
  },
  createBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  btnDisabled: {
    backgroundColor: '#AEAEB2',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
  successEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  successTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  successSubtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 4,
    marginBottom: 20,
    textAlign: 'center',
  },
  credentialBox: {
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginVertical: 10,
  },
  credLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#8E8E93',
  },
  credValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#1C1C1E',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000', // Solid Black
    borderRadius: 24,
    width: '100%',
    height: 46,
    gap: 8,
    marginBottom: 10,
  },
  copyBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#FFFFFF',
  },
  addAnotherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F2F7', // Muted Gray
    borderRadius: 24,
    width: '100%',
    height: 46,
    marginBottom: 16,
  },
  addAnotherBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#55555A',
  },
  backTextBtn: {
    paddingVertical: 4,
  },
  backText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#8E8E93',
    textDecorationLine: 'underline',
  },
});
