// ============================================================================
// VEBOSSO EMS — Import accounts from Excel / CSV
// Pick a file → preview what was found → import. From an account screen,
// everything goes into that account; from the list, each sheet becomes an
// account (merged into an existing one when the name matches). Entries that
// are already there (same date, type, amount, particular) are skipped, so
// importing the same file twice doesn't double anything.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addTransactionsBulk, createAccount, fetchTransactions, money, num, TxnInput } from '../lib/accounts';
import { ParsedLedger, pickAndParseLedgerFile } from '../lib/accountsFile';
import { Account } from '../types/database';
import { SheetFrame } from './SheetFrame';

const txnKey = (t: { txn_date: string; kind: string; amount: number | string; particular: string | null }) =>
  `${t.txn_date}|${t.kind}|${num(t.amount).toFixed(2)}|${(t.particular ?? '').trim().toLowerCase()}`;

interface Row extends ParsedLedger {
  include: boolean;
  /** Editable target name when importing into new accounts. */
  targetName: string;
}

export function AccountImportSheet({
  accounts,
  target,
  onDismiss,
  onDone,
}: {
  accounts: Account[];
  /** Import into this account instead of creating accounts. */
  target?: Account | null;
  onDismiss: () => void;
  onDone: (message: string) => void;
}) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState('');

  const byName = (name: string) =>
    accounts.find((a) => a.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null;

  const choose = async () => {
    setError('');
    setReading(true);
    try {
      const res = await pickAndParseLedgerFile();
      if (!res) return;
      if (res.ledgers.length === 0) {
        setError(
          'No entries found. The file needs a Date column and Credit / Debit (or Amount) columns.',
        );
        return;
      }
      setFileName(res.fileName);
      setRows(res.ledgers.map((l) => ({ ...l, include: true, targetName: l.name })));
    } catch (e: any) {
      setError(e?.message || 'Could not read that file');
    } finally {
      setReading(false);
    }
  };

  const included = rows.filter((r) => r.include);
  const entryCount = included.reduce((n, r) => n + r.entries.length, 0);

  const run = async () => {
    if (included.length === 0) return;
    setImporting(true);
    setError('');
    let saved = 0;
    let duplicates = 0;
    try {
      // Group what's being imported by destination account.
      const groups = new Map<string, { account: Account | null; name: string; entries: TxnInput[] }>();
      for (const r of included) {
        const dest = target ?? byName(r.targetName);
        const key = dest ? dest.id : `new:${r.targetName.trim().toLowerCase()}`;
        const g = groups.get(key) ?? { account: dest, name: r.targetName.trim() || r.name, entries: [] };
        g.entries.push(...r.entries);
        groups.set(key, g);
      }

      for (const g of groups.values()) {
        let account = g.account;
        let existingKeys = new Set<string>();
        if (account) {
          setProgress(`Checking ${account.name}…`);
          const existing = await fetchTransactions(account.id, null);
          if (!existing.success) throw new Error(existing.error);
          existingKeys = new Set(existing.data.map(txnKey));
        } else {
          const created = await createAccount(g.name);
          if (!created.success) throw new Error(created.error);
          account = created.data;
        }

        const fresh: TxnInput[] = [];
        for (const e of g.entries) {
          const k = txnKey(e);
          if (existingKeys.has(k)) {
            duplicates++;
            continue;
          }
          existingKeys.add(k);
          fresh.push(e);
        }

        const name = account.name;
        const res = await addTransactionsBulk(account.id, fresh, (done) =>
          setProgress(`${name}: ${done} / ${fresh.length}`),
        );
        if (!res.success) throw new Error(res.error);
        saved += res.data;
      }

      onDone(
        `Imported ${saved} entr${saved === 1 ? 'y' : 'ies'}` +
          (duplicates ? ` · ${duplicates} already there, skipped` : ''),
      );
      onDismiss();
    } catch (e: any) {
      setError(
        `${e?.message || 'Import failed'}${saved ? ` — ${saved} entries were saved before the error.` : ''}`,
      );
    } finally {
      setImporting(false);
      setProgress('');
    }
  };

  return (
    <SheetFrame
      visible
      onDismiss={importing ? () => {} : onDismiss}
      title="Import"
      subtitle={target ? `Into ${target.name}` : 'From an Excel or CSV file'}
      icon="download"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {progress ? <Text style={styles.progress}>{progress}</Text> : null}
          {rows.length === 0 ? (
            <Pressable style={styles.primary} onPress={choose} disabled={reading}>
              {reading ? (
                <ActivityIndicator color={T.white} />
              ) : (
                <>
                  <Feather name="folder" size={16} color={T.white} />
                  <Text style={styles.primaryText}>Choose file</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.footerRow}>
              <Pressable
                style={[styles.secondary]}
                onPress={() => {
                  setRows([]);
                  setFileName(null);
                }}
                disabled={importing}
              >
                <Text style={styles.secondaryText}>Other file</Text>
              </Pressable>
              <Pressable
                style={[styles.primary, { flex: 1 }, entryCount === 0 && { opacity: 0.5 }]}
                onPress={run}
                disabled={importing || entryCount === 0}
              >
                {importing ? (
                  <ActivityIndicator color={T.white} />
                ) : (
                  <Text style={styles.primaryText}>Import {entryCount} entries</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      }
    >
      {rows.length === 0 ? (
        <View style={styles.help}>
          <Text style={styles.helpTitle}>What works</Text>
          <Text style={styles.helpLine}>• Excel (.xlsx, .xls) or CSV files</Text>
          <Text style={styles.helpLine}>• Columns named Date, Particular (or Description), Credit, Debit — or Date, Amount, Type</Text>
          <Text style={styles.helpLine}>• Dates like 15-09-2026, 15/09/26, 15 Sep 2026</Text>
          <Text style={styles.helpLine}>
            • {target ? 'Every sheet goes into this account' : 'Each sheet becomes an account'}
          </Text>
          <Text style={styles.helpLine}>• Entries already there are skipped, so re-importing is safe</Text>
        </View>
      ) : (
        <>
          <Text style={styles.file} numberOfLines={1}>
            {fileName}
          </Text>
          {rows.map((r, i) => {
            const dest = target ?? byName(r.targetName);
            return (
              <View key={`${r.name}-${i}`} style={[styles.card, !r.include && { opacity: 0.5 }]}>
                <View style={styles.cardHead}>
                  <Pressable
                    onPress={() => setRows((all) => all.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))}
                    style={[styles.check, r.include && styles.checkOn]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: r.include }}
                  >
                    {r.include ? <Feather name="check" size={13} color={T.white} /> : null}
                  </Pressable>
                  {target ? (
                    <Text style={styles.cardName} numberOfLines={1}>{r.name}</Text>
                  ) : (
                    <TextInput
                      value={r.targetName}
                      onChangeText={(t) => setRows((all) => all.map((x, j) => (j === i ? { ...x, targetName: t } : x)))}
                      style={styles.nameInput}
                      maxLength={120}
                    />
                  )}
                </View>
                <Text style={styles.dest}>
                  {target
                    ? `→ ${target.name}`
                    : dest
                      ? `→ adds to existing “${dest.name}”`
                      : '→ new account'}
                </Text>
                <View style={styles.stats}>
                  <Stat label="Entries" value={String(r.entries.length)} />
                  <Stat label="Credit" value={`₹${money(r.credit)}`} color={T.green} />
                  <Stat label="Debit" value={`₹${money(r.debit)}`} color={T.coral} />
                </View>
                {r.from && r.to ? (
                  <Text style={styles.meta}>
                    {format(parseISO(r.from), 'd MMM yyyy')} – {format(parseISO(r.to), 'd MMM yyyy')}
                    {r.skipped ? ` · ${r.skipped} row${r.skipped === 1 ? '' : 's'} couldn’t be read` : ''}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </>
      )}
    </SheetFrame>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : null]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  help: { backgroundColor: T.soft, borderRadius: 16, padding: 14, gap: 4 },
  helpTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.ink, marginBottom: 4 },
  helpLine: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.inkSoft, lineHeight: 19 },
  file: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.mute, marginBottom: 8 },
  card: { backgroundColor: T.soft, borderRadius: 16, padding: 12, marginBottom: 8, gap: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: T.soft2,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: T.charcoal, borderColor: T.charcoal },
  cardName: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 15, color: T.ink },
  nameInput: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    backgroundColor: T.card,
    paddingHorizontal: 10,
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: T.ink,
  },
  dest: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: T.blue, marginLeft: 32 },
  stats: { flexDirection: 'row', gap: 8, marginLeft: 32 },
  statLabel: { fontFamily: 'Inter_500Medium', fontSize: 11, color: T.mute },
  statValue: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.ink },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginLeft: 32 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  progress: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.inkSoft, marginBottom: 8, textAlign: 'center' },
  footerRow: { flexDirection: 'row', gap: 8 },
  primary: {
    height: 48,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  secondary: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
});
