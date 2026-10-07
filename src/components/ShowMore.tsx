// ============================================================================
// VEBOSSO EMS — Long lists, a page at a time
// Drawing hundreds of rows at once (a city full of venues, a year of bills or
// tasks) made screens slow to open. Lists draw the first PAGE rows and a
// "Show more" button below them adds more.
//
//   const page = usePaged(items);          // or usePaged(items, resetKey)
//   page.items.map(...)
//   <ShowMore page={page} />
// ============================================================================

import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';

export const PAGE = 30;

export interface Paged<T> {
  items: T[];
  left: number;
  more: () => void;
}

/** The first `size` items (more each "Show more"); starts over when `resetKey` changes, e.g. a filter or search. */
export function usePaged<T>(all: T[], resetKey?: unknown, size = PAGE): Paged<T> {
  const [count, setCount] = useState(size);
  useEffect(() => setCount(size), [resetKey, size]);
  return {
    items: all.length > count ? all.slice(0, count) : all,
    left: Math.max(0, all.length - count),
    more: () => setCount((c) => c + size * 2),
  };
}

export function ShowMore({ page, style }: { page: Pick<Paged<unknown>, 'left' | 'more'>; style?: StyleProp<ViewStyle> }) {
  if (page.left <= 0) return null;
  return (
    <Pressable
      onPress={page.more}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.7 }, style]}
      accessibilityRole="button"
      accessibilityLabel={`Show more, ${page.left} left`}
    >
      <Text style={styles.text}>Show more · {page.left} left</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 44,
    borderRadius: 999,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  text: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.ink },
});
