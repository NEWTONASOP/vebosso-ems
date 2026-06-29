// ============================================================================
// VEBOSSO EMS — Login Screen
// ============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { TextInput, Button, Text, Snackbar } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { APP_NAME, APP_TAGLINE } from '../../constants/roles';

export default function LoginScreen() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [snackError, setSnackError] = useState('');

  const { signIn, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!employeeId.trim()) {
      setSnackError('Please enter your Employee ID');
      return;
    }
    if (!password.trim()) {
      setSnackError('Please enter your password');
      return;
    }

    const result = await signIn(employeeId.trim(), password);
    if (!result.success && result.error) {
      setSnackError(result.error);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / Branding */}
        <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🏢</Text>
          </View>
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </Animated.View>

        {/* Login Form */}
        <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.formSection}>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.welcomeSubtext}>Sign in with your employee credentials</Text>

          <TextInput
            mode="outlined"
            label="Employee ID"
            placeholder="e.g. VB-0023"
            value={employeeId}
            onChangeText={(text) => {
              setEmployeeId(text.toUpperCase());
              clearError();
            }}
            autoCapitalize="characters"
            style={styles.input}
            outlineColor={Colors.borderLight}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            left={<TextInput.Icon icon="badge-account" color={Colors.textSecondary} />}
            theme={{
              colors: {
                onSurfaceVariant: Colors.textSecondary,
                surface: Colors.inputBackground,
              },
            }}
          />

          <TextInput
            mode="outlined"
            label="Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              clearError();
            }}
            secureTextEntry={!showPassword}
            style={styles.input}
            outlineColor={Colors.borderLight}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            left={<TextInput.Icon icon="lock-outline" color={Colors.textSecondary} />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                color={Colors.textSecondary}
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            theme={{
              colors: {
                onSurfaceVariant: Colors.textSecondary,
                surface: Colors.inputBackground,
              },
            }}
          />

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={isLoading}
            disabled={isLoading}
            style={styles.loginButton}
            contentStyle={styles.loginButtonContent}
            buttonColor={Colors.accent}
            textColor={Colors.white}
            labelStyle={styles.loginButtonLabel}
          >
            Sign In
          </Button>

          <View style={styles.helpSection}>
            <Text style={styles.helpIcon}>ℹ️</Text>
            <Text style={styles.helpText}>
              Don't have an account? Contact your admin for access.
            </Text>
          </View>
        </Animated.View>

        {/* App Version */}
        <Animated.View entering={FadeInUp.duration(800).delay(600)}>
          <Text style={styles.version}>v1.0.0</Text>
        </Animated.View>
      </ScrollView>

      <Snackbar
        visible={!!snackError}
        onDismiss={() => setSnackError('')}
        duration={4000}
        style={styles.snackbar}
        action={{ label: 'OK', textColor: Colors.accent }}
      >
        {snackError}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: Colors.accentSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  logoIcon: {
    fontSize: 38,
  },
  appName: {
    fontSize: 32,
    fontWeight: '900',
    color: Colors.text,
    letterSpacing: 4,
  },
  tagline: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 1,
  },
  formSection: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: Colors.inputBackground,
  },
  loginButton: {
    marginTop: 8,
    borderRadius: 12,
  },
  loginButtonContent: {
    height: 52,
  },
  loginButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  helpIcon: {
    fontSize: 14,
  },
  helpText: {
    fontSize: 13,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  version: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  snackbar: {
    backgroundColor: Colors.surfaceLight,
  },
});
