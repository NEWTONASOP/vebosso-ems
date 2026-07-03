// ============================================================================
// VEBOSSO EMS — Manager History Screen (Own Attendance Only)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { Colors } from '../../constants/colors';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { WorkLog } from '../../types/database';

export default function ManagerHistoryScreen() {
  const { profile } = useAuthStore();
  const { fetchWorkHistory } = useWorkStore();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const loadHistory = useCallback(async () => {
    if (!profile?.id) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const result = await fetchWorkHistory(profile.id, start, end);
    setWorkLogs(result.data);
  }, [profile?.id, currentMonth, fetchWorkHistory]);

  useEffect(() => {
    // eslint-disable-next-line
    if (profile?.id) void loadHistory();
  }, [profile?.id, loadHistory]);

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
            const isToday = isSameDay(day, new Date());
            const statusColor = log ? WORK_LOG_STATUS_CONFIG[log.status]?.color : undefined;
            return (
              <TouchableOpacity key={day.toISOString()} style={[styles.dayCell, log && { backgroundColor: WORK_LOG_STATUS_CONFIG[log.status]?.backgroundColor, borderColor: statusColor, borderWidth: 1.5 }, isToday && styles.todayCell]}
                onPress={() => { if (log) { setSelectedLog(log); setShowDetail(true); } }} disabled={!log}>
                <Text style={[styles.dayNumber, isToday && styles.todayText]}>{format(day, 'd')}</Text>
                {log && <Text style={[styles.dayHours, { color: statusColor }]}>{log.total_hours ? `${log.total_hours}h` : '·'}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <WorkLogDetail visible={showDetail} onDismiss={() => setShowDetail(false)} workLog={selectedLog} />
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
