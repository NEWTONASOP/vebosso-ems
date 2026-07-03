// ============================================================================
// VEBOSSO EMS — Root Error Boundary Component
// ============================================================================
// Catches unhandled React render errors. Enhanced with:
//  - Retry counter (after 3 failed resets, tells user to restart the app)
//  - resetKeys prop (auto-resets when a key in the array changes)
//  - Structured error logging (easy to swap in Sentry later)

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * When any value in this array changes, the boundary automatically resets.
   * Useful to reset when navigation changes or a critical prop changes.
   */
  resetKeys?: unknown[];
  /** Optional callback fired when an error is caught. Useful for logging. */
  onError?: (error: Error, info: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  retryCount: number;
}

const MAX_RETRIES = 3;

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ errorInfo: info });

    // Structured error log — replace console.error with Sentry.captureException for production
    console.error('[ErrorBoundary] Caught unhandled error:', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });

    // Fire the optional onError callback (e.g. for analytics)
    this.props.onError?.(error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Auto-reset when any value in resetKeys changes
    const { resetKeys } = this.props;
    if (
      this.state.hasError &&
      resetKeys &&
      prevProps.resetKeys &&
      resetKeys.some((key, idx) => key !== prevProps.resetKeys![idx])
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isExhausted = this.state.retryCount >= MAX_RETRIES;

    return (
      <View style={styles.container}>
        <Text style={styles.emoji}>{isExhausted ? '💀' : '⚠️'}</Text>

        <Text style={styles.title}>
          {isExhausted ? 'Something went seriously wrong' : 'Something went wrong'}
        </Text>

        <Text style={styles.message}>
          {isExhausted
            ? 'The app has crashed multiple times. Please close and restart it.'
            : (this.state.error?.message || 'An unexpected error occurred.')}
        </Text>

        {!isExhausted && (
          <Button
            mode="contained"
            onPress={this.reset}
            style={styles.button}
            buttonColor={Colors.accent}
            textColor={Colors.white}
          >
            Try Again ({MAX_RETRIES - this.state.retryCount} attempts left)
          </Button>
        )}

        {/* Always show details in dev for debugging */}
        {__DEV__ && this.state.errorInfo && (
          <Text style={styles.devInfo} numberOfLines={8}>
            {this.state.error?.stack}
          </Text>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  message: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    borderRadius: 12,
    paddingHorizontal: 8,
  },
  devInfo: {
    marginTop: 24,
    fontFamily: 'Inter_400Regular',
    fontSize: 10,
    color: Colors.textTertiary,
    textAlign: 'left',
    alignSelf: 'stretch',
    backgroundColor: Colors.surfaceLight,
    padding: 8,
    borderRadius: 8,
  },
});
