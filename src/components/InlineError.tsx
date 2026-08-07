// ============================================================================
// VEBOSSO EMS — InlineError Component
// ============================================================================
// Displays an inline error message with an optional Retry button.
// Use this inside screens when a data-fetch operation fails.

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { AppTheme, AppRadius, AppSpace } from '../constants/theme';

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
          <Feather name="alert-circle" size={compact ? 18 : 22} color={AppTheme.coral} />
        </View>
        <Text style={[styles.message, compact && styles.messageCompact]}>
          {message}
        </Text>
      </View>

      {onRetry && (
        <Button
          mode="contained"
          onPress={onRetry}
          style={styles.retryBtn}
          contentStyle={styles.retryContent}
          buttonColor={AppTheme.charcoal}
          textColor={AppTheme.white}
          icon={() => <Feather name="refresh-cw" size={13} color={AppTheme.white} />}
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
    backgroundColor: AppTheme.coralSoft,
    borderRadius: AppRadius.card,
    padding: AppSpace.lg,
    marginVertical: AppSpace.sm,
    alignItems: 'center',
    gap: 12,
  },
  containerCompact: {
    padding: AppSpace.md,
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
    borderRadius: AppRadius.chip,
    backgroundColor: AppTheme.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  message: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.coral,
    lineHeight: 20,
    flex: 1,
  },
  messageCompact: {
    fontSize: 13,
  },
  retryBtn: {
    borderRadius: AppRadius.pill,
    alignSelf: 'stretch',
  },
  retryContent: {
    height: 44,
  },
});
