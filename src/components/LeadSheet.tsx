// ============================================================================
// VEBOSSO EMS — One Navgrah lead: view, add, edit
// Opens to read (call, save to phone, edit); "Edit" switches to the form. New
// leads open straight in the form. Delete sits next to Edit, and in the form.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import { addLead, contactName, deleteLead, leadDate, updateLead } from '../lib/leads';
import { saveLeadsToPhone } from '../lib/leadsFile';
import { telUrl } from '../lib/venues';
import { Lead, LeadBanquet, LeadInput } from '../types/database';
import { DateField } from './DateTimeFields';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

const FUNCTIONS = ['Wedding', 'Engagement', 'Reception', 'Cocktail', 'Haldi', 'Mehndi', 'Birthday'];

export function LeadSheet({
  lead,
  banquets,
  defaultBanquetId = null,
  onDismiss,
  onSaved,
}: {
  /** Present when opening an existing lead. */
  lead?: Lead | null;
  banquets: LeadBanquet[];
  /** Preselected banquet for a new lead. */
  defaultBanquetId?: string | null;
  onDismiss: () => void;
  onSaved: (message: string) => void;
}) {
  const [viewing, setViewing] = useState(!!lead);
  const [form, setForm] = useState<LeadInput>({
    banquet_id: lead ? lead.banquet_id : defaultBanquetId,
    dof: lead?.dof ?? null,
    name: lead?.name ?? '',
    function: lead?.function ?? '',
    contact: lead?.contact ?? '',
    remarks: lead?.remarks ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const banquetName = (id: string | null) => banquets.find((b) => b.id === id)?.name ?? null;

  const set = <K extends keyof LeadInput>(k: K) => (v: LeadInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError('');
  };

  const save = async () => {
    if (!(form.name ?? '').trim() && !(form.contact ?? '').trim()) {
      return setError('Add a name or a contact number');
    }
    setSaving(true);
    const res = lead ? await updateLead(lead.id, form) : await addLead(form);
    setSaving(false);
    if (!res.success) return setError(res.error);
    onSaved(lead ? 'Lead updated' : 'Lead added');
    onDismiss();
  };

  const remove = () => {
    if (!lead) return;
    Alert.alert('Delete this lead?', `${lead.name || lead.contact || 'This lead'} will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteLead(lead.id);
          if (!res.success) return setError(res.error);
          onSaved('Lead deleted');
          onDismiss();
        },
      },
    ]);
  };

  const saveToPhone = async () => {
    if (!lead) return;
    try {
      await saveLeadsToPhone([{ lead, banquetName: banquetName(lead.banquet_id) }], contactName(lead, banquetName(lead.banquet_id)));
    } catch (e: any) {
      setError(e?.message || 'Could not open Contacts');
    }
  };

  // ---- Reading -------------------------------------------------------------
  if (viewing && lead) {
    const bq = banquetName(lead.banquet_id);
    return (
      <SheetFrame
        visible
        onDismiss={onDismiss}
        title={lead.name || 'Lead'}
        subtitle={bq ?? 'No banquet'}
        icon="user"
        iconColor={T.ink}
        iconBg={T.soft}
        footer={
          <View style={{ gap: 8 }}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {lead.contact ? (
              <View style={styles.row}>
                <Pressable style={[styles.btn, styles.btnSoft]} onPress={() => Linking.openURL(telUrl(lead.contact!))}>
                  <Feather name="phone" size={16} color={T.ink} />
                  <Text style={styles.btnSoftText}>Call</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnSoft]} onPress={() => void saveToPhone()}>
                  <Feather name="user-plus" size={16} color={T.ink} />
                  <Text style={styles.btnSoftText}>Save to phone</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.row}>
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} accessibilityLabel="Delete lead">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDark, { flex: 1 }]} onPress={() => setViewing(false)}>
                <Feather name="edit-2" size={16} color={T.white} />
                <Text style={styles.btnDarkText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        }
      >
        <Field label="Date of function" value={leadDate(lead.dof) || '—'} />
        <Field label="Function" value={lead.function || '—'} />
        <Field label="Contact" value={lead.contact || '—'} link={!!lead.contact} onPress={lead.contact ? () => Linking.openURL(telUrl(lead.contact!)) : undefined} />
        <Field label="Remarks" value={lead.remarks || '—'} />
        {lead.contact ? (
          <Text style={styles.saveAs}>Saves to your phone as “{contactName(lead, bq)}”</Text>
        ) : null}
      </SheetFrame>
    );
  }

  // ---- Form ----------------------------------------------------------------
  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={lead ? 'Edit lead' : 'Add lead'}
      subtitle="Navgrah Leads"
      icon={lead ? 'edit-2' : 'user-plus'}
      iconColor={T.ink}
      iconBg={T.soft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.row}>
            {lead ? (
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} accessibilityLabel="Delete lead">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.btnDark, { flex: 1 }]} onPress={() => void save()} disabled={saving}>
              {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.btnDarkText}>{lead ? 'Save' : 'Add lead'}</Text>}
            </Pressable>
          </View>
        </View>
      }
    >
      <Text style={styles.label}>Banquet</Text>
      <View style={styles.chips}>
        {banquets.map((b) => {
          const on = form.banquet_id === b.id;
          return (
            <Pressable
              key={b.id}
              onPress={() => set('banquet_id')(on ? null : b.id)}
              style={[styles.chip, on && styles.chipOn]}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{b.name}</Text>
            </Pressable>
          );
        })}
      </View>
      {banquets.length === 0 ? <Text style={styles.hint}>No banquets yet — add one with “Add banquet” on the list.</Text> : null}

      <DateField style={{ marginTop: 14 }} label="Date of function" value={form.dof} onChange={set('dof')} />

      <PaperOutlinedField label="Name" value={form.name ?? ''} onChangeText={set('name')} maxLength={200} style={{ marginTop: 12 }} />

      <PaperOutlinedField label="Function" value={form.function ?? ''} onChangeText={set('function')} maxLength={120} style={{ marginTop: 10 }} />
      <View style={[styles.chips, { marginTop: 6 }]}>
        {FUNCTIONS.map((fn) => {
          const on = (form.function ?? '').toLowerCase() === fn.toLowerCase();
          return (
            <Pressable key={fn} onPress={() => set('function')(fn)} style={[styles.chip, styles.chipSmall, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{fn}</Text>
            </Pressable>
          );
        })}
      </View>

      <PaperOutlinedField
        label="Contact"
        value={form.contact ?? ''}
        onChangeText={set('contact')}
        keyboardType="phone-pad"
        maxLength={40}
        style={{ marginTop: 12 }}
      />
      <PaperOutlinedField label="Remarks" value={form.remarks ?? ''} onChangeText={set('remarks')} multiline maxLength={2000} style={{ marginTop: 10 }} />
    </SheetFrame>
  );
}

function Field({ label, value, link, onPress }: { label: string; value: string; link?: boolean; onPress?: () => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={[styles.fieldValue, link && { color: T.blue }]} onPress={onPress} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 8 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: T.soft, justifyContent: 'center' },
  chipSmall: { height: 30, paddingHorizontal: 12 },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  field: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.hairline },
  fieldLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.mute, marginBottom: 3 },
  fieldValue: { fontFamily: 'Inter_500Medium', fontSize: 15, color: T.ink },
  saveAs: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 48, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnSoft: { backgroundColor: T.soft },
  btnSoftText: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  btnDark: { backgroundColor: T.charcoal },
  btnDarkText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  deleteBtn: { flex: 0, width: 56, backgroundColor: T.coralSoft },
});
