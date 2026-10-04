// ============================================================================
// VEBOSSO EMS — "It will be paid by…" date
// The owner picks the day a salary or travel expense will be cleared; the
// person is told. Quick choices for the usual answers, a calendar for the rest.
// ============================================================================

import { addDays, format } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { DateField } from './DateTimeFields';
import { SheetFrame } from './SheetFrame';

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

export function PayDateSheet({
  title,
  subtitle,
  who,
  initial,
  onConfirm,
  onDismiss,
}: {
  title: string;
  subtitle?: string;
  /** Who is told, for the line under the date. */
  who: string;
  /** A date already set. */
  initial?: string | null;
  /** Saves the date and tells the person; the sheet closes afterwards. */
  onConfirm: (date: string) => void | Promise<unknown>;
  onDismiss: () => void;
}) {
  const now = new Date();
  const [date, setDate] = useState<string | null>(initial ?? null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!date || busy) return;
    setBusy(true);
    await onConfirm(date);
    setBusy(false);
    onDismiss();
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={title}
      subtitle={subtitle}
      icon="calendar"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={
        <Pressable
          style={[styles.btn, !date && { opacity: 0.45 }]}
          onPress={() => void save()}
          disabled={!date || busy}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={T.white} /> : <Text style={styles.btnText}>Tell {who}</Text>}
        </Pressable>
      }
    >
      <DateField
        label="Will be paid by"
        value={date}
        onChange={setDate}
        allow="future"
        placeholder="Pick a date"
        quick={[
          { label: 'Today', value: KEY(now) },
          { label: 'Tomorrow', value: KEY(addDays(now, 1)) },
          { label: 'In 3 days', value: KEY(addDays(now, 3)) },
          { label: 'In a week', value: KEY(addDays(now, 7)) },
        ]}
      />
      <Text style={styles.hint}>{who} gets a notification and sees this date on their request.</Text>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 12 },
});
