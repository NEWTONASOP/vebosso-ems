// ============================================================================
// VEBOSSO EMS — Employee details sheet
// Personal, contact, emergency contact, family, work, education. The person
// fills it in once ("self"); after that it is read-only for them — they can
// tap "Request to edit", and once the owner approves they get one edit (049).
// The owner can fill in, change or clear anyone's ("owner"). ID papers and
// bank proof live in Documents, pay in Salary — not repeated here.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  answerDetailsEdit,
  BLOOD_GROUPS,
  clearDetails,
  emptyDetails,
  fetchEmployeeDetails,
  GENDERS,
  MARITAL,
  RELATIONS,
  requestDetailsEdit,
  saveDetailsAsOwner,
  submitOwnDetails,
  updateOwnDetails,
  WEEK_DAYS,
} from '../lib/employeeDetails';
import { telUrl } from '../lib/venues';
import { EmployeeDetails, EmployeeDetailsInput, FamilyMember } from '../types/database';
import { DateField, TimeField } from './DateTimeFields';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

type TextKey = {
  [K in keyof EmployeeDetailsInput]: EmployeeDetailsInput[K] extends string | null ? K : never;
}[keyof EmployeeDetailsInput];

const toInput = (d: EmployeeDetails): EmployeeDetailsInput => {
  const { user_id, submitted_at, updated_by, updated_at, edit_requested_at, edit_unlocked, ...rest } = d;
  return { ...rest, family: rest.family ?? [], weekly_off: rest.weekly_off ?? [] };
};

const day = (v: string | null) => (v ? format(parseISO(v), 'd MMM yyyy') : null);
const time = (v: string | null) => {
  if (!v) return null;
  const [h, m] = v.split(':').map(Number);
  return format(new Date(2000, 0, 1, h, m), 'h:mm a');
};

export function EmployeeDetailsSheet({
  userId,
  userName,
  mode,
  onDismiss,
  onMessage,
}: {
  userId: string;
  userName: string;
  /** "self": fill in once, then read. "owner": everything. */
  mode: 'self' | 'owner';
  onDismiss: () => void;
  onMessage?: (message: string) => void;
}) {
  const isOwner = mode === 'owner';
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState<EmployeeDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EmployeeDetailsInput>(emptyDetails);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // The person's one approved edit (049): editing what's already saved.
  const unlockedEdit = !isOwner && !!details?.edit_unlocked;

  const request = async () => {
    setSaving(true);
    const res = await requestDetailsEdit(userId, userName);
    setSaving(false);
    if (!res.success) return setError(res.error);
    onMessage?.('Request sent to the boss');
    await load();
  };

  const answer = async (approve: boolean) => {
    setSaving(true);
    const res = await answerDetailsEdit(userId, approve);
    setSaving(false);
    if (!res.success) return setError(res.error);
    onMessage?.(approve ? `${userName.split(' ')[0]} can edit their details once` : 'Request turned down');
    await load();
  };

  const load = async () => {
    const d = await fetchEmployeeDetails(userId);
    if (!d.success) setError(d.error);
    const row = d.success ? d.data : null;
    setDetails(row);
    setLoading(false);
    return row;
  };

  useEffect(() => {
    let active = true;
    load().then((row) => {
      // Nothing yet: the person goes straight to the form.
      if (active && !row && !isOwner) startEditing(null);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const startEditing = (row: EmployeeDetails | null) => {
    setForm(row ? toInput(row) : emptyDetails());
    setError('');
    setEditing(true);
  };

  const set = <K extends keyof EmployeeDetailsInput>(k: K) => (v: EmployeeDetailsInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (error) setError('');
  };
  const pick = (k: TextKey, v: string) => set(k)((form[k] === v ? null : v) as any);

  const setFamily = (i: number, k: keyof FamilyMember, v: string) =>
    setForm((f) => ({ ...f, family: f.family.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));

  const save = async () => {
    if (isOwner) {
      setSaving(true);
      const res = await saveDetailsAsOwner(userId, form);
      setSaving(false);
      if (!res.success) return setError(res.error);
      onMessage?.(`Details saved for ${userName}`);
      setEditing(false);
      await load();
      return;
    }

    if (!(form.phone ?? '').trim()) return setError('Add your phone number');
    if (unlockedEdit) {
      setSaving(true);
      const res = await updateOwnDetails(userId, userName, form);
      setSaving(false);
      if (!res.success) return setError(res.error);
      onMessage?.('Details updated');
      setEditing(false);
      await load();
      return;
    }
    Alert.alert(
      'Submit your details?',
      'Check everything once more. After you submit, you can’t change it yourself — only the boss can.',
      [
        { text: 'Check again', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setSaving(true);
            const res = await submitOwnDetails(userId, userName, form);
            setSaving(false);
            if (!res.success) return setError(res.error);
            onMessage?.('Details submitted');
            setEditing(false);
            await load();
          },
        },
      ],
    );
  };

  const clear = () => {
    Alert.alert(
      'Clear these details?',
      `Everything ${userName} filled in is removed, and they can fill it in again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const res = await clearDetails(userId);
            if (!res.success) return setError(res.error);
            onMessage?.(`Details cleared for ${userName}`);
            await load();
          },
        },
      ],
    );
  };

  // ---- Footer ---------------------------------------------------------------
  let footer: React.ReactNode = null;
  if (!loading) {
    if (editing) {
      footer = (
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerRow}>
            {isOwner || unlockedEdit ? (
              <Pressable style={[styles.btn, styles.softBtn]} onPress={() => setEditing(false)} accessibilityLabel="Cancel">
                <Text style={styles.softText}>Cancel</Text>
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => void save()} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={T.white} />
              ) : (
                <Text style={styles.saveText}>{isOwner || unlockedEdit ? 'Save' : 'Submit details'}</Text>
              )}
            </Pressable>
          </View>
        </View>
      );
    } else if (isOwner && details?.edit_requested_at) {
      footer = (
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerRow}>
            <Pressable style={[styles.btn, styles.softBtn]} onPress={() => void answer(false)} disabled={saving}>
              <Text style={styles.softText}>Not now</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => void answer(true)} disabled={saving}>
              {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>Approve edit</Text>}
            </Pressable>
          </View>
        </View>
      );
    } else if (!isOwner && details) {
      footer = (
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {details.edit_unlocked ? (
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => startEditing(details)}>
              <Text style={styles.saveText}>Edit my details</Text>
            </Pressable>
          ) : details.edit_requested_at ? (
            <View style={[styles.btn, styles.softBtn]}>
              <Text style={styles.softText}>Request sent · waiting for the boss</Text>
            </View>
          ) : (
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => void request()} disabled={saving}>
              {saving ? <ActivityIndicator color={T.white} /> : <Text style={styles.saveText}>Request to edit</Text>}
            </Pressable>
          )}
        </View>
      );
    } else if (isOwner) {
      footer = (
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.footerRow}>
            {details ? (
              <Pressable style={[styles.btn, styles.deleteBtn]} onPress={clear} accessibilityLabel="Clear details">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
            ) : null}
            <Pressable style={[styles.btn, styles.saveBtn]} onPress={() => startEditing(details)}>
              <Text style={styles.saveText}>{details ? 'Edit' : 'Fill in details'}</Text>
            </Pressable>
          </View>
        </View>
      );
    }
  }

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={isOwner ? userName : 'My details'}
      subtitle={
        editing
          ? isOwner
            ? 'Editing employee details'
            : unlockedEdit
              ? 'Your one approved edit'
              : 'Fill this in once'
          : 'Employee details'
      }
      icon="user"
      iconColor={T.blue}
      iconBg={T.blueSoft}
      footer={footer}
    >
      {loading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 32 }} />
      ) : editing ? (
        renderForm()
      ) : details ? (
        renderView(details)
      ) : (
        <View style={styles.empty}>
          <Feather name="clipboard" size={24} color={T.mute} />
          <Text style={styles.emptyTitle}>Not filled in yet</Text>
          <Text style={styles.emptySub}>
            {userName.split(' ')[0]} can fill these in from their profile, or you can fill them in now.
          </Text>
        </View>
      )}
    </SheetFrame>
  );

  // ---- Reading --------------------------------------------------------------
  function renderView(d: EmployeeDetails) {
    return (
      <View>
        {!isOwner ? (
          <View style={styles.lockNote}>
            <Feather name={d.edit_unlocked ? 'unlock' : 'lock'} size={14} color={T.inkSoft} />
            <Text style={styles.lockText}>
              {d.edit_unlocked
                ? 'The boss approved your edit. You can change your details once — it locks again when you save.'
                : d.edit_requested_at
                  ? 'You asked to edit your details. You’ll be able to once the boss approves.'
                  : 'Submitted. To change anything, tap Request to edit below.'}
            </Text>
          </View>
        ) : (
          <>
            {d.edit_requested_at ? (
              <View style={[styles.lockNote, { backgroundColor: T.amberSoft, marginBottom: 8 }]}>
                <Feather name="edit-3" size={14} color={T.amber} />
                <Text style={styles.lockText}>
                  {userName.split(' ')[0]} asked to edit their details on{' '}
                  {format(parseISO(d.edit_requested_at), 'd MMM, h:mm a')}.
                </Text>
              </View>
            ) : d.edit_unlocked ? (
              <View style={[styles.lockNote, { marginBottom: 8 }]}>
                <Feather name="unlock" size={14} color={T.inkSoft} />
                <Text style={styles.lockText}>{userName.split(' ')[0]} can edit these once. It locks again when they save.</Text>
              </View>
            ) : null}
            <Text style={styles.meta}>Filled in {format(parseISO(d.submitted_at), 'd MMM yyyy')}</Text>
          </>
        )}

        <Section title="Personal">
          <Row label="Date of birth" value={day(d.date_of_birth)} />
          <Row label="Gender" value={d.gender} />
          <Row label="Blood group" value={d.blood_group} />
          <Row label="Marital status" value={d.marital_status} />
        </Section>

        <Section title="Contact">
          <Row label="Phone" value={d.phone} phone />
          <Row label="Other phone" value={d.alt_phone} phone />
          <Row label="Personal email" value={d.personal_email} />
          <Row label="Current address" value={d.current_address} />
          <Row label="Permanent address" value={d.permanent_address} />
        </Section>

        <Section title="Emergency contact">
          <Row label="Name" value={d.emergency_name} />
          <Row label="Relation" value={d.emergency_relation} />
          <Row label="Phone" value={d.emergency_phone} phone />
        </Section>

        <Section title="Family">
          {d.family?.length ? (
            d.family.map((m, i) => (
              <View key={i} style={styles.familyCard}>
                <Text style={styles.familyName}>
                  {m.name || '—'}
                  {m.relation ? <Text style={styles.familyRel}>{`  ·  ${m.relation}`}</Text> : null}
                </Text>
                {m.phone ? (
                  <Text style={styles.link} onPress={() => Linking.openURL(telUrl(m.phone!))}>
                    <Feather name="phone" size={12} color={T.blue} /> {m.phone}
                  </Text>
                ) : null}
                {m.occupation ? <Text style={styles.familyRel}>{m.occupation}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.value}>—</Text>
          )}
        </Section>

        <Section title="Work">
          <Row label="Joining date" value={day(d.joining_date)} />
          <Row
            label="Working hours"
            value={d.work_start || d.work_end ? `${time(d.work_start) ?? '—'} to ${time(d.work_end) ?? '—'}` : null}
          />
          <Row label="Weekly off" value={d.weekly_off?.length ? d.weekly_off.join(', ') : null} />
        </Section>

        <Section title="Education & experience">
          <Row label="Qualification" value={d.qualification} />
          <Row label="Experience" value={d.experience} />
        </Section>
      </View>
    );
  }

  // ---- Form -----------------------------------------------------------------
  function renderForm() {
    const field = (k: TextKey, label: string, extra?: Partial<React.ComponentProps<typeof PaperOutlinedField>>) => (
      <PaperOutlinedField
        label={label}
        value={(form[k] as string | null) ?? ''}
        onChangeText={(t) => set(k)(t as any)}
        maxLength={200}
        style={styles.input}
        {...(extra as any)}
      />
    );
    const chips = (k: TextKey, options: string[]) => (
      <View style={styles.chips}>
        {options.map((o) => {
          const on = form[k] === o;
          return (
            <Pressable key={o} onPress={() => pick(k, o)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    );

    return (
      <View>
        {!isOwner ? (
          <View style={styles.lockNote}>
            <Feather name="info" size={14} color={T.inkSoft} />
            <Text style={styles.lockText}>
              {unlockedEdit
                ? 'Make your changes and save. After that it locks again.'
                : 'You can fill this in only once. After you submit, only the boss can change it.'}
            </Text>
          </View>
        ) : null}

        <Section title="Personal">
          <DateField label="Date of birth" value={form.date_of_birth} onChange={set('date_of_birth')} allow="past" />
          <Text style={styles.label}>Gender</Text>
          {chips('gender', GENDERS)}
          <Text style={styles.label}>Blood group</Text>
          {chips('blood_group', BLOOD_GROUPS)}
          <Text style={styles.label}>Marital status</Text>
          {chips('marital_status', MARITAL)}
        </Section>

        <Section title="Contact">
          {field('phone', isOwner ? 'Phone' : 'Phone *', { keyboardType: 'phone-pad', maxLength: 30 })}
          {field('alt_phone', 'Other phone', { keyboardType: 'phone-pad', maxLength: 30 })}
          {field('personal_email', 'Personal email', { keyboardType: 'email-address', autoCapitalize: 'none' })}
          {field('current_address', 'Current address', { multiline: true, maxLength: 500 })}
          {field('permanent_address', 'Permanent address', { multiline: true, maxLength: 500 })}
        </Section>

        <Section title="Emergency contact">
          {field('emergency_name', 'Name', { maxLength: 120 })}
          {field('emergency_relation', 'Relation', { maxLength: 60 })}
          {field('emergency_phone', 'Phone', { keyboardType: 'phone-pad', maxLength: 30 })}
        </Section>

        <Section title="Family">
          {form.family.map((m, i) => (
            <View key={i} style={styles.familyEdit}>
              <View style={styles.familyHead}>
                <Text style={styles.familyIndex}>Person {i + 1}</Text>
                <Pressable
                  onPress={() => setForm((f) => ({ ...f, family: f.family.filter((_, j) => j !== i) }))}
                  hitSlop={8}
                  accessibilityLabel={`Remove person ${i + 1}`}
                >
                  <Feather name="x" size={16} color={T.inkSoft} />
                </Pressable>
              </View>
              <PaperOutlinedField label="Name" value={m.name ?? ''} onChangeText={(t) => setFamily(i, 'name', t)} maxLength={120} style={styles.input} />
              <View style={[styles.chips, { marginBottom: 8 }]}>
                {RELATIONS.map((r) => {
                  const on = m.relation === r;
                  return (
                    <Pressable key={r} onPress={() => setFamily(i, 'relation', on ? '' : r)} style={[styles.chip, styles.chipSmall, on && styles.chipOn]}>
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <PaperOutlinedField
                label="Phone"
                value={m.phone ?? ''}
                onChangeText={(t) => setFamily(i, 'phone', t)}
                keyboardType="phone-pad"
                maxLength={30}
                style={styles.input}
              />
              <PaperOutlinedField
                label="Occupation"
                value={m.occupation ?? ''}
                onChangeText={(t) => setFamily(i, 'occupation', t)}
                maxLength={120}
                style={styles.input}
              />
            </View>
          ))}
          <Pressable
            style={styles.addPerson}
            onPress={() => setForm((f) => ({ ...f, family: [...f.family, {}] }))}
            accessibilityRole="button"
          >
            <Feather name="plus" size={15} color={T.ink} />
            <Text style={styles.addPersonText}>Add family member</Text>
          </Pressable>
        </Section>

        <Section title="Work">
          <DateField label="Joining date" value={form.joining_date} onChange={set('joining_date')} allow="past" />
          <View style={styles.twoCol}>
            <TimeField label="Work starts" value={form.work_start} onChange={set('work_start')} style={{ flex: 1 }} />
            <TimeField label="Work ends" value={form.work_end} onChange={set('work_end')} style={{ flex: 1 }} />
          </View>
          <Text style={styles.label}>Weekly off</Text>
          <View style={styles.chips}>
            {WEEK_DAYS.map((dName) => {
              const on = form.weekly_off.includes(dName);
              return (
                <Pressable
                  key={dName}
                  onPress={() =>
                    set('weekly_off')(on ? form.weekly_off.filter((x) => x !== dName) : [...form.weekly_off, dName])
                  }
                  style={[styles.chip, styles.chipSmall, on && styles.chipOn]}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{dName}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title="Education & experience">
          {field('qualification', 'Highest qualification', { maxLength: 500 })}
          {field('experience', 'Past work experience', { multiline: true, maxLength: 1000 })}
        </Section>
      </View>
    );
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, phone }: { label: string; value: string | null | undefined; phone?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {value && phone ? (
        <Text style={[styles.value, styles.rowValue, { color: T.blue }]} onPress={() => Linking.openURL(telUrl(value))}>
          {value}
        </Text>
      ) : (
        <Text style={[styles.value, styles.rowValue]} selectable>
          {value || '—'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute },
  lockNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: T.soft,
    borderRadius: 12,
    padding: 12,
  },
  lockText: { flex: 1, fontFamily: 'Inter_500Medium', fontSize: 13, color: T.inkSoft, lineHeight: 18 },
  section: { marginTop: 18 },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11.5,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  rowLabel: { width: 130, fontFamily: 'Inter_500Medium', fontSize: 13.5, color: T.mute },
  rowValue: { flex: 1 },
  value: { fontFamily: 'Inter_500Medium', fontSize: 14.5, color: T.ink },
  link: { fontFamily: 'Inter_500Medium', fontSize: 13.5, color: T.blue, marginTop: 3 },
  familyCard: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.hairline },
  familyName: { fontFamily: 'Inter_600SemiBold', fontSize: 14.5, color: T.ink },
  familyRel: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.mute, marginTop: 2 },
  familyEdit: { backgroundColor: T.soft, borderRadius: 14, padding: 12, marginBottom: 10 },
  familyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  familyIndex: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  addPerson: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.soft2,
    borderStyle: 'dashed',
  },
  addPersonText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.ink },
  input: { marginBottom: 8 },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginBottom: 6, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  chip: { paddingHorizontal: 14, height: 36, borderRadius: 18, backgroundColor: T.soft, justifyContent: 'center' },
  chipSmall: { height: 32, paddingHorizontal: 12 },
  chipOn: { backgroundColor: T.charcoal },
  chipText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  chipTextOn: { color: T.white },
  twoCol: { flexDirection: 'row', gap: 10 },
  empty: { alignItems: 'center', gap: 6, paddingVertical: 28 },
  emptyTitle: { fontFamily: 'Inter_700Bold', fontSize: 16, color: T.ink, marginTop: 4 },
  emptySub: { fontFamily: 'Inter_400Regular', fontSize: 13.5, color: T.mute, textAlign: 'center' },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  footerRow: { flexDirection: 'row', gap: 8 },
  btn: { height: 48, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  deleteBtn: { width: 56, backgroundColor: T.coralSoft },
  softBtn: { paddingHorizontal: 20, backgroundColor: T.soft },
  softText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.ink },
  saveBtn: { flex: 1, backgroundColor: T.charcoal },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
