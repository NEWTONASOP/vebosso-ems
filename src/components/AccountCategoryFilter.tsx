// ============================================================================
// VEBOSSO EMS — Category filter for the books (076)
// A row of chips: All, then each category in use. Hidden when none is used.
// ============================================================================

import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';

export function AccountCategoryFilter({
  categories,
  value,
  onChange,
}: {
  categories: string[];
  /** null = all entries. */
  value: string | null;
  onChange: (category: string | null) => void;
}) {
  if (categories.length === 0) return null;
  const chips: (string | null)[] = [null, ...categories];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((c) => {
        const on = value === c;
        return (
          <Pressable
            key={c ?? '__all'}
            onPress={() => onChange(on && c !== null ? null : c)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
          >
            <Text style={[styles.text, on && styles.textOn]}>{c ?? 'All'}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 999, backgroundColor: T.card, justifyContent: 'center' },
  chipOn: { backgroundColor: T.charcoal },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  textOn: { color: T.white },
});
