// ============================================================================
// VEBOSSO EMS — SentBackNotice Component
// ============================================================================
// When an owner or manager sends a CHECK-OUT back, the day returns to "working"
// so the person can submit another report. Without this notice that card looks
// like a normal working day and the person thinks the app un-ended their day.

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppRadius, AppTheme } from '../constants/theme';

export function SentBackNotice({ reason }: { reason: string }) {
  return (
    <View style={styles.box} accessibilityRole="alert">
      <View style={styles.header}>
        <Feather name="corner-up-left" size={15} color={AppTheme.amber} />
        <Text style={styles.title}>Your check-out was sent back</Text>
      </View>
      <Text style={styles.reason}>{reason}</Text>
      <Text style={styles.hint}>Update your report and tap End Day again.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: AppTheme.amberSoft,
    borderRadius: AppRadius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.amber,
  },
  reason: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: AppTheme.ink,
  },
  hint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: AppTheme.inkSoft,
  },
});
