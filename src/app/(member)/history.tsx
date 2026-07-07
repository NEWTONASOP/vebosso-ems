// ============================================================================
// VEBOSSO EMS — Member History Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text, Snackbar, Portal } from 'react-native-paper';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { WorkLog } from '../../types/database';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { BackfillModal } from '../../components/BackfillModal';
import { InlineError } from '../../components/InlineError';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';
import { Feather } from '@expo/vector-icons';
import { PageTransition } from '../../components/PageTransition';
import { Colors } from '../../constants/colors';

export default function MemberHistoryScreen() {
  const { profile } = useAuthStore();
  const { fetchWorkHistory, backfillPermissions, fetchBackfillPermissions, submitBackfill } = useWorkStore();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Backfill modal states
  const [backfillModalVisible, setBackfillModalVisible] = useState(false);
  const [selectedBackfillDate, setSelectedBackfillDate] = useState('');
  const [submittingBackfill, setSubmittingBackfill] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [backfillInitialPlan, setBackfillInitialPlan] = useState('');
  const [backfillInitialIn, setBackfillInitialIn] = useState('09:00');
  const [backfillInitialOut, setBackfillInitialOut] = useState('18:00');
  const [backfillInitialReport, setBackfillInitialReport] = useState('');

  const loadHistory = useCallback(async () => {
    if (!profile) return;
    setFetchError(null);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    
    const [historyRes] = await Promise.all([
      fetchWorkHistory(profile.id, start, end),
      fetchBackfillPermissions(profile.id),
    ]);

    if (historyRes.success) {
      setWorkLogs(historyRes.data);
    } else {
      setFetchError(historyRes.error || 'Failed to load work history.');
      setWorkLogs([]);
    }
  }, [profile, currentMonth, fetchWorkHistory, fetchBackfillPermissions]);

  const handleBackfillSubmit = async (inTime: string, planStr: string, outTime: string, reportStr: string) => {
    if (!profile) return;
    setSubmittingBackfill(true);
    const result = await submitBackfill(profile.id, selectedBackfillDate, inTime, planStr, outTime, reportStr);
    setSubmittingBackfill(false);
    
    if (result.success) {
      setSnackMessage('Attendance logged successfully! 🎉');
      setBackfillModalVisible(false);
      loadHistory();
    } else {
      setSnackMessage(result.error || 'Failed to submit attendance backfill.');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    void loadHistory();
  }, [loadHistory]);

  const currentIndex = selectedLog ? workLogs.findIndex((l) => l.id === selectedLog.id) : -1;
  const hasNextDay = selectedLog ? currentIndex > 0 : false;
  const hasPrevDay = selectedLog ? (currentIndex !== -1 && currentIndex < workLogs.length - 1) : false;

  const handleNextDay = () => {
    if (hasNextDay && currentIndex !== -1) {
      setSelectedLog(workLogs[currentIndex - 1]);
    }
  };

  const handlePrevDay = () => {
    if (hasPrevDay && currentIndex !== -1) {
      setSelectedLog(workLogs[currentIndex + 1]);
    }
  };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const getLogForDay = (day: Date) => workLogs.find((l) => isSameDay(new Date(l.date), day));

  // Monthly summary stats
  const totalDaysWorked = workLogs.filter((l) => l.status === 'done').length;
  const totalHours = workLogs.reduce((sum, l) => sum + (l.total_hours || 0), 0);

  return (
    <PageTransition>
    <View style={styles.container}>
      {/* Header title */}
      <View style={styles.header}>
        <Text style={styles.title}>History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1))}
            activeOpacity={0.7}
          >
            <Feather name="chevron-left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1))}
            activeOpacity={0.7}
          >
            <Feather name="chevron-right" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {fetchError && (
          <InlineError
            message={fetchError}
            onRetry={loadHistory}
            compact
          />
        )}

        {/* Unified Summary Stats Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{totalDaysWorked}</Text>
            <Text style={styles.summaryLabel}>Days Worked</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>{totalHours.toFixed(1)}h</Text>
            <Text style={styles.summaryLabel}>Total Hours</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryCol}>
            <Text style={styles.summaryValue}>
              {totalDaysWorked > 0 ? (totalHours / totalDaysWorked).toFixed(1) : '0'}h
            </Text>
            <Text style={styles.summaryLabel}>Avg Hours/Day</Text>
          </View>
        </View>

        {/* Grouped Calendar Widget */}
        <View style={styles.calendarCard}>
          {/* Weekday Row */}
          <View style={styles.weekdayRow}>
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => (
              <Text key={d} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>

          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {/* Pad blank days at start of month */}
            {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            
            {/* Days in Month */}
            {daysInMonth.map((day) => {
              const log = getLogForDay(day);
              const backfill = backfillPermissions.find((p) => p.date === format(day, 'yyyy-MM-dd') && !p.is_used);
              const isToday = isSameDay(day, new Date());
              const statusColor = log ? WORK_LOG_STATUS_CONFIG[log.status]?.color : undefined;
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[
                    styles.dayCell,
                    log && {
                      backgroundColor: WORK_LOG_STATUS_CONFIG[log.status]?.backgroundColor,
                      borderColor: statusColor,
                      borderWidth: 1.5
                    },
                    backfill && {
                      backgroundColor: Colors.warningLight,
                      borderColor: Colors.warning,
                      borderWidth: 1.5
                    },
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => {
                    if (log) {
                      if (backfill) {
                        setSelectedBackfillDate(format(day, 'yyyy-MM-dd'));
                        setBackfillInitialPlan(log.check_in_plan || '');
                        setBackfillInitialIn(log.check_in_time || '09:00');
                        setBackfillInitialOut(log.check_out_time || '18:00');
                        setBackfillInitialReport(log.day_report || '');
                        setBackfillModalVisible(true);
                      } else {
                        setSelectedLog(log);
                        setShowDetail(true);
                      }
                    } else if (backfill) {
                      setSelectedBackfillDate(format(day, 'yyyy-MM-dd'));
                      setBackfillInitialPlan('');
                      setBackfillInitialIn('09:00');
                      setBackfillInitialOut('18:00');
                      setBackfillInitialReport('');
                      setBackfillModalVisible(true);
                    }
                  }}
                  disabled={!log && !backfill}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                    {format(day, 'd')}
                  </Text>
                  {log && !backfill ? (
                    <Text style={[styles.dayHours, { color: statusColor }]}>
                      {log.total_hours ? `${log.total_hours}h` : '·'}
                    </Text>
                  ) : backfill ? (
                    <Feather name="edit-2" size={9} color={Colors.warning} style={{ marginTop: 2 }} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legendDivider} />

          {/* Legend nested inside Calendar Card */}
          <View style={styles.legend}>
            {Object.entries(WORK_LOG_STATUS_CONFIG).map(([key, config]) => (
              <View key={key} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: config.color }]} />
                <Text style={styles.legendText}>{config.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <WorkLogDetail 
        visible={showDetail} 
        onDismiss={() => setShowDetail(false)} 
        workLog={selectedLog} 
        onNextDay={handleNextDay}
        onPrevDay={handlePrevDay}
        hasNextDay={hasNextDay}
        hasPrevDay={hasPrevDay}
      />

      <Portal>
        {selectedBackfillDate ? (
          <BackfillModal
            visible={backfillModalVisible}
            date={selectedBackfillDate}
            onDismiss={() => setBackfillModalVisible(false)}
            onSubmit={handleBackfillSubmit}
            isLoading={submittingBackfill}
            initialCheckInPlan={backfillInitialPlan}
            initialCheckInTime={backfillInitialIn}
            initialCheckOutTime={backfillInitialOut}
            initialDayReport={backfillInitialReport}
          />
        ) : null}
      </Portal>

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
    </PageTransition>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  monthTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  // Unified Summary Card
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
    marginBottom: 20,
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 20,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: Colors.divider,
  },
  // Grouped Calendar Card
  calendarCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.divider,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textTertiary,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    marginBottom: 4,
  },
  todayCell: {
    borderColor: Colors.memberAccent,
    borderWidth: 1.5,
    backgroundColor: Colors.memberAccent + '12',
  },
  dayNumber: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  todayText: {
    fontFamily: 'Inter_700Bold',
    color: Colors.memberAccent,
  },
  dayHours: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    marginTop: 1,
  },
  legendDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginVertical: 14,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: Colors.textSecondary,
  },
});
