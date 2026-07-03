// ============================================================================
// VEBOSSO EMS — Login Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { TextInput, Text, Snackbar } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { APP_NAME, APP_TAGLINE } from '../../constants/roles';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';

export default function LoginScreen() {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [snackError, setSnackError] = useState('');

  const { signIn, isLoading, clearError } = useAuthStore();

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
        showsVerticalScrollIndicator={false}
      >
        {/* Logo / Branding */}
        <Animated.View entering={FadeInDown.duration(800).delay(200)} style={styles.brandSection}>
          <Image
            source={require('../../../assets/images/vb_logo.png')}
            style={styles.logoImage}
          />
          <Text style={styles.appName}>{APP_NAME}</Text>
          <Text style={styles.tagline}>{APP_TAGLINE}</Text>
        </Animated.View>

        {/* Login Form Card */}
        <Animated.View entering={FadeInUp.duration(800).delay(400)} style={styles.formSection}>
          <Text style={styles.welcomeText}>Welcome back</Text>
          <Text style={styles.welcomeSubtext}>Sign in with your employee credentials</Text>

          <TextInput
            mode="outlined"
            label="Employee ID"
            placeholder="0002"
            value={employeeId}
            onChangeText={(text) => {
              // Strip VB- prefix if they manually typed or pasted it
              const cleaned = text.replace(/^VB-?/i, '');
              setEmployeeId(cleaned.toUpperCase());
              clearError();
            }}
            autoCapitalize="characters"
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Affix text="VB-" />}
            theme={{
              colors: {
                onSurfaceVariant: Colors.textTertiary,
                surface: Colors.systemGray6,
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
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
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
                onSurfaceVariant: Colors.textTertiary,
                surface: Colors.systemGray6,
              },
            }}
          />

          {/* Premium Black Pill Button */}
          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && styles.btnPressed,
              isLoading && styles.btnDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.white} size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.helpSection}>
            <Feather name="info" size={14} color={Colors.textTertiary} />
            <Text style={styles.helpText}>
              Don&apos;t have an account? Contact your admin.
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

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400, // Compact widescreen layout
    alignSelf: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 22,
    overflow: 'hidden',
    marginBottom: 16,
    ...Colors.shadow,
  },
  appName: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 30,
    color: Colors.textPrimary,
    letterSpacing: 4,
  },
  tagline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  formSection: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    ...Colors.shadow,
  },
  welcomeText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: Colors.systemGray6,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1,
  },
  loginBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 8,
    gap: 8,
  },
  loginBtnText: {
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
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    gap: 6,
  },
  helpText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  version: {
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    fontSize: 11,
    color: Colors.textTertiary,
  },
  snackbar: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
});
