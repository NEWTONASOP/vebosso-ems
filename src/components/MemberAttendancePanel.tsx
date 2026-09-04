// ============================================================================
// VEBOSSO EMS — Member attendance panel
// The date rail + day summary + timeline from the Attendance screen, reusable
// wherever one person is already in focus (team member sheets), so past days
// can be reviewed without leaving for the Attendance tab.
// ============================================================================

import { format, isSameDay, startOfMonth } from 'date-fns';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { DateRail } from './DateRail';
import { DayAction, DayHeaderCard } from './DayHeaderCard';
import { DayTimeline } from './DayTimeline';
import { InlineError } from './InlineError';
import { MemberLocationSection } from './MemberLocationSection';
import { WorkLogDetail } from './WorkLogDetail';
import { AppTheme as T } from '../constants/theme';
import {
  buildDayTimeline,
  getDayStatus,
  getMonthRange,
} from '../lib/attendanceTimeline';
import { useWorkStore } from '../store/workStore';
import { LeaveRequest, Task, WorkLog } from '../types/database';

const KEY = (d: Date) => format(d, 'yyyy-MM-dd');

interface MemberAttendancePanelProps {
  memberId: string;
  /** Role accent used to mark today on the rail. */
  accentColor?: string;
  /**
   * The full work-log sheet. Off when the panel already sits inside a modal —
   * stacking a second sheet on top of one is disorienting.
   */
  enableDetailSheet?: boolean;
  /** Owner/manager views also get the day's map; a member reviewing their own
   *  history does not need to be shown their own trail back. */
  showLocation?: boolean;
}

export function MemberAttendancePanel({
  memberId,
  accentColor,
  enableDetailSheet = true,
  showLocation = false,
}: MemberAttendancePanelProps) {
  const { fetchWorkHistory, fetchCompletedTasksInRange, fetchLeaveInRange } =
    useWorkStore();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const selectedKey = KEY(selectedDate);

  // The rail scrolls across the whole month, so the whole month loads at once —
  // a narrower range would leave scrolled-to days without a status dot, which
  // reads as "absent" rather than "not loaded".
  const load = useCallback(async () => {
    if (!memberId) return;
    setIsLoading(true);
    setError(null);

    const { start, end } = getMonthRange(visibleMonth);
    const [logsRes, tasksRes, leavesRes] = await Promise.all([
      fetchWorkHistory(memberId, start, end),
      fetchCompletedTasksInRange(memberId, start, end),
      fetchLeaveInRange(memberId, start, end),
    ]);

    if (logsRes.success) {
      setWorkLogs(logsRes.data);
    } else {
      setError(logsRes.error || 'Failed to load attendance.');
      setWorkLogs([]);
    }
    setTasks(tasksRes.success ? tasksRes.data : []);
    setLeaves(leavesRes.success ? leavesRes.data : []);
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberId, visibleMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  // A different member starts from today again rather than on the day that was
  // selected for the previous one.
  useEffect(() => {
    setSelectedDate(new Date());
    setVisibleMonth(startOfMonth(new Date()));
  }, [memberId]);

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

  const dayActions: DayAction[] = enableDetailSheet
    ? [
        {
          key: 'log',
          label: 'View full log',
          icon: 'file-text',
          tone: 'primary',
          disabled: !selectedLog,
          onPress: () => setDetailVisible(true),
        },
      ]
    : [];

  return (
    <View>
      <DateRail
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        visibleMonth={visibleMonth}
        onChangeMonth={setVisibleMonth}
        getDayStatus={(d) => getDayStatus({ workLog: logFor(d), leave: leaveFor(d) })}
        accentColor={accentColor}
      />

      {error ? (
        <View style={styles.errorPad}>
          <InlineError message={error} onRetry={load} compact />
        </View>
      ) : null}

      {isLoading && workLogs.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={T.charcoal} />
          <Text style={styles.loadingText}>Loading attendance…</Text>
        </View>
      ) : (
        <>
          <DayHeaderCard
            date={selectedDate}
            status={selectedStatus}
            checkInTime={selectedLog?.check_in_time}
            checkOutTime={selectedLog?.check_out_time}
            totalHours={selectedLog?.total_hours}
            actions={dayActions}
          />

          {showLocation ? (
            <MemberLocationSection
              memberId={memberId}
              date={selectedDate}
              accentColor={accentColor}
            />
          ) : null}

          <DayTimeline
            timeline={timeline}
            onPressEvent={(event) => {
              if (
                enableDetailSheet &&
                (event.kind === 'check-in' || event.kind === 'check-out')
              ) {
                setDetailVisible(true);
              }
            }}
          />
        </>
      )}

      {enableDetailSheet && detailVisible && selectedLog ? (
        <WorkLogDetail
          visible
          workLog={selectedLog}
          tasks={tasks.filter((t) => t.completed_at?.slice(0, 10) === selectedKey)}
          onDismiss={() => setDetailVisible(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  errorPad: {
    paddingHorizontal: 4,
    paddingBottom: 8,
  },
  loading: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 28,
  },
  loadingText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
  },
});
