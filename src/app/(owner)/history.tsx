// ============================================================================
// VEBOSSO EMS — Owner History Screen
// Team day view + per-person month rail / sequential timeline.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Avatar, Snackbar, Text } from 'react-native-paper';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { DayAction, DayHeaderCard } from '../../components/DayHeaderCard';
import { DayTimeline } from '../../components/DayTimeline';
import { MemberLocationSection } from '../../components/MemberLocationSection';
import { InlineError } from '../../components/InlineError';
import { MemberPickerModal } from '../../components/MemberPickerModal';
import { PageTransition } from '../../components/PageTransition';
import { TeamDayList, buildTeamDayRows } from '../../components/TeamDayList';
import { DateRail } from '../../components/DateRail';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import {
  adjacentLogDate,
  buildDayTimeline,
  DAY_STATUS_LABEL,
  DAY_STATUS_COLOR,
  getDayStatus,
  getMonthRange,
} from '../../lib/attendanceTimeline';
import {
  AppTheme as T,
  AppRadius,
  AppSpace,
  RoleAccent,
  appShadow,
  appSoftShadow,
  screenChrome,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import {
  LeaveRequest,
  Profile,
  Task,
  WorkLog,
  WorkLogWithProfile,
} from '../../types/database';

const ownerAccent = RoleAccent.owner;
const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

type ViewMode = 'team' | 'person';

export default function OwnerHistoryScreen() {
  const { profile } = useAuthStore();
  const {
    teamMembers,
    fetchTeamMembers,
    fetchWorkHistory,
    fetchCompletedTasksInRange,
    fetchLeaveInRange,
    fetchTeamDay,
    grantBackfillPermission,
    backfillPermissions,
    fetchBackfillPermissions,
  } = useWorkStore();

  const [mode, setMode] = useState<ViewMode>('team');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Person-mode week data
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);

  // Team-mode day data
  const [teamLogs, setTeamLogs] = useState<WorkLogWithProfile[]>([]);

  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const selectedKey = KEY(selectedDate);

  // ── Team members (needed for Team rows + Person picker) ──────────────────
  useEffect(() => {
    void fetchTeamMembers();
  }, [fetchTeamMembers]);

  // ── Team day load ────────────────────────────────────────────────────────
  const loadTeamDay = useCallback(async () => {
    setFetchError(null);
    const [dayRes] = await Promise.all([
      fetchTeamDay(selectedKey),
      fetchTeamMembers(),
    ]);
    if (dayRes.success) {
      setTeamLogs(dayRes.data);
    } else {
      setFetchError(dayRes.error || 'Failed to load team attendance.');
      setTeamLogs([]);
    }
  }, [selectedKey, fetchTeamDay, fetchTeamMembers]);

  // ── Person load ──────────────────────────────────────────────────────────
  // The rail scrolls across the whole month, so the whole month loads at once.
  // Anything narrower would leave scrolled-to days without a status dot, which
  // reads as "absent" rather than "not loaded".
  const loadPerson = useCallback(async () => {
    if (!selectedMember) return;
    setFetchError(null);

    const { start, end } = getMonthRange(visibleMonth);

    const [logsRes, tasksRes, leavesRes] = await Promise.all([
      fetchWorkHistory(selectedMember.id, start, end),
      fetchCompletedTasksInRange(selectedMember.id, start, end),
      fetchLeaveInRange(selectedMember.id, start, end),
      fetchBackfillPermissions(selectedMember.id),
    ]);

    if (logsRes.success) {
      setWorkLogs(logsRes.data);
    } else {
      setFetchError(logsRes.error || 'Failed to load attendance.');
      setWorkLogs([]);
    }
    setTasks(tasksRes.success ? tasksRes.data : []);
    setLeaves(leavesRes.success ? leavesRes.data : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMember?.id, visibleMonth]);

  useEffect(() => {
    if (mode === 'team') {
      void loadTeamDay();
    } else if (selectedMember) {
      void loadPerson();
    }
  }, [mode, loadTeamDay, loadPerson, selectedMember]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (mode === 'team') {
      await loadTeamDay();
    } else {
      await loadPerson();
    }
    setRefreshing(false);
  };

  // ── Person-mode derived data ─────────────────────────────────────────────
  const logFor = useCallback(
    (date: Date) => workLogs.find((l) => isSameDay(new Date(l.date), date)) ?? null,
    [workLogs]
  );
  const leaveFor = useCallback(
    (date: Date) => leaves.find((l) => l.date === KEY(date)) ?? null,
    [leaves]
  );

  const selectedLog = logFor(selectedDate);
  const selectedLeave = leaveFor(selectedDate);
  const selectedStatus = getDayStatus({ workLog: selectedLog, leave: selectedLeave });

  const timeline = useMemo(
    () =>
      buildDayTimeline({
        day: selectedKey,
        workLog: selectedLog,
        tasks,
        leave: selectedLeave,
      }),
    [selectedKey, selectedLog, tasks, selectedLeave]
  );

  // Stepping in the detail sheet skips days with no record, so it never opens
  // onto an empty sheet.
  const prevLogDate = adjacentLogDate(workLogs, selectedKey, -1);
  const nextLogDate = adjacentLogDate(workLogs, selectedKey, 1);

  // Summary follows whichever week the selected day belongs to.
  const weekSummary = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const logs = days.map((d) => logFor(d)).filter(Boolean) as WorkLog[];
    const hours = logs.reduce((sum, l) => sum + (l.total_hours || 0), 0);
    const worked = logs.filter((l) => l.status === 'done').length;
    return { worked, hours };
  }, [selectedDate, logFor]);

  const teamRows = useMemo(
    () =>
      buildTeamDayRows({
        day: selectedKey,
        members: teamMembers,
        workLogs: teamLogs,
        leaves: [],
      }),
    [selectedKey, teamMembers, teamLogs]
  );

  const getPermissionForDay = (day: Date) =>
    backfillPermissions.find((p) => p.date === KEY(day) && !p.is_used);

  const activePermission = getPermissionForDay(selectedDate);

  const handleAuthorizeDate = async (day: Date) => {
    if (!selectedMember || !profile || isAuthorizing) return;

    setIsAuthorizing(true);
    const result = await grantBackfillPermission(selectedMember.id, KEY(day), profile.id);
    setIsAuthorizing(false);

    if (result.success) {
      await fetchBackfillPermissions(selectedMember.id);
      setSnackMessage(`${selectedMember.full_name} can now edit ${format(day, 'MMM d')}.`);
    } else {
      setSnackMessage(result.error || 'Failed to authorize edit.');
    }
  };

  // Actions apply to the day already selected, so granting an edit is one tap
  // rather than a mode you enter and then a date you have to find.
  const isPastDay = selectedKey < KEY(new Date());
  const dayActions: DayAction[] = [
    {
      key: 'log',
      label: 'View full log',
      icon: 'file-text',
      tone: 'primary',
      disabled: !selectedLog,
      onPress: () => setDetailVisible(true),
    },
    {
      key: 'authorize',
      label: activePermission
        ? 'Edit allowed'
        : isAuthorizing
          ? 'Allowing…'
          : 'Allow edit',
      icon: activePermission ? 'check' : 'edit-2',
      tone: 'warn',
      // Only a finished day can be backfilled, and only once.
      disabled: !isPastDay || !!activePermission || isAuthorizing,
      onPress: () => void handleAuthorizeDate(selectedDate),
    },
  ];

  const openPicker = () => setPickerVisible(true);

  const selectMemberFromTeam = (userId: string) => {
    const member = teamMembers.find((m) => m.id === userId) ?? null;
    if (member) {
      setSelectedMember(member);
      setMode('person');
    }
  };

  return (
    <>
      <PageTransition>
        <View style={screenChrome.root}>
          <View style={screenChrome.header}>
            <Text style={screenChrome.title}>Attendance</Text>
            <Text style={screenChrome.subtitle}>
              {mode === 'team'
                ? 'Everyone on this day'
                : selectedMember
                  ? `${selectedMember.full_name}'s week`
                  : 'Pick someone to review'}
            </Text>
          </View>

          <View style={styles.segmentPad}>
            <View style={screenChrome.segmentTrack}>
              <AnimatedPressable
                scaleTo={0.98}
                onPress={() => setMode('team')}
                style={[
                  screenChrome.segmentBtn,
                  mode === 'team' && screenChrome.segmentBtnActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'team' }}
                accessibilityLabel="Team day view"
              >
                <Feather
                  name="users"
                  size={15}
                  color={mode === 'team' ? T.ink : T.inkSoft}
                />
                <Text
                  style={[
                    screenChrome.segmentText,
                    mode === 'team' && screenChrome.segmentTextActive,
                  ]}
                >
                  Team
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                scaleTo={0.98}
                onPress={() => setMode('person')}
                style={[
                  screenChrome.segmentBtn,
                  mode === 'person' && screenChrome.segmentBtnActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: mode === 'person' }}
                accessibilityLabel="Person history view"
              >
                <Feather
                  name="user"
                  size={15}
                  color={mode === 'person' ? T.ink : T.inkSoft}
                />
                <Text
                  style={[
                    screenChrome.segmentText,
                    mode === 'person' && screenChrome.segmentTextActive,
                  ]}
                >
                  Person
                </Text>
              </AnimatedPressable>
            </View>
          </View>

          <MemberPickerModal
            visible={pickerVisible}
            onDismiss={() => setPickerVisible(false)}
            members={teamMembers}
            selectedMember={selectedMember}
            onSelectMember={(member) => {
              setSelectedMember(member);
              setPickerVisible(false);
            }}
          />

          {mode === 'person' && !selectedMember ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconWrap}>
                  <Feather name="calendar" size={28} color={T.charcoal} />
                </View>
                <Text style={styles.emptyTitle}>Attendance History</Text>
                <Text style={styles.emptyBody}>
                  See any team member's attendance day by day
                </Text>
                <AnimatedPressable
                  scaleTo={0.97}
                  style={styles.chooseMemberBtn}
                  onPress={openPicker}
                  accessibilityRole="button"
                  accessibilityLabel="Choose a member"
                >
                  <Feather name="user" size={18} color={T.white} />
                  <Text style={styles.chooseMemberText}>Choose a member</Text>
                </AnimatedPressable>
              </View>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.content}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={T.charcoal}
                />
              }
            >
              {mode === 'person' && selectedMember ? (
                <AnimatedPressable
                  scaleTo={0.98}
                  style={styles.memberControl}
                  onPress={openPicker}
                  accessibilityRole="button"
                  accessibilityLabel={`Selected member ${selectedMember.full_name}. Change member`}
                >
                  <Avatar.Text
                    size={40}
                    label={selectedMember.full_name?.substring(0, 2).toUpperCase() || '??'}
                    style={styles.memberAvatar}
                    labelStyle={styles.memberAvatarLabel}
                  />
                  <View style={styles.memberMeta}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {selectedMember.full_name}
                    </Text>
                    {selectedMember.employee_id ? (
                      <Text style={styles.memberId} numberOfLines={1}>
                        {selectedMember.employee_id}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.changeAffordance}>
                    <Text style={styles.changeText}>Change</Text>
                    <Feather name="chevron-down" size={16} color={T.inkSoft} />
                  </View>
                </AnimatedPressable>
              ) : null}

              <DateRail
                selectedDate={selectedDate}
                onSelectDate={setSelectedDate}
                visibleMonth={visibleMonth}
                onChangeMonth={setVisibleMonth}
                getDayStatus={(d) =>
                  mode === 'person'
                    ? getDayStatus({ workLog: logFor(d), leave: leaveFor(d) })
                    : 'none'
                }
                accentColor={ownerAccent.color}
              />

              {fetchError ? (
                <View style={styles.errorPad}>
                  <InlineError
                    message={fetchError}
                    onRetry={mode === 'team' ? loadTeamDay : loadPerson}
                    compact
                  />
                </View>
              ) : null}

              {mode === 'team' ? (
                <>
                  <View style={styles.dayHead}>
                    <Text style={styles.dayTitle}>
                      {format(selectedDate, 'EEEE, d MMMM')}
                    </Text>
                  </View>
                  <TeamDayList
                    rows={teamRows}
                    onSelectMember={selectMemberFromTeam}
                  />
                </>
              ) : (
                <>
                  <View style={styles.weekSummary}>
                    <Text style={styles.weekSummaryText}>
                      {weekSummary.worked}{' '}
                      {weekSummary.worked === 1 ? 'day' : 'days'} ·{' '}
                      {weekSummary.hours.toFixed(1)}h this week
                    </Text>
                  </View>

                  <DayHeaderCard
                    date={selectedDate}
                    status={selectedStatus}
                    checkInTime={selectedLog?.check_in_time}
                    checkOutTime={selectedLog?.check_out_time}
                    totalHours={selectedLog?.total_hours}
                    actions={dayActions}
                    note={
                      activePermission
                        ? `${selectedMember?.full_name?.split(' ')[0] ?? 'They'} can edit this day's attendance until it's used.`
                        : null
                    }
                  />

                  {selectedMember ? (
                    <MemberLocationSection
                      memberId={selectedMember.id}
                      date={selectedDate}
                      accentColor={ownerAccent.color}
                    />
                  ) : null}

                  <DayTimeline
                    timeline={timeline}
                    onPressEvent={(event) => {
                      if (event.kind === 'check-in' || event.kind === 'check-out') {
                        setDetailVisible(true);
                      }
                    }}
                  />
                </>
              )}
            </ScrollView>
          )}
        </View>
      </PageTransition>

      {detailVisible && selectedLog ? (
        <WorkLogDetail
          visible
          workLog={selectedLog}
          tasks={tasks.filter((t) => t.completed_at?.slice(0, 10) === selectedKey)}
          onDismiss={() => setDetailVisible(false)}
          onPrevDay={() => prevLogDate && setSelectedDate(parseISO(prevLogDate))}
          onNextDay={() => nextLogDate && setSelectedDate(parseISO(nextLogDate))}
          hasPrevDay={!!prevLogDate}
          hasNextDay={!!nextLogDate}
        />
      ) : null}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        theme={{ colors: { inverseSurface: T.charcoal, inverseOnSurface: T.white } }}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  segmentPad: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  errorPad: {
    marginTop: 14,
  },
  memberControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 64,
    marginBottom: 14,
    ...appSoftShadow,
  },
  memberAvatar: {
    backgroundColor: T.soft,
  },
  memberAvatarLabel: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: T.inkSoft,
  },
  memberMeta: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
    letterSpacing: -0.2,
  },
  memberId: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
  },
  changeAffordance: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: AppRadius.pill,
    backgroundColor: T.soft,
  },
  changeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.inkSoft,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: AppSpace.screen,
    paddingBottom: 100,
  },
  emptyCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.hero,
    paddingHorizontal: 28,
    paddingVertical: 36,
    alignItems: 'center',
    ...appShadow,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: T.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: T.ink,
    letterSpacing: -0.5,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.inkSoft,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  chooseMemberBtn: {
    ...screenChrome.primaryPill,
    minWidth: 200,
    height: 48,
    paddingHorizontal: 22,
  },
  chooseMemberText: {
    ...screenChrome.primaryPillText,
    fontSize: 15,
  },
  weekSummary: {
    marginTop: 14,
    alignItems: 'center',
  },
  weekSummaryText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
  },
  dayHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 16,
    gap: 12,
  },
  dayTitle: {
    flex: 1,
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
  },
});
