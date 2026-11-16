// ============================================================================
// VEBOSSO EMS — Export / share accounts
// One account or all of them, for the selected period (and category, if one
// is picked), as PDF / Excel / CSV,
// handed to the share sheet (WhatsApp, email, Drive, Save to files…).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { fetchTransactions, Period, periodLabel, txnMatches } from '../lib/accounts';
import type { ExportFormat, LedgerForExport } from '../lib/accountsFile';
// Loaded on first use: the spreadsheet code is big and slowed down app start.
const accountsFile = () => import('../lib/accountsFile');
import { Account } from '../types/database';
import { SheetFrame } from './SheetFrame';

const OPTIONS: { fmt: ExportFormat; label: string; hint: string; icon: keyof typeof Feather.glyphMap; color: string; bg: string }[] = [
  { fmt: 'pdf', label: 'PDF', hint: 'Ready to print or send', icon: 'file-text', color: T.coral, bg: T.coralSoft },
  { fmt: 'xlsx', label: 'Excel', hint: 'Opens in Excel / Sheets; re-importable', icon: 'grid', color: T.green, bg: T.greenSoft },
  { fmt: 'csv', label: 'CSV', hint: 'Plain table for any app', icon: 'list', color: T.blue, bg: T.blueSoft },
];

export function AccountExportSheet({
  accounts,
  period,
  category = null,
  search = '',
  onDismiss,
}: {
  /** One account, or all of them. */
  accounts: Account[];
  period: Period;
  /** Only this category's entries (076); accounts with none are left out. */
  category?: string | null;
  /** Only the entries this search finds, as on screen; accounts with none are left out. */
  search?: string;
  onDismiss: () => void;
}) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState('');

  const q = search.trim();

  const run = async (fmt: ExportFormat) => {
    setBusy(fmt);
    setError('');
    try {
      const ledgers: LedgerForExport[] = [];
      for (const account of accounts) {
        const res = await fetchTransactions(account.id, period);
        if (!res.success) throw new Error(res.error);
        const txns = res.data.filter((t) => (!category || t.category === category) && txnMatches(t, search, account.name));
        if ((category || q) && txns.length === 0 && accounts.length > 1) continue;
        ledgers.push({ account, txns });
      }
      if (ledgers.length === 0) throw new Error('No entries to export');
      await (await accountsFile()).exportLedgers(ledgers, period, fmt, category, q || null);
    } catch (e: any) {
      setError(e?.message || 'Could not export');
    } finally {
      setBusy(null);
    }
  };

  const title = accounts.length === 1 ? accounts[0].name : `All accounts (${accounts.length})`;
  const filterLabel = `${category ? `${category} · ` : ''}${q ? `“${q}” · ` : ''}${periodLabel(period)}`;

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Export & share"
      subtitle={`${title} · ${filterLabel}`}
      icon="share"
      iconColor={T.charcoal}
      iconBg={T.soft}
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {OPTIONS.map((o) => (
        <Pressable
          key={o.fmt}
          onPress={() => run(o.fmt)}
          disabled={busy !== null}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: T.soft }]}
          accessibilityRole="button"
          accessibilityLabel={`Export as ${o.label}`}
        >
          <View style={[styles.icon, { backgroundColor: o.bg }]}>
            <Feather name={o.icon} size={17} color={o.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{o.label}</Text>
            <Text style={styles.hint}>{o.hint}</Text>
          </View>
          {busy === o.fmt ? <ActivityIndicator color={T.charcoal} /> : <Feather name="share-2" size={16} color={T.mute} />}
        </Pressable>
      ))}
      <Text style={styles.note}>
        Exports what you see ({filterLabel}). Clear the search and switch to “All” and “All time” to export everything.
      </Text>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16 },
  icon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 1 },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 10, textAlign: 'center' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
});
