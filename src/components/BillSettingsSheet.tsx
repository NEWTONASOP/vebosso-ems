// ============================================================================
// VEBOSSO EMS — Bill settings
// Business details printed on every bill, and the terms new bills start with.
// ============================================================================

import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { fetchBillSettings, saveBillSettings } from '../lib/bills';
import { BillSettings } from '../types/database';
import { SheetFrame } from './SheetFrame';

type Form = Pick<BillSettings, 'business_name' | 'tagline' | 'address' | 'phone' | 'email' | 'website' | 'default_terms'>;

export function BillSettingsSheet({ onDismiss, onSaved }: { onDismiss: () => void; onSaved: (m: string) => void }) {
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchBillSettings().then((res) => {
      if (!active) return;
      if (res.success) setForm(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, []);

  const set = (k: keyof Form) => (v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const save = async () => {
    if (!form) return;
    setSaving(true);
    const res = await saveBillSettings(form);
    setSaving(false);
    if (!res.success) return setError(res.error);
    onSaved('Bill settings saved');
    onDismiss();
  };

  const field = (label: string, k: keyof Form, opts: { multiline?: boolean; keyboard?: 'email-address' | 'phone-pad' } = {}) => (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={(form?.[k] as string) ?? ''}
        onChangeText={set(k)}
        style={[styles.input, opts.multiline && styles.multi]}
        multiline={opts.multiline}
        textAlignVertical={opts.multiline ? 'top' : 'center'}
        keyboardType={opts.keyboard}
        autoCapitalize={opts.keyboard === 'email-address' ? 'none' : 'sentences'}
      />
    </View>
  );

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Bill settings"
      subtitle="Printed on every estimate and bill"
      icon="settings"
      iconColor={T.charcoal}
      iconBg={T.soft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable style={styles.save} onPress={save} disabled={saving || !form}>
            {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>Save</Text>}
          </Pressable>
        </View>
      }
    >
      {!form ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : (
        <>
          {field('Business name', 'business_name')}
          {field('Tagline', 'tagline')}
          {field('Address', 'address', { multiline: true })}
          {field('Phone', 'phone', { keyboard: 'phone-pad' })}
          {field('Email', 'email', { keyboard: 'email-address' })}
          {field('Website', 'website', { keyboard: 'email-address' })}
          {field('Default terms & conditions (for new bills)', 'default_terms', { multiline: true })}
        </>
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  field: { marginBottom: 10 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 5 },
  input: {
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: T.ink,
  },
  multi: { minHeight: 90, paddingTop: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  save: { height: 48, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
