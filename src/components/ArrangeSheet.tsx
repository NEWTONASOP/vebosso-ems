// ============================================================================
// VEBOSSO EMS — Arrange sheet
// Put a short list in your own order with ↑ ↓, then Save. Reset goes back to
// the usual order. Used for the owner's bottom bar and department people.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { ReactNode, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { SheetFrame } from './SheetFrame';

export interface ArrangeItem {
  key: string;
  label: string;
  icon?: ReactNode;
}

export function ArrangeSheet({
  visible,
  title,
  subtitle,
  items,
  onSave,
  onReset,
  onDismiss,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** In the order shown now. */
  items: ArrangeItem[];
  onSave: (keys: string[]) => void;
  /** Back to the usual order. */
  onReset: () => void;
  onDismiss: () => void;
}) {
  const [list, setList] = useState(items);
  useEffect(() => {
    if (visible) setList(items);
    // Only when it opens: the list being arranged must not jump underneath.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const move = (i: number, by: -1 | 1) =>
    setList((prev) => {
      const j = i + by;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  return (
    <SheetFrame
      visible={visible}
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      icon="move"
      footer={
        <View style={styles.footer}>
          <Pressable
            style={styles.reset}
            onPress={() => {
              onReset();
              onDismiss();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
          <Pressable
            style={styles.save}
            onPress={() => {
              onSave(list.map((x) => x.key));
              onDismiss();
            }}
            accessibilityRole="button"
          >
            <Text style={styles.saveText}>Save</Text>
          </Pressable>
        </View>
      }
    >
      {list.map((item, i) => (
        <View key={item.key} style={styles.row}>
          <Text style={styles.pos}>{i + 1}</Text>
          {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
          <Text style={styles.label} numberOfLines={1}>
            {item.label}
          </Text>
          <Pressable
            style={[styles.arrow, i === 0 && styles.off]}
            onPress={() => move(i, -1)}
            disabled={i === 0}
            hitSlop={4}
            accessibilityLabel={`Move ${item.label} up`}
          >
            <Feather name="arrow-up" size={17} color={T.ink} />
          </Pressable>
          <Pressable
            style={[styles.arrow, i === list.length - 1 && styles.off]}
            onPress={() => move(i, 1)}
            disabled={i === list.length - 1}
            hitSlop={4}
            accessibilityLabel={`Move ${item.label} down`}
          >
            <Feather name="arrow-down" size={17} color={T.ink} />
          </Pressable>
        </View>
      ))}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  pos: { width: 18, fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.mute, textAlign: 'center' },
  icon: { width: 22, alignItems: 'center' },
  label: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  arrow: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  off: { opacity: 0.3 },
  footer: { flexDirection: 'row', gap: 10 },
  reset: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  save: {
    flex: 2,
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
