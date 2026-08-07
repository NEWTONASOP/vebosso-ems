import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { AppTheme, appSoftShadow } from '../constants/theme';

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Icon source={icon} size={32} color={AppTheme.mute} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.actionBtn, pressed && styles.actionBtnPressed]}
        >
          <Text style={styles.actionBtnText}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 17,
    color: AppTheme.ink,
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: {
    marginTop: 22,
    backgroundColor: AppTheme.charcoal,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 12,
    ...appSoftShadow,
  },
  actionBtnPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
  actionBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: AppTheme.white,
  },
});
