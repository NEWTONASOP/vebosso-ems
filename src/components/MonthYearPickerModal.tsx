// ============================================================================
// VEBOSSO EMS — Month / year picker
// Lets a date rail jump straight to any past month instead of scrolling to it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { AnimatedPressable } from './AnimatedPressable';
import { AppTheme, AppRadius } from '../constants/theme';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** How far back the year stepper allows. Attendance predating this is archival. */
const YEARS_BACK = 5;

interface MonthYearPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** Any date inside the currently shown month. */
  value: Date;
  onSelect: (month: Date) => void;
  accentColor?: string;
}

export function MonthYearPickerModal({
  visible,
  onDismiss,
  value,
  onSelect,
  accentColor = AppTheme.blue,
}: MonthYearPickerModalProps) {
  const now = new Date();
  const [year, setYear] = useState(value.getFullYear());

  // Reopening should start from whatever month the rail is on, not wherever
  // the stepper was left last time.
  useEffect(() => {
    if (visible) setYear(value.getFullYear());
  }, [visible, value]);

  const minYear = now.getFullYear() - YEARS_BACK;
  const maxYear = now.getFullYear();

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View style={styles.yearRow}>
          <StepButton
            icon="chevron-left"
            disabled={year <= minYear}
            onPress={() => setYear((y) => y - 1)}
          />
          <Text style={styles.year}>{year}</Text>
          <StepButton
            icon="chevron-right"
            disabled={year >= maxYear}
            onPress={() => setYear((y) => y + 1)}
          />
        </View>

        <View style={styles.grid}>
          {MONTHS.map((label, index) => {
            const selected = year === value.getFullYear() && index === value.getMonth();
            // Attendance can't exist ahead of today, so future months are dead ends.
            const future =
              year > now.getFullYear() ||
              (year === now.getFullYear() && index > now.getMonth());

            return (
              // The cell width lives on a plain View so the grid lays out the
              // same on native and web regardless of how the pressable
              // forwards styles.
              <View key={label} style={styles.cellSlot}>
                <AnimatedPressable
                  scaleTo={0.94}
                  disabled={future}
                  onPress={() => {
                    onSelect(new Date(year, index, 1));
                    onDismiss();
                  }}
                  style={[
                    styles.monthCell,
                    selected && { backgroundColor: accentColor },
                    future && styles.monthCellDisabled,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: future }}
                >
                  <Text
                    style={[
                      styles.monthText,
                      selected && styles.monthTextSelected,
                      future && styles.monthTextDisabled,
                    ]}
                  >
                    {label}
                  </Text>
                </AnimatedPressable>
              </View>
            );
          })}
        </View>
      </Modal>
    </Portal>
  );
}

function StepButton({
  icon,
  disabled,
  onPress,
}: {
  icon: 'chevron-left' | 'chevron-right';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <AnimatedPressable
      scaleTo={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.step, disabled && styles.stepDisabled]}
      accessibilityRole="button"
      accessibilityLabel={icon === 'chevron-left' ? 'Previous year' : 'Next year'}
    >
      <Feather
        name={icon}
        size={18}
        color={disabled ? AppTheme.mute : AppTheme.ink}
      />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    // Percentage width keeps a comfortable inset on phones while the cap stops
    // the dialog stretching across a desktop browser window.
    width: '88%',
    maxWidth: 420,
    alignSelf: 'center',
    borderRadius: AppRadius.hero,
    paddingVertical: 20,
    paddingHorizontal: 18,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  year: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  step: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.soft,
  },
  stepDisabled: {
    opacity: 0.45,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cellSlot: {
    // Four per row, leaving room for the 8pt gaps between them.
    width: '22.5%',
  },
  monthCell: {
    width: '100%',
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.soft,
  },
  monthCellDisabled: {
    backgroundColor: 'transparent',
  },
  monthText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: AppTheme.ink,
  },
  monthTextSelected: {
    color: AppTheme.white,
  },
  monthTextDisabled: {
    color: AppTheme.mute,
    opacity: 0.6,
  },
});
