// ============================================================================
// VEBOSSO EMS — Bill editor
// New bills and drafts save themselves as you type; a saved bill changes only
// when you tap Save. Once saved: share the PDF, send it to the client's
// WhatsApp, change status, move an estimate to a client bill, trash / restore.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { DatePickerModal, enGB, registerTranslation, TimePickerModal } from 'react-native-paper-dates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme as T, appSoftShadow, screenChrome } from '../../../constants/theme';
import { money, num } from '../../../lib/accounts';
import { Alert } from '../../../lib/alert';
import { useFieldChain } from '../../../lib/useFieldChain';
import { useKeyboardOverlap } from '../../../lib/useKeyboardHeight';
import { sendBillOnWhatsApp, shareBillPdf, waNumber } from '../../../lib/billPdf';
import {
  BILL_STATUS_TONE,
  billTotals,
  convertToClientBill,
  createDraft,
  deleteBillForever,
  fetchBill,
  fetchBillSettings,
  KIND_LABEL,
  removeBillImage,
  restoreBill,
  saveBill,
  setBillStatus,
  signBillImages,
  STATUS_LABEL,
  updateBill,
  uploadBillImage,
} from '../../../lib/bills';
import { BillPreviewSheet } from '../../../components/BillPreviewSheet';
import { useAuthStore } from '../../../store/authStore';
import { Bill, BillFields, BillKind, BillSettings, BillStatus } from '../../../types/database';

registerTranslation('en-GB', enGB);

/** "7:00 PM – 11:30 PM" ⇄ two times. */
type Clock = { hours: number; minutes: number };

const clockLabel = (c: Clock | null) => {
  if (!c) return null;
  const h12 = c.hours % 12 === 0 ? 12 : c.hours % 12;
  return `${h12}:${String(c.minutes).padStart(2, '0')} ${c.hours < 12 ? 'AM' : 'PM'}`;
};

function parseTiming(timing: string | null): [Clock | null, Clock | null] {
  const found = [...String(timing ?? '').matchAll(/(\d{1,2}):(\d{2})\s*(AM|PM)/gi)].map((m) => {
    let h = Number(m[1]) % 12;
    if (m[3].toUpperCase() === 'PM') h += 12;
    return { hours: h, minutes: Number(m[2]) };
  });
  return [found[0] ?? null, found[1] ?? null];
}

const joinTiming = (from: Clock | null, to: Clock | null) =>
  [clockLabel(from), clockLabel(to)].filter(Boolean).join(' – ');

const emptyForm = (kind: BillKind): BillFields => ({
  kind,
  prepared_by: '',
  client_name: '',
  venue: '',
  function_date: null,
  guests: '',
  hall_floor: '',
  event_type: '',
  timing: '',
  phone: '',
  alt_phone: '',
  address: '',
  items: [{ description: '' }],
  total: null,
  advance: null,
  balance: null,
  terms: '',
  images: [],
});

const fromBill = (b: Bill): BillFields => ({
  kind: b.kind,
  prepared_by: b.prepared_by ?? '',
  client_name: b.client_name ?? '',
  venue: b.venue ?? '',
  function_date: b.function_date,
  guests: b.guests ?? '',
  hall_floor: b.hall_floor ?? '',
  event_type: b.event_type ?? '',
  timing: b.timing ?? '',
  phone: b.phone ?? '',
  alt_phone: b.alt_phone ?? '',
  address: b.address ?? '',
  items: b.items?.length ? b.items.map((i) => ({ description: i.description ?? '' })) : [{ description: '' }],
  total: b.total,
  advance: b.advance,
  balance: b.balance,
  terms: b.terms ?? '',
  images: b.images ?? [],
});

/** Has the owner typed anything worth keeping as a draft? */
const hasContent = (f: BillFields, defaults: BillFields) =>
  (Object.keys(f) as (keyof BillFields)[]).some((k) => {
    if (k === 'kind' || k === 'prepared_by' || k === 'terms') return false;
    if (k === 'items') return f.items.some((i) => i.description.trim());
    if (k === 'images') return f.images.length > 0;
    return JSON.stringify(f[k] ?? '') !== JSON.stringify(defaults[k] ?? '');
  });

export default function BillEditorScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { ref: keyboardRef, overlap: keyboardInset } = useKeyboardOverlap();
  const params = useLocalSearchParams<{ id: string; kind?: string }>();
  const isNew = params.id === 'new';
  const profileName = useAuthStore((s) => s.profile?.full_name ?? '');

  const [bill, setBill] = useState<Bill | null>(null);
  const [settings, setSettings] = useState<BillSettings | null>(null);
  const [form, setForm] = useState<BillFields>(() => emptyForm(params.kind === 'client' ? 'client' : 'estimate'));
  const [defaults, setDefaults] = useState<BillFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [draftState, setDraftState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [snack, setSnack] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<'date' | 'from' | 'to' | null>(null);
  // The keyboard's Next key moves along the form.
  const { reg, next: focusNext } = useFieldChain();

  // A snapshot of the bill as it stands when Preview is tapped.
  const [preview, setPreview] = useState<Bill | null>(null);

  const isDraft = !bill || bill.status === 'draft';
  // Latest row for async callbacks (autosave, image upload) without re-subscribing.
  const billRef = useRef<Bill | null>(null);
  useEffect(() => {
    billRef.current = bill;
  }, [bill]);
  const creating = useRef<Promise<Bill | null> | null>(null);

  /** Back to the Bills list — never out to another tab. */
  const backToList = useCallback(() => {
    const routes = navigation.getState()?.routes ?? [];
    if (routes.length > 1) navigation.goBack();
    else router.replace('/(owner)/bills' as any);
  }, [navigation, router]);

  // ---- Load --------------------------------------------------------------
  useEffect(() => {
    let active = true;
    (async () => {
      const s = await fetchBillSettings();
      const settingsData = s.success ? s.data : null;
      if (isNew) {
        const f = {
          ...emptyForm(params.kind === 'client' ? 'client' : 'estimate'),
          prepared_by: profileName,
          terms: settingsData?.default_terms ?? '',
        };
        if (!active) return;
        setSettings(settingsData);
        setForm(f);
        setDefaults(f);
        setLoading(false);
        return;
      }
      const res = await fetchBill(params.id);
      if (!active) return;
      setSettings(settingsData);
      if (!res.success) {
        setError(res.error);
        setLoading(false);
        return;
      }
      const f = fromBill(res.data);
      setBill(res.data);
      setForm(f);
      setDefaults(f);
      setImageUrls(await signBillImages(res.data.images ?? []));
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [isNew, params.id, params.kind, profileName]);

  // ---- Drafts: write as you type -----------------------------------------
  /** The row for this bill, creating the draft on first use. */
  const ensureBill = useCallback(async (f: BillFields): Promise<Bill | null> => {
    if (billRef.current) return billRef.current;
    if (!creating.current) {
      creating.current = createDraft(f).then((res) => {
        if (!res.success) {
          setError(res.error);
          creating.current = null;
          return null;
        }
        setBill(res.data);
        billRef.current = res.data;
        return res.data;
      });
    }
    return creating.current;
  }, []);

  useEffect(() => {
    if (!dirty || !isDraft || !defaults) return;
    if (!billRef.current && !hasContent(form, defaults)) return;
    const timer = setTimeout(async () => {
      setDraftState('saving');
      const existing = billRef.current;
      if (!existing) {
        await ensureBill(form);
      } else {
        const res = await updateBill(existing.id, form);
        if (res.success) setBill(res.data);
      }
      setDraftState('saved');
      setDirty(false);
    }, 900);
    return () => clearTimeout(timer);
  }, [form, dirty, isDraft, defaults, ensureBill]);

  // Leaving a saved bill with unsaved edits asks first.
  useEffect(() => {
    const unsub = navigation.addListener('beforeRemove' as any, (e: any) => {
      if (!dirty || isDraft) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'Your edits to this bill haven’t been saved.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ]);
    });
    return unsub;
  }, [navigation, dirty, isDraft]);

  const set = <K extends keyof BillFields>(k: K, v: BillFields[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setDirty(true);
    if (error) setError('');
  };

  // ---- Items & money -------------------------------------------------------
  const setItem = (i: number, patch: Partial<BillFields['items'][number]>) =>
    set(
      'items',
      form.items.map((it, j) => (j === i ? { ...it, ...patch } : it))
    );
  const addItem = () => set('items', [...form.items, { description: '' }]);
  const removeItem = (i: number) =>
    set('items', form.items.length === 1 ? [{ description: '' }] : form.items.filter((_, j) => j !== i));

  const totals = billTotals(form);
  const [timeFrom, timeTo] = parseTiming(form.timing);

  // ---- Images ------------------------------------------------------------
  const addImages = async (source: 'library' | 'camera') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return setError('Permission is needed to add images');
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsMultipleSelection: true, quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;

      setBusy('images');
      const target = await ensureBill(form);
      if (!target) return;
      const added: string[] = [];
      for (const a of res.assets) {
        const up = await uploadBillImage(target.id, a.uri);
        if (up.success) added.push(up.data);
        else setError(up.error);
      }
      if (added.length) {
        const images = [...form.images, ...added];
        // Images are stored straight away so files never go unreferenced.
        const saved = await updateBill(target.id, { images });
        if (saved.success) setBill(saved.data);
        setForm((f) => ({ ...f, images }));
        setDefaults((d) => (d ? { ...d, images } : d));
        setImageUrls({ ...imageUrls, ...(await signBillImages(added)) });
      }
    } finally {
      setBusy(null);
    }
  };

  const removeImage = (path: string) => {
    Alert.alert('Remove image?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const images = form.images.filter((p) => p !== path);
          if (bill) {
            const saved = await updateBill(bill.id, { images });
            if (saved.success) setBill(saved.data);
          }
          await removeBillImage(path);
          setForm((f) => ({ ...f, images }));
          setDefaults((d) => (d ? { ...d, images } : d));
        },
      },
    ]);
  };

  // ---- Save & actions ------------------------------------------------------
  const save = async () => {
    if (!form.client_name?.trim()) return setError('Enter the Bride and Groom name');
    setSaving(true);
    const target = await ensureBill(form);
    if (!target) return setSaving(false);
    const res = await saveBill(target.id, form, target.status === 'trash' ? 'trash' : target.status);
    setSaving(false);
    if (!res.success) return setError(res.error);
    setBill(res.data);
    setDefaults(form);
    setDirty(false);
    setSnack(target.status === 'draft' ? `Saved as ${res.data.number}` : 'Changes saved');
  };

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setError('');
    try {
      await fn();
      if (done) setSnack(done);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong');
    } finally {
      setBusy(null);
    }
  };

  const unsavedBeforeShare = () => {
    if (dirty && !isDraft) {
      setError('Save your changes first');
      return true;
    }
    return false;
  };

  const openPreview = () => {
    if (!settings) return setError('Bill settings are still loading');
    const now = new Date().toISOString();
    const base: Bill = bill ?? {
      id: 'preview',
      status: 'draft',
      prev_status: null,
      number: null,
      estimate_number: null,
      created_by: null,
      created_at: now,
      updated_at: now,
      ...form,
    };
    setPreview({ ...base, ...form });
  };

  const share = () =>
    !unsavedBeforeShare() && bill && settings && act('share', () => shareBillPdf({ ...bill, ...form, items: form.items }, settings));

  const whatsapp = () => {
    if (unsavedBeforeShare() || !bill || !settings) return;
    const numbers = [form.phone, form.alt_phone].filter((p): p is string => !!p && !!waNumber(p));
    if (numbers.length === 0) return setError('Add a valid phone number to send on WhatsApp');
    const send = (p: string) => act('wa', () => sendBillOnWhatsApp({ ...bill, ...form }, settings, p));
    if (numbers.length === 1) return send(numbers[0]);
    Alert.alert('Send to which number?', undefined, [
      ...numbers.map((p) => ({ text: p, onPress: () => void send(p) })),
      { text: 'Cancel', style: 'cancel' as const },
    ]);
  };

  const changeStatus = (s: BillStatus) =>
    bill &&
    act(
      'status',
      async () => {
        const res = await setBillStatus(bill.id, s);
        if (!res.success) throw new Error(res.error);
        setBill(res.data);
      },
      `Marked ${STATUS_LABEL[s].toLowerCase()}`
    );

  const convert = () => {
    if (!bill || unsavedBeforeShare()) return;
    Alert.alert('Move to client bills?', 'This estimate becomes a client bill with a new bill number.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Move',
        onPress: () =>
          void act('convert', async () => {
            const res = await convertToClientBill(bill.id);
            if (!res.success) throw new Error(res.error);
            setBill(res.data);
            setForm((f) => ({ ...f, kind: 'client' }));
            setDefaults((d) => (d ? { ...d, kind: 'client' } : d));
            setSnack(`Now client bill ${res.data.number}`);
          }),
      },
    ]);
  };

  const trash = () =>
    bill &&
    Alert.alert('Move to trash?', 'You can restore it from Trash later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Trash',
        style: 'destructive',
        onPress: () =>
          void act('trash', async () => {
            const res = await setBillStatus(bill.id, 'trash');
            if (!res.success) throw new Error(res.error);
            setDirty(false);
            backToList();
          }),
      },
    ]);

  const restore = () =>
    bill &&
    act(
      'restore',
      async () => {
        const res = await restoreBill(bill);
        if (!res.success) throw new Error(res.error);
        setBill(res.data);
      },
      'Restored'
    );

  const deleteForever = () =>
    bill &&
    Alert.alert('Delete for good?', 'This bill, its images and its PDF are removed permanently.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          void act('delete', async () => {
            const res = await deleteBillForever(bill);
            if (!res.success) throw new Error(res.error);
            setDirty(false);
            backToList();
          }),
      },
    ]);

  // ---- Render ------------------------------------------------------------
  if (loading) {
    return (
      <View style={[screenChrome.root, { justifyContent: 'center' }]}>
        <ActivityIndicator color={T.charcoal} />
      </View>
    );
  }

  const status = bill?.status ?? 'draft';
  const tone = BILL_STATUS_TONE[status];
  const saved = !!bill && status !== 'draft';
  const inTrash = status === 'trash';

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View style={styles.titleRow}>
          <Pressable onPress={backToList} style={styles.back} hitSlop={8} accessibilityLabel="Back to bills">
            <Feather name="chevron-left" size={24} color={T.ink} />
          </Pressable>
          <View style={{ flexShrink: 1 }}>
            <Text style={styles.title} numberOfLines={1}>
              {bill?.number ?? `New ${KIND_LABEL[form.kind].toLowerCase()}`}
            </Text>
            <View style={styles.subRow}>
              <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                <Text style={[styles.statusPillText, { color: tone.color }]}>
                  {form.kind === 'estimate' && saved && !inTrash ? 'Estimate' : STATUS_LABEL[status]}
                </Text>
              </View>
              {isDraft ? (
                <Text style={styles.draftNote}>
                  {draftState === 'saving' ? 'Saving draft…' : draftState === 'saved' ? 'Draft saved' : 'Saves as you type'}
                </Text>
              ) : bill?.estimate_number ? (
                <Text style={styles.draftNote}>from {bill.estimate_number}</Text>
              ) : null}
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconBtn} onPress={openPreview} accessibilityLabel="Preview bill">
            <Feather name="eye" size={16} color={T.ink} />
          </Pressable>
          {bill ? (
            inTrash ? (
              <Pressable style={styles.iconBtn} onPress={deleteForever} accessibilityLabel="Delete for good">
                <Feather name="trash-2" size={16} color={T.coral} />
              </Pressable>
            ) : (
              <Pressable style={styles.iconBtn} onPress={trash} accessibilityLabel="Move to trash">
                <Feather name="trash-2" size={16} color={T.inkSoft} />
              </Pressable>
            )
          ) : null}
        </View>
      </View>

      <View ref={keyboardRef} style={{ flex: 1, paddingBottom: keyboardInset }}>
        <ScrollView
          contentContainerStyle={[styles.body, { paddingBottom: 190 + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {inTrash ? (
            <Pressable style={styles.trashBanner} onPress={restore}>
              <Feather name="rotate-ccw" size={15} color={T.coral} />
              <Text style={styles.trashText}>In trash · tap to restore</Text>
            </Pressable>
          ) : null}

          {/* Type — only while it's still a draft */}
          {isDraft ? (
            <View style={styles.segment}>
              {(['estimate', 'client'] as const).map((k) => (
                <Pressable
                  key={k}
                  onPress={() => set('kind', k)}
                  style={[styles.segBtn, form.kind === k && styles.segActive]}
                >
                  <Text style={[styles.segText, form.kind === k && styles.segTextActive]}>{KIND_LABEL[k]}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {/* Saved: actions */}
          {saved && !inTrash ? (
            <View style={styles.actionsCard}>
              <View style={styles.actionsRow}>
                <ActionBtn icon="eye" label="Preview" onPress={openPreview} />
                <ActionBtn icon="share-2" label="Share PDF" busy={busy === 'share'} onPress={share} />
                <ActionBtn icon="message-circle" label="WhatsApp" busy={busy === 'wa'} onPress={whatsapp} tint={T.green} />
                {form.kind === 'estimate' ? (
                  <ActionBtn icon="arrow-right-circle" label="To client bill" busy={busy === 'convert'} onPress={convert} tint={T.violet} />
                ) : null}
              </View>
              {form.kind === 'client' ? (
                <View style={styles.statusRow}>
                  {(['pending', 'done', 'completed'] as const).map((s) => {
                    const active = status === s;
                    const c = BILL_STATUS_TONE[s];
                    return (
                      <Pressable
                        key={s}
                        onPress={() => !active && changeStatus(s)}
                        style={[styles.statusBtn, active && { backgroundColor: c.bg, borderColor: c.color }]}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: active }}
                      >
                        <Text style={[styles.statusBtnText, active && { color: c.color }]}>{STATUS_LABEL[s]}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}

          <Section title="Details">
            <Field label="Prepared By" value={form.prepared_by} onChange={(v) => set('prepared_by', v)} inputRef={reg('prepared_by')} onNext={focusNext('client_name')} />
            <Field label="Bride and Groom Name *" value={form.client_name} onChange={(v) => set('client_name', v)} inputRef={reg('client_name')} onNext={focusNext('venue')} />
            <Field label="Venue" value={form.venue} onChange={(v) => set('venue', v)} inputRef={reg('venue')} onNext={focusNext('guests')} />
            <PickerField
              label="Date of Function"
              icon="calendar"
              value={form.function_date ? format(parseISO(form.function_date), 'EEEE, d MMMM yyyy') : null}
              placeholder="Pick a date"
              onPress={() => setPicker('date')}
              onClear={form.function_date ? () => set('function_date', null) : undefined}
            />
            <Field label="No. of Guests Expected" value={form.guests} onChange={(v) => set('guests', v)} keyboardType="numbers-and-punctuation" inputRef={reg('guests')} onNext={focusNext('hall_floor')} />
            <Field label="Hall/Floor" value={form.hall_floor} onChange={(v) => set('hall_floor', v)} inputRef={reg('hall_floor')} onNext={focusNext('event_type')} />
            <Field label="Event Type" value={form.event_type} onChange={(v) => set('event_type', v)} inputRef={reg('event_type')} onNext={focusNext('phone')} />
            <View style={styles.field}>
              <Text style={styles.label}>Timing</Text>
              <View style={styles.timeRow}>
                <Pressable style={styles.pick} onPress={() => setPicker('from')} accessibilityLabel="Start time">
                  <Feather name="clock" size={15} color={T.inkSoft} />
                  <Text style={[styles.pickText, !timeFrom && styles.pickPlaceholder]}>{clockLabel(timeFrom) ?? 'From'}</Text>
                </Pressable>
                <Feather name="arrow-right" size={15} color={T.mute} />
                <Pressable style={styles.pick} onPress={() => setPicker('to')} accessibilityLabel="End time">
                  <Feather name="clock" size={15} color={T.inkSoft} />
                  <Text style={[styles.pickText, !timeTo && styles.pickPlaceholder]}>{clockLabel(timeTo) ?? 'To'}</Text>
                </Pressable>
                {form.timing ? (
                  <Pressable onPress={() => set('timing', null)} hitSlop={8} accessibilityLabel="Clear timing">
                    <Feather name="x" size={16} color={T.mute} />
                  </Pressable>
                ) : null}
              </View>
            </View>
            <Field label="Phone Number" value={form.phone} onChange={(v) => set('phone', v)} keyboardType="phone-pad" inputRef={reg('phone')} onNext={focusNext('alt_phone')} />
            <Field label="Alternate Contact Number" value={form.alt_phone} onChange={(v) => set('alt_phone', v)} keyboardType="phone-pad" inputRef={reg('alt_phone')} onNext={focusNext('address')} />
            <Field label="Address" value={form.address} onChange={(v) => set('address', v)} multiline inputRef={reg('address')} />
          </Section>

          <Section title={`Services by ${settings?.business_name ?? 'VEBOSSO'}`}>
            {form.items.map((it, i) => (
              <View key={i} style={styles.itemRow}>
                <Text style={styles.itemNo}>{i + 1}</Text>
                <TextInput
                  value={it.description}
                  onChangeText={(v) => setItem(i, { description: v })}
                  style={[styles.input, styles.itemDesc]}
                  multiline
                />
                <Pressable onPress={() => removeItem(i)} hitSlop={6} style={styles.itemRemove} accessibilityLabel="Remove row">
                  <Feather name="x" size={15} color={T.mute} />
                </Pressable>
              </View>
            ))}
            <Pressable onPress={addItem} style={styles.addRow}>
              <Feather name="plus" size={15} color={T.ink} />
              <Text style={styles.addRowText}>Add service</Text>
            </Pressable>
          </Section>

          <Section title="Amount">
            <MoneyRow
              inputRef={reg('total')}
              onNext={focusNext('advance')}
              label="Total Amount"
              value={form.total === null || form.total === undefined ? '' : String(form.total)}
              onChange={(v) => set('total', v === '' ? null : (v as unknown as number))}
            />
            <MoneyRow
              inputRef={reg('advance')}
              onNext={focusNext('balance')}
              label="Advance"
              value={form.advance === null || form.advance === undefined ? '' : String(form.advance)}
              onChange={(v) => set('advance', v === '' ? null : (v as unknown as number))}
            />
            <MoneyRow
              inputRef={reg('balance')}
              label="Balance"
              value={form.balance === null || form.balance === undefined ? '' : String(form.balance)}
              onChange={(v) => set('balance', v === '' ? null : (v as unknown as number))}
            />
          </Section>

          <Section title="Terms & conditions">
            <TextInput
              value={form.terms ?? ''}
              onChangeText={(v) => set('terms', v)}
              style={[styles.input, styles.terms]}
              multiline
              textAlignVertical="top"
            />
          </Section>

          <Section title={`Images${form.images.length ? ` · ${form.images.length}` : ''}`}>
            <View style={styles.images}>
              {form.images.map((p) => (
                <View key={p}>
                  {imageUrls[p] ? (
                    <Image source={{ uri: imageUrls[p] }} style={styles.thumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.thumb, { backgroundColor: T.soft2 }]} />
                  )}
                  <Pressable style={styles.thumbX} onPress={() => removeImage(p)} hitSlop={6} accessibilityLabel="Remove image">
                    <Feather name="x" size={12} color={T.white} />
                  </Pressable>
                </View>
              ))}
              <Pressable style={styles.addImg} onPress={() => addImages('library')} disabled={busy === 'images'}>
                {busy === 'images' ? (
                  <ActivityIndicator color={T.charcoal} />
                ) : (
                  <>
                    <Feather name="image" size={18} color={T.inkSoft} />
                    <Text style={styles.addImgText}>Photos</Text>
                  </>
                )}
              </Pressable>
              <Pressable style={styles.addImg} onPress={() => addImages('camera')} disabled={busy === 'images'}>
                <Feather name="camera" size={18} color={T.inkSoft} />
                <Text style={styles.addImgText}>Camera</Text>
              </Pressable>
            </View>
          </Section>
        </ScrollView>
      </View>

      {preview && settings ? (
        <BillPreviewSheet
          bill={preview}
          settings={settings}
          onDismiss={() => setPreview(null)}
          onShare={
            saved && !inTrash && !dirty
              ? () => {
                  setPreview(null);
                  share();
                }
              : undefined
          }
          shareHint={!saved ? 'Save the bill to share it' : dirty ? 'Save changes to share' : undefined}
        />
      ) : null}

      <DatePickerModal
        locale="en-GB"
        mode="single"
        visible={picker === 'date'}
        date={form.function_date ? parseISO(form.function_date) : undefined}
        onDismiss={() => setPicker(null)}
        onConfirm={({ date }) => {
          setPicker(null);
          if (date) set('function_date', format(date, 'yyyy-MM-dd'));
        }}
        label="Date of function"
        saveLabel="Done"
      />
      <TimePickerModal
        locale="en-GB"
        visible={picker === 'from' || picker === 'to'}
        label={picker === 'to' ? 'Ends at' : 'Starts at'}
        hours={(picker === 'to' ? timeTo : timeFrom)?.hours ?? (picker === 'to' ? 23 : 19)}
        minutes={(picker === 'to' ? timeTo : timeFrom)?.minutes ?? 0}
        use24HourClock={false}
        onDismiss={() => setPicker(null)}
        onConfirm={(c) => {
          const which = picker;
          setPicker(null);
          set('timing', which === 'to' ? joinTiming(timeFrom, c) : joinTiming(c, timeTo));
        }}
        confirmLabel="Done"
        cancelLabel="Cancel"
      />

      {/* Save bar */}
      <View style={[styles.saveBar, { paddingBottom: 96 + insets.bottom }]}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.saveRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.saveTotal}>₹{money(totals.total)}</Text>
            <Text style={styles.saveSub}>
              Advance ₹{money(totals.advance)} · Balance ₹{money(totals.balance)}
            </Text>
          </View>
          <Pressable
            style={[styles.saveBtn, !isDraft && !dirty && styles.saveBtnIdle]}
            onPress={save}
            disabled={saving || (!isDraft && !dirty)}
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator color={T.white} />
            ) : (
              <Text style={styles.saveText}>{isDraft ? `Save ${KIND_LABEL[form.kind].toLowerCase()}` : dirty ? 'Save changes' : 'Saved'}</Text>
            )}
          </Pressable>
        </View>
      </View>

      <Snackbar visible={!!snack} onDismiss={() => setSnack('')} duration={3000} wrapperStyle={{ marginBottom: 170 }}>
        {snack}
      </Snackbar>
    </View>
  );
}

// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline,
  hint,
  inputRef,
  onNext,
}: {
  label: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'phone-pad' | 'numbers-and-punctuation';
  multiline?: boolean;
  hint?: string;
  inputRef?: (el: TextInput | null) => void;
  /** Where the keyboard's Next key goes. Without it the key reads Done. */
  onNext?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value ?? ''}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={T.mute}
        style={[styles.input, multiline && styles.multi]}
        keyboardType={keyboardType}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        ref={inputRef}
        // Single-line: Next moves on, Done closes the keyboard. Multi-line
        // boxes keep Enter as a new line.
        returnKeyType={multiline ? 'default' : onNext ? 'next' : 'done'}
        submitBehavior={multiline ? 'newline' : onNext ? 'submit' : 'blurAndSubmit'}
        onSubmitEditing={multiline ? undefined : onNext}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function PickerField({
  label,
  icon,
  value,
  placeholder,
  onPress,
  onClear,
}: {
  label: string;
  icon: keyof typeof Feather.glyphMap;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.timeRow}>
        <Pressable style={[styles.pick, { flex: 1 }]} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
          <Feather name={icon} size={15} color={T.inkSoft} />
          <Text style={[styles.pickText, !value && styles.pickPlaceholder]}>{value ?? placeholder}</Text>
        </Pressable>
        {onClear ? (
          <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
            <Feather name="x" size={16} color={T.mute} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function MoneyRow({
  label,
  value,
  onChange,
  editable = true,
  hint,
  inputRef,
  onNext,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable?: boolean;
  hint?: string;
  inputRef?: (el: TextInput | null) => void;
  onNext?: () => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.moneyRow}>
        <Text style={styles.rupee}>₹</Text>
        <TextInput
          value={editable ? value : money(num(value))}
          onChangeText={(v) => onChange(v.replace(/[^0-9.]/g, ''))}
          editable={editable}
          style={[styles.input, { flex: 1 }, !editable && styles.inputLocked]}
          keyboardType="decimal-pad"
          ref={inputRef}
          returnKeyType={onNext ? 'next' : 'done'}
          submitBehavior={onNext ? 'submit' : 'blurAndSubmit'}
          onSubmitEditing={onNext}
        />
      </View>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function ActionBtn({
  icon,
  label,
  onPress,
  busy,
  tint = T.ink,
}: {
  icon: keyof typeof Feather.glyphMap;
  label: string;
  onPress: () => void;
  busy?: boolean;
  tint?: string;
}) {
  return (
    <Pressable style={styles.actionBtn} onPress={onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? <ActivityIndicator color={tint} /> : <Feather name={icon} size={18} color={tint} />}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  back: { width: 32, height: 40, justifyContent: 'center', marginLeft: -8 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 22, color: T.ink, letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusPillText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  draftNote: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute },
  headerActions: { flexDirection: 'row', gap: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...appSoftShadow,
  },
  body: { paddingHorizontal: 16, gap: 14, maxWidth: 700, width: '100%', alignSelf: 'center' },
  trashBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.coralSoft,
    borderRadius: 14,
    padding: 12,
  },
  trashText: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.coral },
  segment: { flexDirection: 'row', backgroundColor: T.soft2, borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segActive: { backgroundColor: T.card, ...appSoftShadow },
  segText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.inkSoft },
  segTextActive: { color: T.ink },
  actionsCard: { backgroundColor: T.card, borderRadius: 20, padding: 10, gap: 10, ...appSoftShadow },
  actionsRow: { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1,
    height: 64,
    borderRadius: 16,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: T.ink },
  statusRow: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: T.soft2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13, color: T.inkSoft },
  section: { gap: 8 },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 4,
  },
  sectionCard: { backgroundColor: T.card, borderRadius: 20, padding: 14, ...appSoftShadow },
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
  inputLocked: { color: T.inkSoft, backgroundColor: T.bg },
  multi: { minHeight: 76, paddingTop: 12 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 4 },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  itemNo: { width: 16, fontFamily: 'Inter_700Bold', fontSize: 13, color: T.mute, textAlign: 'center' },
  itemDesc: { flex: 1, paddingTop: 12, paddingBottom: 12 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pick: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pickText: { fontFamily: 'Inter_500Medium', fontSize: 15, color: T.ink },
  pickPlaceholder: { color: T.mute },
  itemRemove: { width: 24, alignItems: 'center' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: T.soft2,
  },
  addRowText: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.ink },
  moneyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rupee: { fontFamily: 'Inter_700Bold', fontSize: 18, color: T.inkSoft },
  balanceLabel: { fontFamily: 'Inter_600SemiBold', fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  balanceValue: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, color: T.white },
  terms: { minHeight: 120, paddingTop: 12 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  thumb: { width: 88, height: 88, borderRadius: 14 },
  thumbX: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImg: {
    width: 88,
    height: 88,
    borderRadius: 14,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addImgText: { fontFamily: 'Inter_500Medium', fontSize: 12, color: T.inkSoft },
  saveBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: T.card,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.hairline,
    ...appSoftShadow,
  },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 700, width: '100%', alignSelf: 'center' },
  saveTotal: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, color: T.ink },
  saveSub: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 1 },
  saveBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnIdle: { backgroundColor: T.soft2 },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8, textAlign: 'center' },
});
