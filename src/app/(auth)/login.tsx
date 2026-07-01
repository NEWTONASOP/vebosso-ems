// ============================================================================
// VEBOSSO EMS — Login Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { TextInput, Text, Snackbar } from 'react-native-paper';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../store/authStore';
import { Colors } from '../../constants/colors';
import { APP_NAME, APP_TAGLINE } from '../../constants/roles';
import { Feather } from '@expo/vector-icons';

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
          <View style={styles.logoContainer}>
            <Feather name="layers" size={32} color="#FFFFFF" />
          </View>
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
            placeholder="e.g. VB-0001"
            value={employeeId}
            onChangeText={(text) => {
              setEmployeeId(text.toUpperCase());
              clearError();
            }}
            autoCapitalize="characters"
            style={styles.input}
            outlineColor="#E5E7EB"
            activeOutlineColor="#000000"
            textColor="#1C1C1E"
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="badge-account" color="#8E8E93" />}
            theme={{
              colors: {
                onSurfaceVariant: '#AEAEB2',
                surface: '#F4F4F6',
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
            outlineColor="#E5E7EB"
            activeOutlineColor="#000000"
            textColor="#1C1C1E"
            outlineStyle={styles.inputOutline}
            left={<TextInput.Icon icon="lock-outline" color="#8E8E93" />}
            right={
              <TextInput.Icon
                icon={showPassword ? 'eye-off' : 'eye'}
                color="#8E8E93"
                onPress={() => setShowPassword(!showPassword)}
              />
            }
            theme={{
              colors: {
                onSurfaceVariant: '#AEAEB2',
                surface: '#F4F4F6',
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
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.loginBtnText}>Sign In</Text>
            )}
          </Pressable>

          <View style={styles.helpSection}>
            <Feather name="info" size={14} color="#AEAEB2" />
            <Text style={styles.helpText}>
              Don't have an account? Contact your admin.
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
        action={{ label: 'OK', textColor: '#000000' }}
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
    backgroundColor: '#EDEDED', // Premium Fintech light grey
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
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#000000', // Solid black squircle logo
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  appName: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 30,
    color: '#000000',
    letterSpacing: 4,
  },
  tagline: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    marginBottom: 20,
    elevation: 3,
  },
  welcomeText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: '#1C1C1E',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: '#F4F4F6', // System Gray 6
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
    backgroundColor: '#000000',
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 8,
    gap: 8,
  },
  loginBtnText: {
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
    color: '#AEAEB2',
    textAlign: 'center',
  },
  version: {
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
    fontSize: 11,
    color: '#AEAEB2',
  },
  snackbar: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
});
