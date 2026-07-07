// ============================================================================
// VEBOSSO EMS — Manager History Screen (Own Attendance Only)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text, Portal, Snackbar } from 'react-native-paper';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { BackfillModal } from '../../components/BackfillModal';
import { Colors } from '../../constants/colors';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { WorkLog } from '../../types/database';

export default function ManagerHistoryScreen() {
  const { profile } = useAuthStore();
  const { fetchWorkHistory, backfillPermissions, fetchBackfillPermissions, submitBackfill } = useWorkStore();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
    if (!profile?.id) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    
    const [historyRes] = await Promise.all([
      fetchWorkHistory(profile.id, start, end),
      fetchBackfillPermissions(profile.id),
    ]);

    setWorkLogs(historyRes.data);
  }, [profile?.id, currentMonth, fetchWorkHistory, fetchBackfillPermissions]);

  const handleBackfillSubmit = async (inTime: string, planStr: string, outTime: string, reportStr: string) => {
    if (!profile?.id) return;
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
    if (profile?.id) void loadHistory();
  }, [profile?.id, loadHistory]);

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
  const getLogForDay = (day: Date) => workLogs.find((log) => isSameDay(new Date(log.date), day));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My History</Text>
        <Text style={styles.subtitle}>Your attendance records</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1))} activeOpacity={0.7}>
            <Feather name="chevron-left" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1))} activeOpacity={0.7}>
            <Feather name="chevron-right" size={18} color={Colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.weekdayRow}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d) => <Text key={d} style={styles.weekdayLabel}>{d}</Text>)}
        </View>

        <View style={styles.calendarGrid}>
          {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => <View key={`e-${i}`} style={styles.dayCell} />)}
          {daysInMonth.map((day) => {
            const log = getLogForDay(day);
            const backfill = backfillPermissions.find((p) => p.date === format(day, 'yyyy-MM-dd') && !p.is_used);
            const isToday = isSameDay(day, new Date());
            const statusColor = log ? WORK_LOG_STATUS_CONFIG[log.status]?.color : undefined;
            return (
              <TouchableOpacity key={day.toISOString()} style={[
                styles.dayCell,
                log && { backgroundColor: WORK_LOG_STATUS_CONFIG[log.status]?.backgroundColor, borderColor: statusColor, borderWidth: 1.5 },
                backfill && { backgroundColor: Colors.warningLight, borderColor: Colors.warning, borderWidth: 1.5 },
                isToday && styles.todayCell
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
                <Text style={[styles.dayNumber, isToday && styles.todayText]}>{format(day, 'd')}</Text>
                {log && !backfill ? (
                  <Text style={[styles.dayHours, { color: statusColor }]}>{log.total_hours ? `${log.total_hours}h` : '·'}</Text>
                ) : backfill ? (
                  <Feather name="edit-2" size={9} color={Colors.warning} style={{ marginTop: 2 }} />
                ) : null}
              </TouchableOpacity>
            );
          })}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 8 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  subtitle: { fontFamily: 'Inter_500Medium', fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: Colors.textTertiary, fontFamily: 'Inter_600SemiBold' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 2 },
  todayCell: { borderColor: Colors.accent, borderWidth: 1.5, backgroundColor: Colors.accentSubtle },
  dayNumber: { fontSize: 14, color: Colors.text, fontFamily: 'Inter_500Medium' },
  todayText: { color: Colors.accent, fontFamily: 'Inter_700Bold' },
  dayHours: { fontSize: 9, marginTop: 1, fontFamily: 'Inter_600SemiBold' },
});
