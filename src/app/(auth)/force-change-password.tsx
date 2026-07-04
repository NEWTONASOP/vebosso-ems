// ============================================================================
// VEBOSSO EMS — Force Change Password Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, ProgressBar, Snackbar, Text, TextInput } from 'react-native-paper';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';

export default function ForceChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const { changePassword, isLoading, profile } = useAuthStore();
  const router = useRouter();

  const getPasswordStrength = (): { score: number; label: string; color: string } => {
    let score = 0;
    if (newPassword.length >= 8) score += 0.25;
    if (/[A-Z]/.test(newPassword)) score += 0.25;
    if (/[0-9]/.test(newPassword)) score += 0.25;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 0.25;

    if (score <= 0.25) return { score, label: 'Weak', color: Colors.error };
    if (score <= 0.5) return { score, label: 'Fair', color: Colors.warning };
    if (score <= 0.75) return { score, label: 'Good', color: Colors.accent };
    return { score, label: 'Strong', color: Colors.success };
  };

  const strength = getPasswordStrength();

  const handleChange = async () => {
    if (newPassword.length < 8) {
      setSnackMessage('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSnackMessage('Passwords do not match');
      return;
    }
    if (strength.score < 0.5) {
      setSnackMessage('Please choose a stronger password');
      return;
    }

    const result = await changePassword(newPassword);
    if (result.success) {
      // Navigate to role-specific screen
      switch (profile?.role) {
        case 'owner':
          router.replace('/(owner)/dashboard');
          break;
        case 'manager':
          router.replace('/(manager)/dashboard');
          break;
        case 'member':
          router.replace('/(member)/home');
          break;
      }
    } else {
      setSnackMessage(result.error || 'Failed to change password');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={28} color={Colors.accent} />
        </View>
        <Text style={styles.title}>Change Your Password</Text>
        <Text style={styles.subtitle}>
          Your admin has set a temporary password. Please create a new secure password to continue.
        </Text>
      </View>

      <View style={styles.formSection}>
        <TextInput
          mode="outlined"
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry={!showPassword}
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.accent}
          textColor={Colors.text}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              color={Colors.textSecondary}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
          theme={{
            colors: {
              onSurfaceVariant: Colors.textTertiary,
              surface: Colors.inputBackground,
            },
          }}
        />

        {newPassword.length > 0 && (
          <View style={styles.strengthSection}>
            <ProgressBar
              progress={strength.score}
              color={strength.color}
              style={styles.strengthBar}
            />
            <Text style={[styles.strengthLabel, { color: strength.color }]}>
              {strength.label}
            </Text>
          </View>
        )}

        <TextInput
          mode="outlined"
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={!showPassword}
          style={styles.input}
          outlineColor={Colors.border}
          activeOutlineColor={Colors.accent}
          textColor={Colors.text}
          theme={{
            colors: {
              onSurfaceVariant: Colors.textTertiary,
              surface: Colors.inputBackground,
            },
          }}
        />

        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <Text style={styles.mismatchText}>Passwords do not match</Text>
        )}

        <View style={styles.requirements}>
          <Text style={styles.reqTitle}>Password requirements:</Text>
          <Requirement met={newPassword.length >= 8} text="At least 8 characters" />
          <Requirement met={/[A-Z]/.test(newPassword)} text="At least one uppercase letter" />
          <Requirement met={/[0-9]/.test(newPassword)} text="At least one number" />
          <Requirement met={/[^A-Za-z0-9]/.test(newPassword)} text="At least one special character" />
        </View>

        <Button
          mode="contained"
          onPress={handleChange}
          loading={isLoading}
          disabled={isLoading || newPassword.length < 8 || newPassword !== confirmPassword}
          style={styles.button}
          contentStyle={styles.buttonContent}
          buttonColor={Colors.accent}
          textColor={Colors.white}
        >
          Set New Password
        </Button>
      </View>

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={4000}
       
      >
        {snackMessage}
      </Snackbar>
    </ScrollView>
  );
}

function Requirement({ met, text }: { met: boolean; text: string }) {
  return (
    <View style={reqStyles.row}>
      <Text style={[reqStyles.icon, met && reqStyles.iconMet]}>
        {met ? '✓' : '○'}
      </Text>
      <Text style={[reqStyles.text, met && reqStyles.textMet]}>{text}</Text>
    </View>
  );
}

const reqStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  icon: { fontSize: 14, color: Colors.textTertiary, marginRight: 8, width: 16 },
  iconMet: { color: Colors.success },
  text: { fontSize: 13, color: Colors.textTertiary },
  textMet: { color: Colors.success },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, marginBottom: 8, letterSpacing: -0.7 },
  subtitle: { fontSize: 14, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: 16 },
  formSection: { backgroundColor: Colors.surface, borderRadius: 20, padding: 24, borderWidth: 1, borderColor: Colors.border, ...Colors.shadow },
  input: { marginBottom: 12, backgroundColor: Colors.inputBackground },
  strengthSection: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.surfaceLighter },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', width: 50 },
  mismatchText: { fontSize: 12, color: Colors.error, marginBottom: 8, marginLeft: 4 },
  requirements: { backgroundColor: Colors.surfaceLight, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: Colors.border },
  reqTitle: { fontSize: 13, color: Colors.textSecondary, fontFamily: 'Inter_600SemiBold', marginBottom: 8 },
  button: { borderRadius: 12 },
  buttonContent: { height: 50 },
});
