// ============================================================================
// VEBOSSO EMS — Owner Dashboard
// Soft iOS look, plain language, one job per section
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { DepartmentsSheet } from '../../components/DepartmentsSheet';
import { Chevron, DropdownBody } from '../../components/Dropdown';
import { InboxKind, NeedsYouCard, OwnerInboxSheet, useOwnerInbox } from '../../components/OwnerInbox';
import { ReasonSheet } from '../../components/ReasonSheet';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberCard } from '../../components/MemberCard';
import { MemberDialog } from '../../components/MemberActionsModal';
import { OwnerMemberMenu } from '../../components/OwnerMemberMenu';
import { isAppVisible } from '../../lib/appActive';
import { DepartmentData, fetchDepartments } from '../../lib/departments';
import { sortMembersByLiveStatus } from '../../lib/teamSort';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useWorkStore } from '../../store/workStore';
import { Profile, WorkLogWithProfile } from '../../types/database';
import { formatWorkLogDateForMessage } from '../../lib/workLogDates';
import { AppTheme as T, appShadow as shadow } from '../../constants/theme';

const ENTER = Easing.bezier(0.22, 1, 0.36, 1);

export default function OwnerDashboard() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile } = useAuthStore();
  const {
    stats,
    pendingApprovals,
    isLoadingApprovals,
    approvalsError,
    teamMembers,
    isLoadingTeam,
    teamError,
    memberLiveStatus,
    fetchStats,
    fetchPendingApprovals,
    fetchSettings,
    fetchTeamMembers,
    refreshMemberLiveStatus,
    approveCheckIn,
    rejectCheckIn,
    subscribeToRealtime,
    unsubscribeFromRealtime,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);
  const [menuMember, setMenuMember] = React.useState<Profile | null>(null);
  const [menuDialog, setMenuDialog] = React.useState<MemberDialog | null>(null);
  const [departments, setDepartments] = React.useState<DepartmentData>({ departments: [], memberOf: {} });
  const [managingDepartments, setManagingDepartments] = React.useState(false);
  const [teamOpen, setTeamOpen] = React.useState(false);
  const [openDepartments, setOpenDepartments] = React.useState<Set<string>>(() => new Set());
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [snackMessage, setSnackMessage] = React.useState('');
  const inbox = useOwnerInbox();
  const [inboxFilter, setInboxFilter] = React.useState<InboxKind | 'all' | null>(null);
  // A tapped notification opens "Needs you now" on its kind (?inbox=…); `ts` makes a repeat tap count.
  const { inbox: inboxParam, ts: inboxTs } = useLocalSearchParams<{ inbox?: string; ts?: string }>();
  const [seenInboxTs, setSeenInboxTs] = React.useState<string | undefined>();
  if (inboxTs && inboxTs !== seenInboxTs) {
    setSeenInboxTs(inboxTs);
    if (inboxParam) setInboxFilter(inboxParam as InboxKind);
  }

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchPendingApprovals(),
      fetchSettings(),
      fetchTeamMembers(),
    ]);
  }, [fetchStats, fetchPendingApprovals, fetchSettings, fetchTeamMembers]);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    loadData();
    subscribeToRealtime(profile.id, 'owner');
    return () => unsubscribeFromRealtime();
  }, [profile?.id, loadData, subscribeToRealtime, unsubscribeFromRealtime]);

  const applyDepartments = useCallback((res: Awaited<ReturnType<typeof fetchDepartments>>) => {
    if (res.success) setDepartments(res.data);
  }, []);
  const loadDepartments = useCallback(async () => applyDepartments(await fetchDepartments()), [applyDepartments]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchDepartments().then((res) => active && applyDepartments(res));
      return () => {
        active = false;
      };
    }, [applyDepartments])
  );

  // Keep live status fresh while the dashboard is focused (realtime + poll fallback)
  useFocusEffect(
    useCallback(() => {
      // Realtime does the instant updates; this is only the safety net, and it
      // sits out while nobody is looking.
      const pollId = setInterval(() => {
        if (isAppVisible()) refreshMemberLiveStatus();
      }, 60000);
      return () => clearInterval(pollId);
    }, [refreshMemberLiveStatus])
  );

  // Oldest waiting request per person, shown as buttons on their team card.
  const pendingByUser = useMemo(() => {
    const map: Record<string, WorkLogWithProfile> = {};
    for (const log of pendingApprovals) {
      const prev = map[log.user_id];
      if (!prev || log.date < prev.date) map[log.user_id] = log;
    }
    return map;
  }, [pendingApprovals]);

  const sortedMembers = useMemo(
    () => sortMembersByLiveStatus(teamMembers, memberLiveStatus),
    [teamMembers, memberLiveStatus]
  );

  // Team, grouped: each department with its people, then everyone without one.
  const grouped = useMemo(() => {
    const byDept: Record<string, Profile[]> = {};
    const unassigned: Profile[] = [];
    for (const m of sortedMembers) {
      const d = departments.memberOf[m.id];
      if (d) (byDept[d] ??= []).push(m);
      else unassigned.push(m);
    }
    return { byDept, unassigned };
  }, [sortedMembers, departments.memberOf]);

  const toggleDepartment = (id: string) =>
    setOpenDepartments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Same rule as the "Working" count at the top: checked in (or waiting for the
  // check-in to be approved). Someone who has checked out and is only waiting
  // for that checkout to be approved has stopped working.
  const isWorking = (id: string) => {
    const st = memberLiveStatus[id]?.status;
    return st === 'working' || st === 'pending_approval';
  };
  const waitingIn = (people: Profile[]) => people.filter((m) => pendingByUser[m.id]).length;

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadData(), loadDepartments()]);
    setRefreshing(false);
  };

  const renderMember = (member: Profile) => {
    const live = memberLiveStatus[member.id];
    const pending = pendingByUser[member.id];
    return (
      <View key={member.id}>
        <MemberCard
          member={member}
          currentStatus={live?.status ?? 'offline'}
          checkInTime={live?.checkInTime}
          checkOutTime={live?.checkOutTime}
          checkInPlan={live?.checkInPlan}
          dayReport={live?.dayReport}
          pendingTaskCount={live?.pendingTaskCount ?? 0}
          inProgressTaskCount={live?.inProgressTaskCount ?? 0}
          doneTaskCount={live?.doneTaskCount ?? 0}
          activeTasks={live?.activeTasks ?? []}
          onPress={() => {
            setMenuDialog(null);
            setMenuMember(member);
          }}
          actions={
            pending ? (
              <ApprovalActions
                workLog={pending}
                isApproving={approvingId === pending.id}
                isRejecting={rejectingId === pending.id}
                onApprove={() => handleApprove(pending.id)}
                onReject={() => handleReject(pending.id)}
              />
            ) : undefined
          }
        />
      </View>
    );
  };

  const teamWorking = sortedMembers.filter((m) => isWorking(m.id)).length;
  const teamWaiting = waitingIn(sortedMembers);

  const handleApprove = async (workLogId: string) => {
    if (!profile?.id) return;
    setApprovingId(workLogId);
    const result = await approveCheckIn(workLogId, profile.id);
    setApprovingId(null);
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to approve check-in. Please try again.');
    }
  };

  // Sending a check-in back asks what needs to change; the person sees it.
  const [reasonFor, setReasonFor] = React.useState<string | null>(null);
  const handleReject = (workLogId: string) => setReasonFor(workLogId);
  const sendBack = async (workLogId: string, reason: string) => {
    if (!profile?.id) return;
    setRejectingId(workLogId);
    const result = await rejectCheckIn(workLogId, profile.id, reason);
    setRejectingId(null);
    if (!result.success) {
      setSnackMessage(result.error || 'Could not send it back. Please try again.');
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const today = format(new Date(), 'EEE, d MMM');
  const stillLoading = isLoadingApprovals && stats.totalMembers === 0;

  return (
    <>
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingTop: Math.max(insets.top, 12) + 10 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.ink}
              colors={[T.ink]}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Greeting */}
          <Animated.View entering={FadeIn.duration(420).easing(ENTER)} style={styles.header}>
            <Text style={styles.hello} numberOfLines={1}>Hello {firstName}</Text>
            <Text style={styles.date} numberOfLines={1}>{today}</Text>
            <SoftBell />
          </Animated.View>

          {/* 2. Everything waiting on the owner — or a quiet all-clear */}
          <Animated.View entering={FadeInDown.delay(50).duration(500).easing(ENTER)}>
            {stillLoading ? (
              <ActivityIndicator color={T.mute} style={styles.infoLoading} />
            ) : inbox.total > 0 ? (
              <NeedsYouCard inbox={inbox} onOpen={setInboxFilter} />
            ) : (
              <View style={styles.infoRow}>
                <Feather name="check-circle" size={14} color={T.green} />
                <Text style={styles.infoText} numberOfLines={1}>
                  Nothing needs approval
                  <Text style={styles.infoTextMute}>
                    {stats.activeNow > 0
                      ? ` · ${stats.activeNow} working now`
                      : ' · No one checked in yet'}
                  </Text>
                </Text>
              </View>
            )}
          </Animated.View>

          {/* 3. Today at a glance — one compact strip */}
          <Animated.View entering={FadeInDown.delay(120).duration(500).easing(ENTER)}>
            <View style={styles.glanceStrip}>
              <GlanceStat
                color={T.green}
                soft={T.greenSoft}
                icon="user-check"
                value={stillLoading ? '—' : String(stats.activeNow)}
                label="Working"
              />
              <View style={styles.glanceDivider} />
              <GlanceStat
                color={T.amber}
                soft={T.amberSoft}
                icon="sun"
                value={stillLoading ? '—' : String(stats.onLeaveToday)}
                label="On leave"
              />
              <View style={styles.glanceDivider} />
              <GlanceStat
                color={T.blue}
                soft={T.blueSoft}
                icon="users"
                value={stillLoading ? '—' : String(stats.totalMembers)}
                label="Team"
              />
            </View>
          </Animated.View>

          {/* 4. The team — a dropdown of departments, then everyone without one */}
          <Animated.View entering={FadeInDown.delay(180).duration(500).easing(ENTER)}>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionLabelTight, { flex: 1 }]}>People</Text>
              <AnimatedPressable
                scaleTo={0.96}
                onPress={() => router.push('/(owner)/tasks')}
                style={styles.viewAll}
              >
                <Text style={styles.viewAllText}>All tasks</Text>
                <Feather name="chevron-right" size={16} color={T.mute} />
              </AnimatedPressable>
            </View>

            {approvalsError ? (
              <InlineError message={approvalsError} onRetry={() => fetchPendingApprovals()} />
            ) : null}

            {isLoadingTeam && teamMembers.length === 0 ? (
              <ListSkeleton count={3} variant="member" />
            ) : teamError ? (
              <InlineError message={teamError} onRetry={() => fetchTeamMembers()} />
            ) : sortedMembers.length === 0 ? (
              <Text style={styles.sectionHint}>No team members yet.</Text>
            ) : (
              <>
                <GroupRow
                  icon="users"
                  color={T.blue}
                  soft={T.blueSoft}
                  title="Team"
                  hint={[
                    `${sortedMembers.length} ${sortedMembers.length === 1 ? 'person' : 'people'}`,
                    teamWorking ? `${teamWorking} working` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                  badge={teamWaiting ? `${teamWaiting} waiting` : undefined}
                  open={teamOpen}
                  onPress={() => setTeamOpen((o) => !o)}
                />
                {teamOpen ? (
                  <DropdownBody style={styles.teamBody}>
                    {departments.departments.map((d) => {
                      const people = grouped.byDept[d.id] ?? [];
                      const open = openDepartments.has(d.id);
                      const working = people.filter((m) => isWorking(m.id)).length;
                      const waiting = waitingIn(people);
                      return (
                        <View key={d.id}>
                          <GroupRow
                            nested
                            icon="layers"
                            color={T.violet}
                            soft={T.violetSoft}
                            title={d.name}
                            hint={
                              people.length === 0
                                ? 'No one yet'
                                : [
                                    `${people.length} ${people.length === 1 ? 'person' : 'people'}`,
                                    working ? `${working} working` : null,
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')
                            }
                            badge={waiting ? `${waiting} waiting` : undefined}
                            open={open}
                            onPress={() => toggleDepartment(d.id)}
                          />
                          {open ? (
                            <DropdownBody style={styles.departmentBody}>
                              {people.length === 0 ? (
                                <Text style={styles.sectionHint}>Add people from Departments below.</Text>
                              ) : (
                                people.map(renderMember)
                              )}
                            </DropdownBody>
                          ) : null}
                        </View>
                      );
                    })}
                    {grouped.unassigned.length > 0 && departments.departments.length > 0 ? (
                      <View>
                        <Text style={styles.unassignedLabel}>Not in a department</Text>
                      </View>
                    ) : null}
                    {grouped.unassigned.map(renderMember)}
                  </DropdownBody>
                ) : null}
              </>
            )}

            <View style={styles.bottomActions}>
              <AnimatedPressable
                scaleTo={0.98}
                onPress={() => router.push('/(owner)/team/add-member')}
                style={[styles.addMember, styles.bottomAction]}
                accessibilityRole="button"
                accessibilityLabel="Add member"
              >
                <View style={styles.addMemberIcon}>
                  <Feather name="user-plus" size={17} color={T.ink} />
                </View>
                <Text style={styles.addMemberText}>Add member</Text>
              </AnimatedPressable>
              <AnimatedPressable
                scaleTo={0.98}
                onPress={() => setManagingDepartments(true)}
                style={[styles.addMember, styles.bottomAction]}
                accessibilityRole="button"
                accessibilityLabel="Manage departments"
              >
                <View style={styles.addMemberIcon}>
                  <Feather name="layers" size={17} color={T.ink} />
                </View>
                <Text style={styles.addMemberText}>Departments</Text>
              </AnimatedPressable>
            </View>
          </Animated.View>

        </ScrollView>
      </View>

      {inboxFilter ? (
        <OwnerInboxSheet
          inbox={inbox}
          initialFilter={inboxFilter}
          onDismiss={() => setInboxFilter(null)}
          onMessage={setSnackMessage}
          onOpenChat={(memberId) => {
            const person = teamMembers.find((m) => m.id === memberId);
            if (!person) return setSnackMessage('That person is no longer on the team');
            setInboxFilter(null);
            setMenuDialog('chat');
            setMenuMember(person);
          }}
        />
      ) : null}

      {managingDepartments ? (
        <DepartmentsSheet
          data={departments}
          people={sortedMembers}
          onDismiss={() => setManagingDepartments(false)}
          onChanged={(message) => {
            setSnackMessage(message);
            void loadDepartments();
          }}
        />
      ) : null}

      <OwnerMemberMenu
        member={menuMember}
        initialDialog={menuDialog}
        onClose={() => setMenuMember(null)}
        onMessage={setSnackMessage}
      />

      {reasonFor ? (
        <ReasonSheet
          title="Send back"
          hint="They will see this and can change it."
          onConfirm={(reason) => sendBack(reasonFor, reason)}
          onDismiss={() => setReasonFor(null)}
        />
      ) : null}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </>
  );
}

// ---------------------------------------------------------------------------

/** A tappable dropdown header: the Team button, or a department inside it. */
function GroupRow({
  icon,
  color,
  soft,
  title,
  hint,
  badge,
  open,
  onPress,
  nested,
}: {
  icon: keyof typeof Feather.glyphMap;
  color: string;
  soft: string;
  title: string;
  hint?: string;
  badge?: string;
  open: boolean;
  onPress: () => void;
  nested?: boolean;
}) {
  return (
    <AnimatedPressable
      scaleTo={0.98}
      onPress={onPress}
      style={[styles.groupRow, nested && styles.groupRowNested]}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ expanded: open }}
    >
      <View style={[styles.groupIcon, { backgroundColor: soft }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <View style={styles.groupText}>
        <Text style={styles.groupTitle} numberOfLines={1}>{title}</Text>
        {hint ? <Text style={styles.groupHint} numberOfLines={1}>{hint}</Text> : null}
      </View>
      {badge ? (
        <View style={styles.groupBadge}>
          <Text style={styles.groupBadgeText}>{badge}</Text>
        </View>
      ) : null}
      <Chevron open={open} color={T.mute} />
    </AnimatedPressable>
  );
}

function SoftBell() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { unreadCount, fetchNotifications, setupSubscription } = useNotificationStore();

  useEffect(() => {
    if (!profile?.id) return;
    fetchNotifications(profile.id);
    return setupSubscription(profile.id);
  }, [profile?.id, fetchNotifications, setupSubscription]);

  return (
    <AnimatedPressable
      scaleTo={0.9}
      onPress={() => router.push('/(owner)/notifications' as any)}
      style={styles.bell}
    >
      <Feather name="bell" size={18} color={T.ink} />
      {unreadCount > 0 ? (
        <View style={styles.bellDot}>
          <Text style={styles.bellDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

function ApprovalActions({
  workLog,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: {
  workLog: WorkLogWithProfile;
  isApproving: boolean;
  isRejecting: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isCheckout = workLog.status === 'pending_checkout';
  const when = formatWorkLogDateForMessage(workLog.date);
  const busy = isApproving || isRejecting;

  return (
    <View style={styles.approvalBox}>
      <Text style={styles.approvalLabel} numberOfLines={1}>
        {isCheckout ? 'Checkout waiting' : 'Check-in waiting'}
        {when ? <Text style={styles.approvalWhen}> · {when}</Text> : null}
      </Text>
      <View style={styles.approvalBtns}>
        <AnimatedPressable
          scaleTo={0.95}
          onPress={onReject}
          disabled={busy}
          style={[styles.approvalBtn, styles.rejectBtn]}
        >
          {isRejecting ? (
            <ActivityIndicator size="small" color={T.inkSoft} />
          ) : (
            <Text style={styles.rejectText}>Send back</Text>
          )}
        </AnimatedPressable>
        <AnimatedPressable
          scaleTo={0.95}
          onPress={onApprove}
          disabled={busy}
          style={[styles.approvalBtn, styles.approveBtn]}
        >
          {isApproving ? (
            <ActivityIndicator size="small" color={T.white} />
          ) : (
            <Text style={styles.approveText}>Approve</Text>
          )}
        </AnimatedPressable>
      </View>
    </View>
  );
}

function GlanceStat({
  icon,
  color,
  soft,
  value,
  label,
}: {
  icon: React.ComponentProps<typeof Feather>['name'];
  color: string;
  soft: string;
  value: string;
  label: string;
}) {
  return (
    <View style={styles.glanceStat}>
      <View style={[styles.glanceIcon, { backgroundColor: soft }]}>
        <Feather name={icon} size={11} color={color} />
      </View>
      <Text style={styles.glanceValue}>{value}</Text>
      <Text style={styles.glanceLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: T.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 130,
    paddingHorizontal: 20,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  hello: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: T.ink,
    letterSpacing: -0.5,
  },
  date: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
  },
  bell: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  bellDot: {
    position: 'absolute',
    top: 5,
    right: 5,
    minWidth: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: T.coral,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellDotText: {
    color: '#fff',
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    lineHeight: 10,
  },

  infoLoading: {
    marginVertical: 6,
    alignSelf: 'flex-start',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 2,
    marginBottom: 10,
  },
  infoText: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.ink,
  },
  addMember: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    marginTop: 4,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: T.soft2,
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  bottomAction: {
    flex: 1,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    ...shadow,
  },
  groupRowNested: {
    borderRadius: 16,
    paddingVertical: 10,
  },
  groupIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupText: {
    flex: 1,
    minWidth: 0,
  },
  groupTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15.5,
    color: T.ink,
    letterSpacing: -0.2,
  },
  groupHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12.5,
    color: T.mute,
    marginTop: 1,
  },
  groupBadge: {
    backgroundColor: T.amberSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  groupBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.amber,
  },
  teamBody: {
    paddingLeft: 10,
  },
  departmentBody: {
    paddingLeft: 10,
    marginBottom: 4,
  },
  unassignedLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: T.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 8,
    marginLeft: 4,
  },
  addMemberIcon: {
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMemberText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
  },
  approvalBox: {
    backgroundColor: T.amberSoft,
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  approvalLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12.5,
    color: T.amber,
  },
  approvalWhen: {
    fontFamily: 'Inter_500Medium',
  },
  approvalBtns: {
    flexDirection: 'row',
    gap: 8,
  },
  approvalBtn: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: T.card,
  },
  rejectText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  approveBtn: {
    backgroundColor: T.charcoal,
  },
  approveText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
  },
  infoTextMute: {
    fontFamily: 'Inter_400Regular',
    color: T.mute,
  },


  sectionLabelTight: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
  },
  sectionHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginTop: 4,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 12,
    marginTop: 22,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 2,
  },
  viewAllText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.mute,
  },

  glanceStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.card,
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 6,
    ...shadow,
  },
  glanceStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  glanceDivider: {
    width: 1,
    height: 18,
    backgroundColor: T.hairline,
  },
  glanceIcon: {
    width: 20,
    height: 20,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glanceValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    color: T.ink,
    letterSpacing: -0.3,
  },
  glanceLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: T.mute,
  },

});
