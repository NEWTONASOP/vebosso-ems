// ============================================================================
// VEBOSSO EMS — InlineError Component
// ============================================================================
// Displays an inline error message with an optional Retry button.
// Use this inside screens when a data-fetch operation fails.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { Feather } from '@expo/vector-icons';

interface InlineErrorProps {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}

export function InlineError({ message, onRetry, compact = false }: InlineErrorProps) {
  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.iconRow}>
        <View style={styles.iconBg}>
          <Feather name="alert-circle" size={compact ? 18 : 22} color={Colors.error} />
        </View>
        <Text style={[styles.message, compact && styles.messageCompact]}>
          {message}
        </Text>
      </View>

      {onRetry && (
        <Button
          mode="outlined"
          onPress={onRetry}
          style={styles.retryBtn}
          contentStyle={styles.retryContent}
          textColor={Colors.accent}
          theme={{ colors: { outline: Colors.border } }}
          icon={() => <Feather name="refresh-cw" size={13} color={Colors.accent} />}
          compact
        >
          Retry
        </Button>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.errorLight,
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: Colors.error + '30',
    alignItems: 'center',
    gap: 12,
  },
  containerCompact: {
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.error + '18',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
    flex: 1,
  },
  messageCompact: {
    fontSize: 13,
  },
  retryBtn: {
    borderRadius: 10,
    alignSelf: 'stretch',
  },
  retryContent: {
    height: 36,
  },
});
