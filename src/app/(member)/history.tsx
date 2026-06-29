// ============================================================================
// VEBOSSO EMS — Member History Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { WorkLog } from '../../types/database';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';

export default function MemberHistoryScreen() {
  const { profile } = useAuthStore();
  const { fetchWorkHistory } = useWorkStore();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    loadHistory();
  }, [profile, currentMonth]);

  const loadHistory = async () => {
    if (!profile) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const logs = await fetchWorkHistory(profile.id, start, end);
    setWorkLogs(logs);
  };

  const daysInMonth = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const getLogForDay = (day: Date) => workLogs.find((l) => isSameDay(new Date(l.date), day));

  // Monthly summary
  const totalDaysWorked = workLogs.filter((l) => l.status === 'done').length;
  const totalHours = workLogs.reduce((sum, l) => sum + (l.total_hours || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My History</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Month Navigation */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1))}>
            <Text style={styles.navArrow}>◀</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1))}>
            <Text style={styles.navArrow}>▶</Text>
          </TouchableOpacity>
        </View>

        {/* Summary Stats */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalDaysWorked}</Text>
            <Text style={styles.summaryLabel}>Days Worked</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalHours.toFixed(1)}</Text>
            <Text style={styles.summaryLabel}>Total Hours</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>
              {totalDaysWorked > 0 ? (totalHours / totalDaysWorked).toFixed(1) : '0'}
            </Text>
            <Text style={styles.summaryLabel}>Avg Hours/Day</Text>
          </View>
        </View>

        {/* Calendar */}
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
              <TouchableOpacity
                key={day.toISOString()}
                style={[
                  styles.dayCell,
                  log && { backgroundColor: WORK_LOG_STATUS_CONFIG[log.status]?.backgroundColor, borderColor: statusColor, borderWidth: 1.5 },
                  isToday && styles.todayCell,
                ]}
                onPress={() => { if (log) { setSelectedLog(log); setShowDetail(true); } }}
                disabled={!log}
              >
                <Text style={[styles.dayNumber, isToday && styles.todayText]}>{format(day, 'd')}</Text>
                {log && <Text style={[styles.dayHours, { color: statusColor }]}>{log.total_hours ? `${log.total_hours}h` : '·'}</Text>}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {Object.entries(WORK_LOG_STATUS_CONFIG).map(([key, config]) => (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: config.color }]} />
              <Text style={styles.legendText}>{config.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <WorkLogDetail visible={showDetail} onDismiss={() => setShowDetail(false)} workLog={selectedLog} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  navArrow: { fontSize: 18, color: Colors.accent, padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard: { flex: 1, backgroundColor: Colors.surface, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, ...Colors.shadow },
  summaryValue: { fontSize: 22, fontWeight: '800', color: Colors.accent },
  summaryLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: Colors.textTertiary, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8, marginBottom: 2 },
  todayCell: { borderColor: Colors.accent, borderWidth: 1.5, backgroundColor: Colors.accentSubtle },
  dayNumber: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  todayText: { color: Colors.accent, fontWeight: '700' },
  dayHours: { fontSize: 9, marginTop: 1, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16, paddingVertical: 12, paddingHorizontal: 8, backgroundColor: Colors.surface, borderRadius: 12, borderWidth: 1, borderColor: Colors.border, ...Colors.shadow },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
});
