// ============================================================================
// VEBOSSO EMS — Voluntary Change Password Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, ProgressBar, Snackbar, Text, TextInput } from 'react-native-paper';
import {
  AppTheme,
  AppSpace,
  AppRadius,
  appShadow,
  screenChrome,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';

export default function ChangePasswordScreen() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [isChanging, setIsChanging] = useState(false);

  const { changePassword } = useAuthStore();
  const router = useRouter();

  const getPasswordStrength = (): { score: number; label: string; color: string } => {
    let score = 0;
    if (newPassword.length >= 8) score += 0.25;
    if (/[A-Z]/.test(newPassword)) score += 0.25;
    if (/[0-9]/.test(newPassword)) score += 0.25;
    if (/[^A-Za-z0-9]/.test(newPassword)) score += 0.25;

    if (score <= 0.25) return { score, label: 'Weak', color: AppTheme.coral };
    if (score <= 0.5) return { score, label: 'Fair', color: AppTheme.amber };
    if (score <= 0.75) return { score, label: 'Good', color: AppTheme.charcoal };
    return { score, label: 'Strong', color: AppTheme.green };
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

    setIsChanging(true);
    const result = await changePassword(newPassword);
    setIsChanging(false);

    if (result.success) {
      setSnackMessage('Password changed successfully! ✓');
      setTimeout(() => {
        router.back();
      }, 1500);
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
      {/* Back Button */}
      <View style={styles.headerRow}>
        <IconButton
          icon="arrow-left"
          size={24}
          iconColor={AppTheme.ink}
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityLabel="Go back"
        />
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Feather name="lock" size={28} color={AppTheme.charcoal} />
        </View>
        <Text style={styles.title}>Update Your Password</Text>
        <Text style={styles.subtitle}>
          Choose a strong password to keep your account secure
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
          outlineColor={AppTheme.soft2}
          activeOutlineColor={AppTheme.charcoal}
          textColor={AppTheme.ink}
          right={
            <TextInput.Icon
              icon={showPassword ? 'eye-off' : 'eye'}
              color={AppTheme.inkSoft}
              onPress={() => setShowPassword(!showPassword)}
            />
          }
          theme={{
            colors: {
              onSurfaceVariant: AppTheme.mute,
              surface: AppTheme.card,
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
          outlineColor={AppTheme.soft2}
          activeOutlineColor={AppTheme.charcoal}
          textColor={AppTheme.ink}
          theme={{
            colors: {
              onSurfaceVariant: AppTheme.mute,
              surface: AppTheme.card,
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
          loading={isChanging}
          disabled={isChanging || newPassword.length < 8 || newPassword !== confirmPassword}
          style={styles.button}
          contentStyle={styles.buttonContent}
          buttonColor={AppTheme.charcoal}
          textColor={AppTheme.white}
          labelStyle={styles.buttonLabel}
        >
          Update Password
        </Button>

        <Button
          mode="text"
          onPress={() => router.back()}
          disabled={isChanging}
          style={styles.cancelButton}
          textColor={AppTheme.mute}
        >
          Cancel
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
  icon: { fontSize: 14, color: AppTheme.mute, marginRight: 8, width: 16 },
  iconMet: { color: AppTheme.green },
  text: { fontSize: 13, color: AppTheme.mute, fontFamily: 'Inter_400Regular' },
  textMet: { color: AppTheme.green },
});

const styles = StyleSheet.create({
  container: { ...screenChrome.root },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: AppSpace.screen,
    paddingVertical: AppSpace.xl,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: AppSpace.xl,
    paddingTop: Platform.OS === 'ios' ? 20 : 10,
  },
  backButton: { margin: 0 },
  headerTitle: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    letterSpacing: -0.35,
  },
  header: { alignItems: 'center', marginBottom: 24 },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: AppSpace.md,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    color: AppTheme.ink,
    marginBottom: AppSpace.sm,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: AppSpace.lg,
  },
  formSection: {
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.card,
    padding: 24,
    ...appShadow,
  },
  input: { marginBottom: AppSpace.md, backgroundColor: AppTheme.card },
  strengthSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: AppSpace.md,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: AppTheme.soft2,
  },
  strengthLabel: { fontSize: 12, fontFamily: 'Inter_600SemiBold', width: 50 },
  mismatchText: {
    fontSize: 12,
    color: AppTheme.coral,
    marginBottom: AppSpace.sm,
    marginLeft: 4,
    fontFamily: 'Inter_400Regular',
  },
  requirements: {
    backgroundColor: AppTheme.soft,
    borderRadius: AppRadius.chip,
    padding: 14,
    marginBottom: AppSpace.xl,
  },
  reqTitle: {
    fontSize: 13,
    color: AppTheme.inkSoft,
    fontFamily: 'Inter_600SemiBold',
    marginBottom: AppSpace.sm,
  },
  button: { borderRadius: AppRadius.pill, marginBottom: AppSpace.sm },
  buttonContent: { height: 50 },
  buttonLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  cancelButton: { marginTop: 4 },
});
