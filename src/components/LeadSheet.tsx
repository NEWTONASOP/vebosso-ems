// ============================================================================
// VEBOSSO EMS — One Navgrah lead: view, add, edit
// Opens to read (call, save to phone, edit); "Edit" switches to the form. New
// leads open straight in the form. Delete sits next to Edit, and in the form.
// ============================================================================

import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import { addLead, contactName, deleteLead, joinPhones, leadDate, leadPhones, updateLead } from '../lib/leads';
import { saveLeadsToPhone } from '../lib/leadsFile';
import { telUrl, whatsappUrl } from '../lib/venues';
import { Lead, LeadBanquet, LeadInput } from '../types/database';
import { DateField } from './DateTimeFields';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

const WHATSAPP_GREEN = '#1FA855';

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
  // The numbers, one box each; joined back into `contact` on save.
  const [phones, setPhones] = useState<string[]>(() => {
    const list = leadPhones(lead?.contact);
    return list.length ? list : [''];
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setPhone = (i: number, v: string) => {
    setPhones((list) => list.map((p, j) => (j === i ? v : p)));
    if (error) setError('');
  };

  const banquetName = (id: string | null) => banquets.find((b) => b.id === id)?.name ?? null;

  const set = <K extends keyof LeadInput>(k: K) => (v: LeadInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError('');
  };

  const save = async () => {
    const contact = joinPhones(phones);
    if (!(form.name ?? '').trim() && !contact) {
      return setError('Add a name or a contact number');
    }
    const input = { ...form, contact: contact || null };
    setSaving(true);
    const res = lead ? await updateLead(lead.id, input) : await addLead(input);
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

  const openWhatsApp = async (phone: string) => {
    try {
      await Linking.openURL(whatsappUrl(phone));
    } catch {
      setError('Could not open WhatsApp');
    }
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
          <View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={styles.footerRow}>
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} accessibilityLabel="Delete lead">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
              <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => setViewing(false)} accessibilityLabel="Edit lead">
                <Text style={styles.saveText}>Edit</Text>
              </Pressable>
            </View>
          </View>
        }
      >
        <Text style={styles.label}>Date of function</Text>
        <Text style={styles.viewValue}>{leadDate(lead.dof) || '—'}</Text>

        <Text style={styles.label}>Function</Text>
        <Text style={styles.viewValue}>{lead.function || '—'}</Text>

        <Text style={styles.label}>{leadPhones(lead.contact).length > 1 ? 'Numbers' : 'Contact'}</Text>
        {lead.contact ? (
          <>
            {leadPhones(lead.contact).map((p, i) => (
              <View key={`${p}-${i}`} style={styles.phoneLine}>
                <Text style={[styles.viewValue, styles.phoneText]} onPress={() => Linking.openURL(telUrl(p))}>
                  <Feather name="phone" size={14} color={T.blue} /> {p}
                </Text>
                <Pressable style={styles.waBtn} onPress={() => void openWhatsApp(p)} hitSlop={6} accessibilityLabel={`WhatsApp ${p}`}>
                  <MaterialCommunityIcons name="whatsapp" size={18} color={WHATSAPP_GREEN} />
                </Pressable>
              </View>
            ))}
            <View style={styles.contactActions}>
              <Pressable style={styles.softBtn} onPress={() => void saveToPhone()} accessibilityLabel="Save to phone">
                <Feather name="user-plus" size={14} color={T.ink} />
                <Text style={styles.softBtnText}>Save to phone</Text>
              </Pressable>
            </View>
            <Text style={styles.saveAs}>Saves to your phone as “{contactName(lead, bq)}”</Text>
          </>
        ) : (
          <Text style={styles.viewValue}>—</Text>
        )}

        <Text style={styles.label}>Remarks</Text>
        <Text style={styles.viewValue}>{lead.remarks || '—'}</Text>

        <Text style={styles.addedBy}>
          Added by {lead.created_by_name || 'someone'} on {format(parseISO(lead.created_at), 'd MMM yyyy, h:mm a')}
        </Text>
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
          <View style={styles.footerRow}>
            {lead ? (
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={remove} accessibilityLabel="Delete lead">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => void save()} disabled={saving}>
              {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>{lead ? 'Save' : 'Add lead'}</Text>}
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

      <View style={{ marginTop: 12 }}>
        {phones.map((p, i) => (
          <View key={i} style={styles.phoneEdit}>
            <PaperOutlinedField
              label={phones.length > 1 ? `Number ${i + 1}` : 'Contact'}
              value={p}
              onChangeText={(t) => setPhone(i, t)}
              keyboardType="phone-pad"
              maxLength={30}
              style={{ flex: 1 }}
            />
            {phones.length > 1 ? (
              <Pressable
                style={styles.phoneRemove}
                onPress={() => setPhones((list) => list.filter((_, j) => j !== i))}
                hitSlop={6}
                accessibilityLabel={`Remove number ${i + 1}`}
              >
                <Feather name="x" size={16} color={T.inkSoft} />
              </Pressable>
            ) : null}
          </View>
        ))}
        <Pressable style={styles.addPhone} onPress={() => setPhones((list) => [...list, ''])} accessibilityRole="button">
          <Feather name="plus" size={14} color={T.ink} />
          <Text style={styles.addPhoneText}>Add another number</Text>
        </Pressable>
      </View>
      <PaperOutlinedField label="Remarks" value={form.remarks ?? ''} onChangeText={set('remarks')} multiline maxLength={2000} style={{ marginTop: 10 }} />
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6, marginTop: 12 },
  viewValue: { fontFamily: 'Inter_500Medium', fontSize: 16, color: T.ink },
  addedBy: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 18 },
  contactActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  phoneLine: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  phoneText: { flexShrink: 1, color: T.blue },
  waBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  phoneEdit: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  phoneRemove: { width: 36, height: 36, borderRadius: 12, backgroundColor: T.soft, alignItems: 'center', justifyContent: 'center' },
  addPhone: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 6, marginTop: 2 },
  addPhoneText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.ink },
  softBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: T.soft,
  },
  softBtnText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.ink },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: T.soft, justifyContent: 'center' },
  chipSmall: { height: 30, paddingHorizontal: 12 },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  saveAs: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 6 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  // Same as an account entry's footer (AccountTxnSheet).
  footerRow: { flexDirection: 'row', gap: 8 },
  btn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 56, backgroundColor: T.coralSoft },
  saveBtn: { flex: 1, backgroundColor: T.charcoal },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
