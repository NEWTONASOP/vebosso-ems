import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Colors } from '../constants/colors';

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
    backgroundColor: Colors.surface,
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
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: Colors.textSecondary,
    flexShrink: 0,
    maxWidth: '38%',
    paddingTop: 1,
  },
  value: {
    flex: 1,
    flexShrink: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: -0.1,
    textAlign: 'right',
  },
  badge: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
  },
});
