import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AppTheme, AppRadius, appSoftShadow } from '../constants/theme';
import { AnimatedPressable } from './AnimatedPressable';

const SLIM_WIDTH = 400;

interface QuickActionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

export function QuickActionCard({ icon, title, subtitle, onPress }: QuickActionCardProps) {
  const { width } = useWindowDimensions();
  const isSlim = width < SLIM_WIDTH;

  if (isSlim) {
    return (
      <AnimatedPressable style={styles.slimContainer} onPress={onPress} scaleTo={0.97}>
        <View style={styles.slimIconBg}>
          <Feather name={icon as any} size={16} color={AppTheme.blue} />
        </View>
        <Text style={styles.slimTitle} numberOfLines={2}>
          {title}
        </Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable style={styles.container} onPress={onPress} scaleTo={0.97}>
      <View style={styles.iconBg}>
        <Feather name={icon as any} size={18} color={AppTheme.blue} />
      </View>
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
    minHeight: 56,
    ...appSoftShadow,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AppTheme.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
    marginTop: 2,
  },
  slimContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.card,
    borderRadius: AppRadius.card,
    paddingVertical: 12,
    paddingHorizontal: 8,
    minHeight: 80,
    ...appSoftShadow,
  },
  slimIconBg: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: AppTheme.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  slimTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
    textAlign: 'center',
    lineHeight: 16,
    letterSpacing: -0.1,
  },
});
