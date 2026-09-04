// ============================================================================
// VEBOSSO EMS — Login Screen
// ============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { TextInput, Text, Snackbar } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { APP_TAGLINE } from '../../constants/roles';
import { Feather } from '@expo/vector-icons';
import {
  AppTheme,
  AppSpace,
  AppRadius,
  appShadow,
  screenChrome,
} from '../../constants/theme';
import Constants from 'expo-constants';

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
            source={require('../../../assets/images/vebosso-logo-mark.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
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
            outlineColor={AppTheme.soft2}
            activeOutlineColor={AppTheme.charcoal}
            textColor={AppTheme.ink}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Affix text="VB-" />}
            theme={{
              colors: {
                onSurfaceVariant: AppTheme.mute,
                surface: AppTheme.soft,
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
            outlineColor={AppTheme.soft2}
            activeOutlineColor={AppTheme.charcoal}
            textColor={AppTheme.ink}
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="lock-outline" color={AppTheme.inkSoft} />}
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
                surface: AppTheme.soft,
              },
            }}
          />

          <Pressable
            style={({ pressed }) => [
              styles.loginBtn,
              pressed && styles.btnPressed,
              isLoading && styles.btnDisabled,
            ]}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            {isLoading ? (
              <ActivityIndicator color={AppTheme.white} size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.helpSection}>
            <Feather name="info" size={14} color={AppTheme.mute} />
            <Text style={styles.helpText}>
              Don&apos;t have an account? Contact your admin.
            </Text>
          </View>
        </Animated.View>

        {/* App Version */}
        <Animated.View entering={FadeInUp.duration(800).delay(600)}>
          <Text style={styles.version}>v{Constants.expoConfig?.version || '1.0.0'}</Text>
        </Animated.View>
      </ScrollView>

      <Snackbar
        visible={!!snackError}
        onDismiss={() => setSnackError('')}
        duration={4000}
        style={styles.snackbar}
        action={{ label: 'OK', textColor: AppTheme.white }}
      >
        {snackError}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    ...screenChrome.root,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: AppSpace.screen,
    paddingVertical: 40,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: AppSpace.xxl,
  },
  logoImage: {
    width: 236,
    height: 236 / 2.768,
    marginBottom: AppSpace.md,
  },
  tagline: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginTop: 2,
  },
  formSection: {
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.card,
    padding: 24,
    marginBottom: AppSpace.xl,
    ...appShadow,
  },
  welcomeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: AppTheme.ink,
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: AppTheme.mute,
    marginBottom: 24,
  },
  input: {
    marginBottom: AppSpace.lg,
    backgroundColor: AppTheme.soft,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
  },
  loginBtn: {
    ...screenChrome.primaryPill,
    width: '100%',
    height: 48,
    marginTop: AppSpace.sm,
  },
  loginBtnText: {
    ...screenChrome.primaryPillText,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  btnDisabled: {
    backgroundColor: AppTheme.soft2,
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: AppSpace.xl,
    gap: 6,
  },
  helpText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: AppTheme.mute,
    textAlign: 'center',
  },
  version: {
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
    fontSize: 11,
    color: AppTheme.mute,
  },
  snackbar: {
    backgroundColor: AppTheme.coral,
  },
});
