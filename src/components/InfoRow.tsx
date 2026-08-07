import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme, AppRadius } from '../constants/theme';

interface InfoRowProps {
  label: string;
  value: string;
  isLast?: boolean;
  valueBadge?: boolean;
  badgeColor?: string;
  badgeTextColor?: string;
}

export function InfoRow({
  label,
  value,
  isLast,
  valueBadge,
  badgeColor,
  badgeTextColor,
}: InfoRowProps) {
  return (
    <View style={styles.rowWrapper}>
      <View style={styles.rowContent}>
        <Text style={styles.label}>{label}</Text>
        {valueBadge ? (
          <View style={[styles.badge, { backgroundColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeTextColor }]}>{value}</Text>
          </View>
        ) : (
          <Text style={styles.value}>{value}</Text>
        )}
      </View>
      {!isLast && <View style={styles.separator} />}
    </View>
  );
}

const styles = StyleSheet.create({
  rowWrapper: {
    backgroundColor: AppTheme.card,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 48,
    gap: 12,
  },
  label: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: AppTheme.mute,
    flexShrink: 0,
    maxWidth: '38%',
    paddingTop: 1,
  },
  value: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
    letterSpacing: -0.1,
    textAlign: 'right',
  },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: AppRadius.chip,
  },
  badgeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AppTheme.hairline,
    marginHorizontal: 16,
  },
});
