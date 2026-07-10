import { Feather } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Colors } from '../constants/colors';
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
      <AnimatedPressable style={styles.slimContainer} onPress={onPress}>
        <View style={styles.slimIconBg}>
          <Feather name={icon as any} size={16} color={Colors.accent} />
        </View>
        <Text style={styles.slimTitle} numberOfLines={2}>
          {title}
        </Text>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable style={styles.container} onPress={onPress}>
      <View style={styles.iconBg}>
        <Feather name={icon as any} size={18} color={Colors.accent} />
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
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.accent + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  subtitle: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    marginTop: 1,
  },
  slimContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    minHeight: 72,
    ...Colors.shadow,
  },
  slimIconBg: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: Colors.accent + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  slimTitle: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 15,
  },
});
