// ============================================================================
// VEBOSSO EMS — Import Navgrah leads from Excel
// Columns: dof, name, function, contact, remarks. Opened from a banquet, every
// row goes into that banquet. Opened from the top, each sheet goes into the
// banquet with the sheet's name (created if it's new) — so a file exported
// from here comes back the same way. A one-sheet file can be pointed at any
// banquet.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { addBanquet, addLeads, fetchBanquets } from '../lib/leads';
import { ParsedLeadSheet, pickAndParseLeadsFile } from '../lib/leadsFile';
import { LeadBanquet } from '../types/database';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

const key = (s: string) => s.trim().toLowerCase();

export function LeadsImportSheet({
  banquets,
  target,
  onDismiss,
  onDone,
}: {
  banquets: LeadBanquet[];
  /** Opened from this banquet: everything goes in here. */
  target?: LeadBanquet | null;
  onDismiss: () => void;
  onDone: (message: string) => void;
}) {
  const [file, setFile] = useState<{ fileName: string; sheets: ParsedLeadSheet[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'pick' | 'import' | null>(null);
  // One-sheet files (not from a banquet): which banquet, or a new one by name.
  const [choice, setChoice] = useState<string | 'new'>('new');
  const [newName, setNewName] = useState('');

  const total = file?.sheets.reduce((n, s) => n + s.leads.length, 0) ?? 0;
  const single = !target && file?.sheets.length === 1;

  const pick = async () => {
    setError('');
    setBusy('pick');
    try {
      const res = await pickAndParseLeadsFile();
      if (!res) return;
      if (!res.sheets.length) {
        setError('No leads found. The first row should name the columns: dof, name, function, contact, remarks.');
        return;
      }
      setFile(res);
      if (res.sheets.length === 1) {
        const match = banquets.find((b) => key(b.name) === key(res.sheets[0].sheet));
        setChoice(match ? match.id : 'new');
        setNewName(res.sheets[0].sheet);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not read that file');
    } finally {
      setBusy(null);
    }
  };

  /** The banquet's id for a name, creating it if needed. */
  const banquetFor = async (name: string, known: LeadBanquet[]): Promise<string | null> => {
    const found = known.find((b) => key(b.name) === key(name));
    if (found) return found.id;
    const res = await addBanquet(name);
    if (res.success) {
      known.push(res.data);
      return res.data.id;
    }
    // Made by someone else in the meantime: look again.
    const again = await fetchBanquets();
    return again.success ? again.data.find((b) => key(b.name) === key(name))?.id ?? null : null;
  };

  const run = async () => {
    if (!file) return;
    setError('');
    setBusy('import');
    try {
      const known = [...banquets];
      const rows = [];
      for (const s of file.sheets) {
        let banquetId: string | null;
        if (target) banquetId = target.id;
        else if (single && choice !== 'new') banquetId = choice;
        else {
          const name = (single ? newName : s.sheet).trim();
          if (!name) {
            setError('Give the banquet a name');
            return;
          }
          banquetId = await banquetFor(name, known);
        }
        rows.push(...s.leads.map((l) => ({ ...l, banquet_id: banquetId })));
      }
      const res = await addLeads(rows);
      if (!res.success) return setError(res.error);
      onDone(`${res.data} ${res.data === 1 ? 'lead' : 'leads'} imported`);
      onDismiss();
    } finally {
      setBusy(null);
    }
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Import leads"
      subtitle={target ? `Into ${target.name}` : 'From an Excel or CSV file'}
      icon="download"
      iconColor={T.ink}
      iconBg={T.soft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {file ? (
            <Pressable style={styles.primary} onPress={() => void run()} disabled={busy !== null}>
              {busy === 'import' ? (
                <ActivityIndicator color={T.white} />
              ) : (
                <Text style={styles.primaryText}>
                  Import {total} {total === 1 ? 'lead' : 'leads'}
                </Text>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.primary} onPress={() => void pick()} disabled={busy !== null}>
              {busy === 'pick' ? <ActivityIndicator color={T.white} /> : <Text style={styles.primaryText}>Choose file</Text>}
            </Pressable>
          )}
        </View>
      }
    >
      {!file ? (
        <View style={styles.formatBox}>
          <Text style={styles.formatTitle}>The file’s columns</Text>
          <Text style={styles.formatCols}>dof · name · function · contact · remarks</Text>
          <Text style={styles.formatHint}>
            Dates like “7 Dec” or “07-12-2026”. Blank rows are skipped.
            {target ? '' : ' Each sheet goes into the banquet with the same name.'}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.fileRow}>
            <Feather name="file-text" size={16} color={T.inkSoft} />
            <Text style={styles.fileName} numberOfLines={1}>
              {file.fileName}
            </Text>
            <Text style={styles.change} onPress={() => void pick()}>
              Change
            </Text>
          </View>

          {single ? (
            <>
              <Text style={styles.label}>Put the {total} leads in</Text>
              <View style={styles.chips}>
                {banquets.map((b) => {
                  const on = choice === b.id;
                  return (
                    <Pressable key={b.id} onPress={() => setChoice(b.id)} style={[styles.chip, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
                    </Pressable>
                  );
                })}
                <Pressable onPress={() => setChoice('new')} style={[styles.chip, choice === 'new' && styles.chipOn]}>
                  <Text style={[styles.chipText, choice === 'new' && styles.chipTextOn]}>+ New banquet</Text>
                </Pressable>
              </View>
              {choice === 'new' ? (
                <PaperOutlinedField label="New banquet name" value={newName} onChangeText={setNewName} maxLength={120} style={{ marginTop: 12 }} />
              ) : null}
            </>
          ) : (
            file.sheets.map((s) => {
              const existing = target ?? banquets.find((b) => key(b.name) === key(s.sheet));
              return (
                <View key={s.sheet} style={styles.sheetRow}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.sheetName} numberOfLines={1}>
                      {target ? target.name : s.sheet}
                    </Text>
                    <Text style={styles.sheetMeta}>
                      {s.leads.length} {s.leads.length === 1 ? 'lead' : 'leads'}
                      {target ? '' : existing ? ' · into this banquet' : ' · new banquet'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </>
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  formatBox: { backgroundColor: T.soft, borderRadius: 14, padding: 14 },
  formatTitle: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.ink },
  formatCols: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink, marginTop: 6 },
  formatHint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 6, lineHeight: 18 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  fileName: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  change: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.blue },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: T.soft, justifyContent: 'center' },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  sheetRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.hairline },
  sheetName: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  sheetMeta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 2 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  primary: { height: 48, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
