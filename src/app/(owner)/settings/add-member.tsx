// ============================================================================
// VEBOSSO EMS — Add Member Screen
// ============================================================================

import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, SegmentedButtons, Snackbar, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';
import { Colors } from '../../../constants/colors';
import { EMPLOYEE_ID_PREFIX } from '../../../constants/roles';
import { Profile } from '../../../types/database';

export default function AddMemberScreen() {
  const router = useRouter();
  const { profile: ownerProfile } = useAuthStore();
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
    setEmployeeId(`${EMPLOYEE_ID_PREFIX}-${nextNum}`);
  }, [teamMembers]);

  // Generate random password
  useEffect(() => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pwd);
  }, []);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

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
        <ScrollView contentContainerStyle={styles.successContent}>
          <View style={styles.successCard}>
            <Text style={styles.successEmoji}>✅</Text>
            <Text style={styles.successTitle}>Member Created!</Text>
            <Text style={styles.successSubtitle}>
              Share these credentials with the new member
            </Text>

            <View style={styles.credentialBox}>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Employee ID</Text>
                <Text style={styles.credValue}>{createdCredentials.employeeId}</Text>
              </View>
              <View style={styles.credRow}>
                <Text style={styles.credLabel}>Password</Text>
                <Text style={styles.credValue}>{createdCredentials.password}</Text>
              </View>
            </View>

            <Button
              mode="contained"
              onPress={handleCopyCredentials}
              style={styles.copyButton}
              buttonColor={Colors.accent}
              textColor={Colors.white}
              icon="content-copy"
            >
              Copy Credentials
            </Button>

            <Button
              mode="outlined"
              onPress={() => {
                setCreatedCredentials(null);
                setFullName('');
                setDepartment('');
                setRole('member');
                setManagerId('');
                const nextNum = (teamMembers.length + 3).toString().padStart(4, '0');
                setEmployeeId(`${EMPLOYEE_ID_PREFIX}-${nextNum}`);
              }}
              style={styles.addAnotherButton}
              textColor={Colors.textSecondary}
            >
              Add Another Member
            </Button>

            <Button
              mode="text"
              onPress={() => router.back()}
              textColor={Colors.textTertiary}
            >
              Back to Settings
            </Button>
          </View>
        </ScrollView>

        <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>
          {snackMessage}
        </Snackbar>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            iconColor={Colors.text}
            size={24}
            onPress={() => router.back()}
          />
          <Text style={styles.title}>Add New Member</Text>
        </View>

        <View style={styles.formSection}>
          <TextInput
            mode="outlined"
            label="Full Name *"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.inputBackground } }}
          />

          <TextInput
            mode="outlined"
            label="Designation"
            value={department}
            onChangeText={setDepartment}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.inputBackground } }}
          />

          <Text style={styles.fieldLabel}>Role</Text>
          <SegmentedButtons
            value={role}
            onValueChange={(v) => setRole(v as 'manager' | 'member')}
            buttons={[
              { value: 'member', label: 'Member', style: styles.segmentButton },
              { value: 'manager', label: 'Manager', style: styles.segmentButton },
            ]}
            style={styles.segmented}
          />

          {role === 'member' && managers.length > 0 && (
            <>
              <Text style={styles.fieldLabel}>Assign Manager (Optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.managerList}>
                {managers.map((mgr) => (
                  <Button
                    key={mgr.id}
                    mode={managerId === mgr.id ? 'contained' : 'outlined'}
                    onPress={() => setManagerId(managerId === mgr.id ? '' : mgr.id)}
                    style={styles.managerChip}
                    compact
                    buttonColor={managerId === mgr.id ? Colors.accent : undefined}
                    textColor={managerId === mgr.id ? Colors.white : Colors.textSecondary}
                  >
                    {mgr.full_name}
                  </Button>
                ))}
              </ScrollView>
            </>
          )}

          <TextInput
            mode="outlined"
            label="Employee ID"
            value={employeeId}
            onChangeText={setEmployeeId}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.inputBackground } }}
          />

          <TextInput
            mode="outlined"
            label="Temporary Password"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.inputBackground } }}
          />

          <Button
            mode="contained"
            onPress={handleCreate}
            loading={isLoading}
            disabled={isLoading}
            style={styles.createButton}
            contentStyle={styles.createButtonContent}
            buttonColor={Colors.accent}
            textColor={Colors.white}
            icon="account-plus"
          >
            Create Member
          </Button>
        </View>
      </ScrollView>

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 8,
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  formSection: {
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  input: { marginBottom: 14, backgroundColor: Colors.inputBackground },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
    marginTop: 4,
  },
  segmented: { marginBottom: 14 },
  segmentButton: { borderColor: Colors.border },
  managerList: { marginBottom: 14 },
  managerChip: { marginRight: 8, borderColor: Colors.border, borderRadius: 8 },
  createButton: { borderRadius: 12, marginTop: 8 },
  createButtonContent: { height: 50 },
  successContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 },
  successCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  successEmoji: { fontSize: 56, marginBottom: 12 },
  successTitle: { fontSize: 24, fontWeight: '800', color: Colors.text },
  successSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, marginBottom: 20 },
  credentialBox: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    gap: 10,
    marginBottom: 20,
  },
  credRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  credLabel: { fontSize: 13, color: Colors.textSecondary },
  credValue: { fontSize: 16, fontWeight: '700', color: Colors.accent },
  copyButton: { borderRadius: 12, width: '100%', marginBottom: 12 },
  addAnotherButton: { borderColor: Colors.border, borderRadius: 12, width: '100%', marginBottom: 8 },
});
