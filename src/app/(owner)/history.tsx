// ============================================================================
// VEBOSSO EMS — Owner History Screen
// ============================================================================

import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, Menu, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { Colors } from '../../constants/colors';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';
import { useWorkStore } from '../../store/workStore';
import { Profile, WorkLog } from '../../types/database';

export default function OwnerHistoryScreen() {
  const { teamMembers, fetchTeamMembers, fetchWorkHistory } = useWorkStore();
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const loadHistory = useCallback(async () => {
    if (!selectedMember) return;
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const logs = await fetchWorkHistory(selectedMember.id, start, end);
    setWorkLogs(logs);
  }, [selectedMember, currentMonth, fetchWorkHistory]);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  useEffect(() => {
    // eslint-disable-next-line
    if (selectedMember) void loadHistory();
  }, [selectedMember, loadHistory]);

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const getLogForDay = (day: Date) =>
    workLogs.find((log) => isSameDay(new Date(log.date), day));

  const getDayColor = (log: WorkLog | undefined) => {
    if (!log) return Colors.surfaceLight;
    return WORK_LOG_STATUS_CONFIG[log.status]?.backgroundColor || Colors.surfaceLight;
  };

  const getDayBorderColor = (log: WorkLog | undefined) => {
    if (!log) return 'transparent';
    return WORK_LOG_STATUS_CONFIG[log.status]?.color || 'transparent';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
      </View>

      {/* Member Picker */}
      <View style={styles.pickerSection}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Button
              mode="outlined"
              onPress={() => setMenuVisible(true)}
              style={styles.pickerButton}
              textColor={Colors.text}
              icon="account"
            >
              {selectedMember?.full_name || 'Select a member'}
            </Button>
          }
          contentStyle={styles.menuContent}
        >
          {teamMembers.map((member) => (
            <Menu.Item
              key={member.id}
              title={`${member.full_name} (${member.employee_id})`}
              onPress={() => {
                setSelectedMember(member);
                setMenuVisible(false);
              }}
              titleStyle={styles.menuItemText}
            />
          ))}
        </Menu>
      </View>

      {!selectedMember ? (
        <EmptyState icon="calendar-month-outline" title="Select a Member" subtitle="Choose a team member to view their attendance history" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
            >
              <Text style={styles.navArrow}>◀</Text>
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
            >
              <Text style={styles.navArrow}>▶</Text>
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={styles.weekdayRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {/* Empty cells for offset */}
            {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
              <View key={`empty-${i}`} style={styles.dayCell} />
            ))}
            {daysInMonth.map((day) => {
              const log = getLogForDay(day);
              const isToday = isSameDay(day, new Date());
              return (
                <TouchableOpacity
                  key={day.toISOString()}
                  style={[
                    styles.dayCell,
                    { backgroundColor: getDayColor(log) },
                    log && { borderColor: getDayBorderColor(log), borderWidth: 1.5 },
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => {
                    if (log) {
                      setSelectedLog(log);
                      setShowDetail(true);
                    }
                  }}
                  disabled={!log}
                >
                  <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                    {format(day, 'd')}
                  </Text>
                  {log && (
                    <Text style={[styles.dayHours, { color: WORK_LOG_STATUS_CONFIG[log.status]?.color }]}>
                      {log.total_hours ? `${log.total_hours}h` : '·'}
                    </Text>
                  )}
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
      )}

      <WorkLogDetail
        visible={showDetail}
        onDismiss={() => setShowDetail(false)}
        workLog={selectedLog}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  pickerSection: { paddingHorizontal: 20, paddingTop: 12 },
  pickerButton: { borderColor: Colors.border, borderRadius: 12, justifyContent: 'flex-start' },
  menuContent: { backgroundColor: Colors.surface },
  menuItemText: { color: Colors.text, fontSize: 14 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  navArrow: { fontSize: 18, color: Colors.accent, padding: 8 },
  monthTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textTertiary,
    fontWeight: '600',
  },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    marginBottom: 2,
  },
  todayCell: { borderColor: Colors.accent, borderWidth: 1.5, backgroundColor: Colors.accentSubtle },
  dayNumber: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  todayText: { color: Colors.accent, fontWeight: '700' },
  dayHours: { fontSize: 9, marginTop: 1, fontWeight: '600' },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, color: Colors.textSecondary },
});
