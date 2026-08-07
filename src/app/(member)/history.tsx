// ============================================================================
// VEBOSSO EMS — Member History Screen
// Month date rail + sequential day timeline.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { addDays, format, isSameDay, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { BackfillModal } from '../../components/BackfillModal';
import { DayAction, DayHeaderCard } from '../../components/DayHeaderCard';
import { DayTimeline } from '../../components/DayTimeline';
import { InlineError } from '../../components/InlineError';
import { PageTransition } from '../../components/PageTransition';
import { DateRail } from '../../components/DateRail';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import {
  adjacentLogDate,
  buildDayTimeline,
  DAY_STATUS_LABEL,
  getDayStatus,
  getMonthRange,
} from '../../lib/attendanceTimeline';
import {
  AppTheme as T,
  RoleAccent,
  appSoftShadow,
  screenChrome,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { LeaveRequest, Task, WorkLog } from '../../types/database';

const memberAccent = RoleAccent.member;
const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

export default function MemberHistoryScreen() {
  const { profile } = useAuthStore();
  const {
    fetchWorkHistory,
    fetchCompletedTasksInRange,
    fetchLeaveInRange,
    backfillPermissions,
    fetchBackfillPermissions,
    submitBackfill,
  } = useWorkStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [detailVisible, setDetailVisible] = useState(false);
  const [backfillVisible, setBackfillVisible] = useState(false);
  const [submittingBackfill, setSubmittingBackfill] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  // The rail scrolls across the whole month, so the whole month is fetched.
  // Anything narrower leaves scrolled-to days with no status dot, which would
  // read as "absent" rather than "not loaded".
  const load = useCallback(async () => {
    if (!profile) return;
    setFetchError(null);

    const { start, end } = getMonthRange(visibleMonth);

    const [logsRes, tasksRes, leavesRes] = await Promise.all([
      fetchWorkHistory(profile.id, start, end),
      fetchCompletedTasksInRange(profile.id, start, end),
      fetchLeaveInRange(profile.id, start, end),
      fetchBackfillPermissions(profile.id),
    ]);

    if (logsRes.success) {
      setWorkLogs(logsRes.data);
    } else {
      setFetchError(logsRes.error || 'Failed to load your attendance.');
      setWorkLogs([]);
    }
    setTasks(tasksRes.success ? tasksRes.data : []);
    setLeaves(leavesRes.success ? leavesRes.data : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, visibleMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const logFor = useCallback(
    (date: Date) => workLogs.find((l) => isSameDay(new Date(l.date), date)) ?? null,
    [workLogs]
  );
  const leaveFor = useCallback(
    (date: Date) => leaves.find((l) => l.date === KEY(date)) ?? null,
    [leaves]
  );

  const selectedKey = KEY(selectedDate);
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

  const backfill = backfillPermissions.find((p) => p.date === selectedKey && !p.is_used);

  // Summary follows whichever week the selected day belongs to.
  const weekSummary = useMemo(() => {
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const logs = days.map((d) => logFor(d)).filter(Boolean) as WorkLog[];
    const hours = logs.reduce((sum, l) => sum + (l.total_hours || 0), 0);
    const worked = logs.filter((l) => l.status === 'done').length;
    return { worked, hours };
  }, [selectedDate, logFor]);

  const handleBackfillSubmit = async (
    inTime: string,
    plan: string,
    outTime: string,
    report: string
  ) => {
    if (!profile) return;
    setSubmittingBackfill(true);
    const result = await submitBackfill(profile.id, selectedKey, inTime, plan, outTime, report);
    setSubmittingBackfill(false);

    if (result.success) {
      setSnackMessage('Attendance logged');
      setBackfillVisible(false);
      void load();
    } else {
      setSnackMessage(result.error || 'Failed to log attendance.');
    }
  };

  return (
    <>
      <PageTransition>
        <View style={screenChrome.root}>
          <View style={screenChrome.header}>
            <Text style={screenChrome.title}>History</Text>
            <Text style={screenChrome.subtitle}>Your attendance, day by day</Text>
          </View>

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
            <DateRail
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              visibleMonth={visibleMonth}
              onChangeMonth={setVisibleMonth}
              getDayStatus={(d) => getDayStatus({ workLog: logFor(d), leave: leaveFor(d) })}
              accentColor={memberAccent.color}
            />

            {fetchError ? (
              <View style={styles.errorPad}>
                <InlineError message={fetchError} onRetry={load} compact />
              </View>
            ) : null}

            <View style={styles.weekSummary}>
              <Text style={styles.weekSummaryText}>
                {weekSummary.worked} {weekSummary.worked === 1 ? 'day' : 'days'} ·{' '}
                {weekSummary.hours.toFixed(1)}h this week
              </Text>
            </View>

            <DayHeaderCard
              date={selectedDate}
              status={selectedStatus}
              checkInTime={selectedLog?.check_in_time}
              checkOutTime={selectedLog?.check_out_time}
              totalHours={selectedLog?.total_hours}
              actions={[
                {
                  key: 'log',
                  label: 'View full log',
                  icon: 'file-text',
                  tone: selectedLog && !backfill ? 'primary' : 'neutral',
                  disabled: !selectedLog,
                  onPress: () => setDetailVisible(true),
                },
                ...(backfill
                  ? ([
                      {
                        key: 'backfill',
                        label: 'Log this day',
                        icon: 'edit-2' as const,
                        tone: 'primary' as const,
                        onPress: () => setBackfillVisible(true),
                      },
                    ] as DayAction[])
                  : []),
              ]}
              note={
                backfill
                  ? 'Your owner opened this date for a late entry.'
                  : null
              }
            />

            <DayTimeline
              timeline={timeline}
              onPressEvent={(event) => {
                if (event.kind === 'check-in' || event.kind === 'check-out') {
                  setDetailVisible(true);
                }
              }}
            />
          </ScrollView>
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

      <BackfillModal
        visible={backfillVisible}
        date={selectedKey}
        onDismiss={() => setBackfillVisible(false)}
        onSubmit={handleBackfillSubmit}
        isLoading={submittingBackfill}
        initialCheckInPlan={selectedLog?.check_in_plan || ''}
        initialCheckInTime={selectedLog?.check_in_time || '09:00'}
        initialCheckOutTime={selectedLog?.check_out_time || '18:00'}
        initialDayReport={selectedLog?.day_report || ''}
      />

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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },
  errorPad: {
    marginTop: 14,
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
