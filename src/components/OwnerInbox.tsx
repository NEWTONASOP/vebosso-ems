// ============================================================================
// VEBOSSO EMS — Owner Inbox ("Needs you now")
// Everything waiting on the owner, in one place:
//   check-ins · checkouts (incl. backfilled days) · leave requests ·
//   documents · salary requests · travel expenses · messages to the boss
// useOwnerInbox() gathers it and keeps it live; NeedsYouCard is the dashboard
// summary; OwnerInboxSheet lists every item with its action.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T, appShadow } from '../constants/theme';
import { Alert } from '../lib/alert';
import {
  documentKind,
  fetchAllPendingDocuments,
  fetchAllSalaryRequests,
  fetchOpenBossMessages,
  markBossMessageDone,
  markSalaryPaid,
  openDocumentFile,
  PendingDocument,
  reviewDocument,
  salaryMonthLabel,
  WaitingSalaryRequest,
} from '../lib/employeeRecords';
import { fetchAllSubmittedExpenses, formatAmount, markExpensePaid, WaitingExpense } from '../lib/expenses';
import { supabase } from '../lib/supabase';
import { formatWorkLogDateForMessage } from '../lib/workLogDates';
import { useAuthStore } from '../store/authStore';
import { useWorkStore } from '../store/workStore';
import { BossMessageWithSender, LeaveRequestWithProfile, WorkLogWithProfile } from '../types/database';
import { AnimatedPressable } from './AnimatedPressable';
import { SheetFrame } from './SheetFrame';
import { UserAvatar } from './UserAvatar';

// ============================================================================
// Data
// ============================================================================

export type InboxKind = 'checkin' | 'checkout' | 'leave' | 'document' | 'salary' | 'expense' | 'message';

const KINDS: {
  key: InboxKind;
  one: string;
  many: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  soft: string;
}[] = [
  { key: 'checkin', one: 'check-in', many: 'check-ins', icon: 'log-in', color: T.amber, soft: T.amberSoft },
  { key: 'checkout', one: 'checkout', many: 'checkouts', icon: 'log-out', color: T.violet, soft: T.violetSoft },
  { key: 'leave', one: 'leave request', many: 'leave requests', icon: 'sun', color: T.blue, soft: T.blueSoft },
  { key: 'document', one: 'document', many: 'documents', icon: 'file-text', color: T.coral, soft: T.coralSoft },
  { key: 'salary', one: 'salary request', many: 'salary requests', icon: 'credit-card', color: T.green, soft: T.greenSoft },
  { key: 'expense', one: 'travel expense', many: 'travel expenses', icon: 'navigation', color: T.violet, soft: T.violetSoft },
  { key: 'message', one: 'message', many: 'messages', icon: 'message-circle', color: T.inkSoft, soft: T.soft },
];

const loadExtras = async () => {
  const [docs, salary, expenses, messages] = await Promise.all([
    fetchAllPendingDocuments(),
    fetchAllSalaryRequests(),
    fetchAllSubmittedExpenses(),
    fetchOpenBossMessages(),
  ]);
  return { docs, salary, expenses, messages };
};

export interface OwnerInbox {
  checkIns: WorkLogWithProfile[];
  checkOuts: WorkLogWithProfile[];
  leaves: LeaveRequestWithProfile[];
  documents: PendingDocument[];
  salary: WaitingSalaryRequest[];
  expenses: WaitingExpense[];
  messages: BossMessageWithSender[];
  counts: Record<InboxKind, number>;
  total: number;
  refresh: () => Promise<void>;
}

/** Everything waiting on the owner, refreshed on focus and in realtime. */
export function useOwnerInbox(): OwnerInbox {
  const ownerId = useAuthStore((s) => s.profile?.id);
  const pendingApprovals = useWorkStore((s) => s.pendingApprovals);
  const leaveRequests = useWorkStore((s) => s.leaveRequests);
  const fetchLeaveRequests = useWorkStore((s) => s.fetchLeaveRequests);

  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [salary, setSalary] = useState<WaitingSalaryRequest[]>([]);
  const [expenses, setExpenses] = useState<WaitingExpense[]>([]);
  const [messages, setMessages] = useState<BossMessageWithSender[]>([]);

  const applyExtras = useCallback((res: Awaited<ReturnType<typeof loadExtras>>) => {
    if (res.docs.success) setDocuments(res.docs.data);
    if (res.salary.success) setSalary(res.salary.data);
    if (res.expenses.success) setExpenses(res.expenses.data);
    if (res.messages.success) setMessages(res.messages.data);
  }, []);

  const refresh = useCallback(async () => {
    const [extras] = await Promise.all([
      loadExtras(),
      ownerId ? fetchLeaveRequests('owner', ownerId) : Promise.resolve(),
    ]);
    applyExtras(extras);
  }, [applyExtras, fetchLeaveRequests, ownerId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadExtras().then((res) => active && applyExtras(res));
      if (ownerId) void fetchLeaveRequests('owner', ownerId);
      return () => {
        active = false;
      };
    }, [applyExtras, fetchLeaveRequests, ownerId])
  );

  // Check-ins/checkouts already stream into the work store; these are the rest.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 400);
    };
    const channel = supabase.channel(`owner_inbox_${Math.random().toString(36).slice(2, 8)}`);
    for (const table of ['employee_documents', 'salary_requests', 'expense_claims', 'boss_messages', 'leave_requests']) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return useMemo(() => {
    const checkIns = pendingApprovals.filter((w) => w.status === 'pending_approval');
    const checkOuts = pendingApprovals.filter((w) => w.status === 'pending_checkout');
    const leaves = leaveRequests.filter((l) => l.status === 'pending');
    const counts: Record<InboxKind, number> = {
      checkin: checkIns.length,
      checkout: checkOuts.length,
      leave: leaves.length,
      document: documents.length,
      salary: salary.length,
      expense: expenses.length,
      message: messages.length,
    };
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { checkIns, checkOuts, leaves, documents, salary, expenses, messages, counts, total, refresh };
  }, [pendingApprovals, leaveRequests, documents, salary, expenses, messages, refresh]);
}

// ============================================================================
// Dashboard card
// ============================================================================

export function NeedsYouCard({
  inbox,
  onOpen,
}: {
  inbox: OwnerInbox;
  onOpen: (filter: InboxKind | 'all') => void;
}) {
  const waiting = KINDS.filter((k) => inbox.counts[k.key] > 0);

  return (
    <View style={styles.card}>
      <View style={styles.cardGlow} />
      <View style={styles.cardHead}>
        <View style={styles.cardDot} />
        <Text style={styles.cardEyebrow}>Needs you now</Text>
        <View style={styles.cardTotal}>
          <Text style={styles.cardTotalText}>{inbox.total}</Text>
        </View>
      </View>

      {waiting.map((k) => {
        const n = inbox.counts[k.key];
        return (
          <Pressable
            key={k.key}
            onPress={() => onOpen(k.key)}
            style={({ pressed }) => [styles.cardLine, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel={`${n} ${n === 1 ? k.one : k.many}`}
          >
            <Feather name={k.icon} size={15} color="rgba(255,255,255,0.7)" />
            <Text style={styles.cardLineText}>
              <Text style={styles.cardLineCount}>{n}</Text> {n === 1 ? k.one : k.many}
            </Text>
            <Feather name="chevron-right" size={15} color="rgba(255,255,255,0.45)" />
          </Pressable>
        );
      })}

      <AnimatedPressable scaleTo={0.97} onPress={() => onOpen('all')} style={styles.cardCta}>
        <Text style={styles.cardCtaText}>Review all</Text>
        <Feather name="arrow-right" size={16} color={T.ink} />
      </AnimatedPressable>
    </View>
  );
}

// ============================================================================
// Review sheet
// ============================================================================

export function OwnerInboxSheet({
  inbox,
  initialFilter,
  onDismiss,
  onMessage,
}: {
  inbox: OwnerInbox;
  initialFilter: InboxKind | 'all';
  onDismiss: () => void;
  onMessage: (message: string) => void;
}) {
  const ownerId = useAuthStore((s) => s.profile?.id);
  const approveCheckIn = useWorkStore((s) => s.approveCheckIn);
  const rejectCheckIn = useWorkStore((s) => s.rejectCheckIn);
  const approveLeaveRequest = useWorkStore((s) => s.approveLeaveRequest);
  const rejectLeaveRequest = useWorkStore((s) => s.rejectLeaveRequest);

  const [filter, setFilter] = useState<InboxKind | 'all'>(initialFilter);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (
    key: string,
    action: () => Promise<{ success: boolean; error?: string }>,
    done: string,
    refresh = true,
  ) => {
    setBusy(key);
    const res = await action();
    if (res.success && refresh) await inbox.refresh();
    setBusy(null);
    onMessage(res.success ? done : res.error || 'Something went wrong');
  };

  if (!ownerId) return null;

  const show = (k: InboxKind) => (filter === 'all' || filter === k) && inbox.counts[k] > 0;
  const whenLabel = (date: string) => formatWorkLogDateForMessage(date) ?? format(parseISO(date), 'd MMM');

  const workLogItem = (w: WorkLogWithProfile, isCheckout: boolean) => (
    <InboxItem
      key={w.id}
      name={w.profiles?.full_name}
      avatar={w.profiles?.avatar_url}
      meta={`${isCheckout ? 'Checkout' : 'Check-in'} · ${whenLabel(w.date)}`}
      body={isCheckout ? w.day_report : w.check_in_plan}
      extra={
        <WorkLogPhotos
          groups={
            isCheckout
              ? [
                  { label: 'Checkout', paths: w.check_out_photos ?? [] },
                  { label: 'Check-in', paths: w.check_in_photos ?? [] },
                ]
              : [{ label: 'Check-in', paths: w.check_in_photos ?? [] }]
          }
        />
      }
      busy={busy === w.id}
      actions={[
        {
          label: 'Reject',
          tone: 'reject',
          onPress: () =>
            run(w.id, () => rejectCheckIn(w.id, ownerId, 'Please revise your plan'), 'Rejected', false),
        },
        {
          label: 'Approve',
          tone: 'approve',
          onPress: () => run(w.id, () => approveCheckIn(w.id, ownerId), 'Approved', false),
        },
      ]}
    />
  );

  const empty = filter !== 'all' && inbox.counts[filter] === 0;

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Needs you"
      subtitle={inbox.total === 0 ? 'All caught up' : `${inbox.total} waiting`}
      icon="inbox"
      iconColor={T.amber}
      iconBg={T.amberSoft}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipsWrap}
      >
        <Chip label="All" count={inbox.total} active={filter === 'all'} onPress={() => setFilter('all')} />
        {KINDS.map((k) => (
          <Chip
            key={k.key}
            label={k.many[0].toUpperCase() + k.many.slice(1)}
            count={inbox.counts[k.key]}
            active={filter === k.key}
            onPress={() => setFilter(k.key)}
          />
        ))}
      </ScrollView>

      {inbox.total === 0 || empty ? (
        <View style={styles.empty}>
          <Feather name="check-circle" size={22} color={T.green} />
          <Text style={styles.emptyText}>Nothing waiting here</Text>
        </View>
      ) : null}

      {show('checkin') ? <Section kind="checkin" /> : null}
      {show('checkin') ? inbox.checkIns.map((w) => workLogItem(w, false)) : null}

      {show('checkout') ? <Section kind="checkout" /> : null}
      {show('checkout') ? inbox.checkOuts.map((w) => workLogItem(w, true)) : null}

      {show('leave') ? <Section kind="leave" /> : null}
      {show('leave')
        ? inbox.leaves.map((l) => (
            <InboxItem
              key={l.id}
              name={l.profiles?.full_name}
              meta={`Leave · ${format(parseISO(l.date), 'EEE, d MMM')}`}
              body={l.reason}
              busy={busy === l.id}
              actions={[
                {
                  label: 'Reject',
                  tone: 'reject',
                  onPress: () => run(l.id, () => rejectLeaveRequest(l.id, ownerId), 'Leave rejected', false),
                },
                {
                  label: 'Approve',
                  tone: 'approve',
                  onPress: () => run(l.id, () => approveLeaveRequest(l.id, ownerId), 'Leave approved', false),
                },
              ]}
            />
          ))
        : null}

      {show('document') ? <Section kind="document" /> : null}
      {show('document')
        ? inbox.documents.map((d) => (
            <InboxItem
              key={d.id}
              name={d.person?.full_name}
              avatar={d.person?.avatar_url}
              meta={`${documentKind(d.mime_type) === 'image' ? 'Photo' : documentKind(d.mime_type).toUpperCase()} · ${formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}`}
              body={d.name}
              busy={busy === d.id}
              actions={[
                {
                  label: 'View',
                  tone: 'plain',
                  onPress: async () => {
                    const { data } = await supabase.storage.from('documents').createSignedUrl(d.file_path, 600);
                    if (!data?.signedUrl) return onMessage('Could not load this file');
                    const res = await openDocumentFile(d, data.signedUrl);
                    if (!res.success) onMessage(res.error);
                  },
                },
                {
                  label: 'Reject',
                  tone: 'reject',
                  onPress: () => run(d.id, () => reviewDocument(d, 'rejected', ownerId), 'Document rejected'),
                },
                {
                  label: 'Approve',
                  tone: 'approve',
                  onPress: () => run(d.id, () => reviewDocument(d, 'approved', ownerId), 'Document approved'),
                },
              ]}
            />
          ))
        : null}

      {show('salary') ? <Section kind="salary" /> : null}
      {show('salary')
        ? inbox.salary.map((r) => (
            <InboxItem
              key={r.id}
              name={r.person?.full_name}
              avatar={r.person?.avatar_url}
              meta={r.requested_at ? `Asked ${formatDistanceToNow(new Date(r.requested_at), { addSuffix: true })}` : 'Salary'}
              body={`Salary for ${salaryMonthLabel(r.month)}`}
              busy={busy === r.id}
              actions={[
                {
                  label: 'Mark as paid',
                  tone: 'approve',
                  onPress: () =>
                    Alert.alert(
                      'Mark as paid?',
                      `${r.person?.full_name ?? 'They'} will be told the ${salaryMonthLabel(r.month)} salary is paid.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Mark paid',
                          onPress: () =>
                            void run(r.id, () => markSalaryPaid(r.user_id, r.month, ownerId), 'Marked as paid'),
                        },
                      ],
                    ),
                },
              ]}
            />
          ))
        : null}

      {show('expense') ? <Section kind="expense" /> : null}
      {show('expense')
        ? inbox.expenses.map((x) => (
            <InboxItem
              key={x.id}
              name={x.person?.full_name}
              avatar={x.person?.avatar_url}
              meta={`${formatAmount(x.amount) ?? 'No amount'} · spent ${format(parseISO(x.spent_on), 'd MMM')}`}
              body={x.description || (x.photos?.length ? 'Receipt photos only' : null)}
              extra={
                <WorkLogPhotos bucket="expenses" groups={[{ label: 'Receipts', paths: x.photos ?? [] }]} />
              }
              busy={busy === x.id}
              actions={[
                {
                  label: 'Mark as paid',
                  tone: 'approve',
                  onPress: () =>
                    Alert.alert(
                      'Mark as paid?',
                      `${x.person?.full_name ?? 'They'} will be told this expense has been paid.`,
                      [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Mark paid',
                          onPress: () => void run(x.id, () => markExpensePaid(x, ownerId), 'Marked as paid'),
                        },
                      ],
                    ),
                },
              ]}
            />
          ))
        : null}

      {show('message') ? <Section kind="message" /> : null}
      {show('message')
        ? inbox.messages.map((m) => (
            <InboxItem
              key={m.id}
              name={m.sender?.full_name}
              meta={formatDistanceToNow(new Date(m.created_at), { addSuffix: true })}
              body={m.body}
              fullBody
              busy={busy === m.id}
              actions={[
                {
                  label: 'Done',
                  tone: 'approve',
                  onPress: () => run(m.id, () => markBossMessageDone(m), 'Marked done'),
                },
              ]}
            />
          ))
        : null}
    </SheetFrame>
  );
}

// ----------------------------------------------------------------------------

function Chip({
  label,
  count,
  active,
  onPress,
}: {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
        {count > 0 ? <Text style={[styles.chipCount, active && styles.chipTextActive]}> {count}</Text> : null}
      </Text>
    </Pressable>
  );
}

function Section({ kind }: { kind: InboxKind }) {
  const k = KINDS.find((x) => x.key === kind)!;
  return (
    <View style={styles.section}>
      <View style={[styles.sectionIcon, { backgroundColor: k.soft }]}>
        <Feather name={k.icon} size={13} color={k.color} />
      </View>
      <Text style={styles.sectionText}>{k.many[0].toUpperCase() + k.many.slice(1)}</Text>
    </View>
  );
}

/**
 * Check-in / checkout photos from the private `checkouts` bucket. Nothing is
 * fetched until the owner opens them, so a long inbox stays quick.
 */
function WorkLogPhotos({
  groups,
  bucket = 'checkouts',
}: {
  groups: { label: string; paths: string[] }[];
  bucket?: string;
}) {
  const withPhotos = groups.filter((g) => g.paths.length > 0);
  const total = withPhotos.reduce((n, g) => n + g.paths.length, 0);
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const [enlarged, setEnlarged] = useState<string | null>(null);

  if (total === 0) return null;

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !urls) {
      const paths = withPhotos.flatMap((g) => g.paths);
      const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 3600);
      const map: Record<string, string> = {};
      for (const item of data || []) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      setUrls(map);
    }
  };

  return (
    <View>
      <Pressable
        onPress={toggle}
        style={styles.photosToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Feather name="image" size={14} color={T.inkSoft} />
        <Text style={styles.photosToggleText}>Photos ({total})</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color={T.mute} />
      </Pressable>

      {open ? (
        urls ? (
          <View style={{ gap: 8, marginTop: 8 }}>
            {enlarged && urls[enlarged] ? (
              <Pressable onPress={() => setEnlarged(null)} accessibilityLabel="Close photo">
                <Image source={{ uri: urls[enlarged] }} style={styles.photoLarge} contentFit="contain" />
              </Pressable>
            ) : null}
            {withPhotos.map((g) => (
              <View key={g.label}>
                {withPhotos.length > 1 ? <Text style={styles.photoGroup}>{g.label}</Text> : null}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {g.paths.map((path) =>
                    urls[path] ? (
                      <Pressable
                        key={path}
                        onPress={() => setEnlarged(enlarged === path ? null : path)}
                        accessibilityRole="button"
                        accessibilityLabel={`${g.label} photo`}
                      >
                        <Image
                          source={{ uri: urls[path] }}
                          style={[styles.photoThumb, enlarged === path && styles.photoThumbActive]}
                          contentFit="cover"
                        />
                      </Pressable>
                    ) : null,
                  )}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : (
          <ActivityIndicator color={T.charcoal} style={{ marginTop: 10 }} />
        )
      ) : null}
    </View>
  );
}

type Tone = 'approve' | 'reject' | 'plain';

function InboxItem({
  name,
  avatar,
  meta,
  body,
  fullBody,
  extra,
  busy,
  actions,
}: {
  name?: string | null;
  avatar?: string | null;
  meta: string;
  body?: string | null;
  fullBody?: boolean;
  /** Anything between the text and the buttons, e.g. photos. */
  extra?: ReactNode;
  busy: boolean;
  actions: { label: string; tone: Tone; onPress: () => void }[];
}) {
  const displayName = name || 'Someone';
  return (
    <View style={styles.item}>
      <View style={styles.itemHead}>
        <UserAvatar
          uri={avatar}
          size={34}
          label={displayName.substring(0, 2).toUpperCase()}
          style={{ backgroundColor: T.soft }}
          labelStyle={styles.itemAvatarLabel}
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.itemName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.itemMeta} numberOfLines={1}>{meta}</Text>
        </View>
      </View>
      {body ? (
        <Text style={styles.itemBody} numberOfLines={fullBody ? undefined : 4}>{body}</Text>
      ) : null}
      {extra}
      <View style={styles.itemActions}>
        {busy ? (
          <ActivityIndicator color={T.charcoal} style={{ flex: 1, height: 38 }} />
        ) : (
          actions.map((a) => (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={({ pressed }) => [
                styles.itemBtn,
                a.tone === 'approve' ? styles.btnApprove : a.tone === 'reject' ? styles.btnReject : styles.btnPlain,
                pressed && { opacity: 0.8 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${a.label} — ${displayName}`}
            >
              <Text
                style={[
                  styles.itemBtnText,
                  a.tone === 'approve' ? { color: T.white } : a.tone === 'reject' ? { color: T.coral } : { color: T.ink },
                ]}
              >
                {a.label}
              </Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Dashboard card
  card: {
    backgroundColor: T.charcoal,
    borderRadius: 22,
    padding: 16,
    overflow: 'hidden',
    marginBottom: 12,
    ...appShadow,
  },
  cardGlow: {
    position: 'absolute',
    top: -58,
    right: -42,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.045)',
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  cardDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: T.onDarkAccent,
  },
  cardEyebrow: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.2,
  },
  cardTotal: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: T.onDarkAccent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTotalText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: T.charcoalDeep,
  },
  cardLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
  },
  cardLineText: {
    flex: 1,
    fontFamily: 'Inter_500Medium',
    fontSize: 15,
    color: 'rgba(255,255,255,0.85)',
  },
  cardLineCount: {
    fontFamily: 'Inter_700Bold',
    color: T.white,
  },
  cardCta: {
    marginTop: 10,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.white,
    paddingHorizontal: 18,
    height: 38,
    borderRadius: 999,
  },
  cardCtaText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },

  // Sheet
  chipsWrap: {
    flexGrow: 0,
    marginBottom: 6,
  },
  chips: {
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.soft,
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: T.charcoal,
  },
  chipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
  },
  chipCount: {
    fontFamily: 'Inter_700Bold',
    color: T.mute,
  },
  chipTextActive: {
    color: T.white,
  },
  empty: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32,
  },
  emptyText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.mute,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    marginBottom: 8,
  },
  sectionIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  item: {
    backgroundColor: T.soft,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  itemHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  itemAvatarLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: T.inkSoft,
  },
  itemName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: T.ink,
  },
  itemMeta: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    marginTop: 1,
  },
  itemBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.inkSoft,
    lineHeight: 20,
  },
  photosToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: T.card,
  },
  photosToggleText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
  },
  photoGroup: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  photoThumb: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: T.soft2,
  },
  photoThumbActive: {
    borderWidth: 2,
    borderColor: T.charcoal,
  },
  photoLarge: {
    width: '100%',
    height: 300,
    borderRadius: 14,
    backgroundColor: T.charcoalDeep,
  },
  itemActions: {
    flexDirection: 'row',
    gap: 8,
  },
  itemBtn: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnApprove: {
    backgroundColor: T.charcoal,
  },
  btnReject: {
    backgroundColor: T.card,
  },
  btnPlain: {
    backgroundColor: T.card,
  },
  itemBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
});
