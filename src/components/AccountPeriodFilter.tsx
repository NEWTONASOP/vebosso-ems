// ============================================================================
// VEBOSSO EMS — Accounts period filter
// [ All time ]  [ ‹  September 2026  › ]
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { Period } from '../lib/accounts';

export function AccountPeriodFilter({
  period,
  onChange,
}: {
  period: Period;
  onChange: (p: Period) => void;
}) {
  const month = period ?? startOfMonth(new Date());
  const isAll = period === null;
  const atCurrent = isSameMonth(month, new Date());

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => onChange(null)}
        style={[styles.all, isAll && styles.active]}
        accessibilityRole="button"
        accessibilityState={{ selected: isAll }}
      >
        <Text style={[styles.allText, isAll && styles.activeText]}>All time</Text>
      </Pressable>

      <View style={[styles.month, !isAll && styles.active]}>
        <Pressable
          onPress={() => onChange(startOfMonth(addMonths(month, -1)))}
          hitSlop={8}
          style={styles.arrow}
          accessibilityLabel="Previous month"
        >
          <Feather name="chevron-left" size={18} color={isAll ? T.inkSoft : T.white} />
        </Pressable>
        <Pressable
          onPress={() => onChange(startOfMonth(month))}
          style={styles.monthLabelWrap}
          accessibilityRole="button"
          accessibilityState={{ selected: !isAll }}
        >
          <Text style={[styles.monthText, !isAll && styles.activeText]} numberOfLines={1}>
            {format(month, 'MMMM yyyy')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => !atCurrent && onChange(startOfMonth(addMonths(month, 1)))}
          hitSlop={8}
          style={[styles.arrow, atCurrent && { opacity: 0.3 }]}
          disabled={atCurrent}
          accessibilityLabel="Next month"
        >
          <Feather name="chevron-right" size={18} color={isAll ? T.inkSoft : T.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  all: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.card,
    justifyContent: 'center',
    ...appSoftShadow,
  },
  month: {
    flex: 1,
    height: 40,
    borderRadius: 999,
    backgroundColor: T.card,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    ...appSoftShadow,
  },
  active: {
    backgroundColor: T.charcoal,
  },
  arrow: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelWrap: {
    flex: 1,
    alignItems: 'center',
  },
  allText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    color: T.inkSoft,
  },
  monthText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.inkSoft,
  },
  activeText: {
    color: T.white,
  },
});
