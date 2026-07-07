// ============================================================================
// VEBOSSO EMS — Owner History Screen
// ============================================================================

import { eachDayOfInterval, endOfMonth, format, isSameDay, startOfMonth } from 'date-fns';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View, Platform, ActivityIndicator } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import { EmptyState } from '../../components/EmptyState';
import { MemberPickerModal } from '../../components/MemberPickerModal';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { Colors } from '../../constants/colors';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';
import { useWorkStore } from '../../store/workStore';
import { useAuthStore } from '../../store/authStore';
import { Profile, Task, WorkLog } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { Dialog, Portal, Snackbar } from 'react-native-paper';

export default function OwnerHistoryScreen() {
  const { profile } = useAuthStore();
  const { teamMembers, fetchTeamMembers, fetchWorkHistory, grantBackfillPermission } = useWorkStore();
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [selectedLog, setSelectedLog] = useState<WorkLog | null>(null);
  const [selectedLogTasks, setSelectedLogTasks] = useState<Task[]>([]);
  const [showDetail, setShowDetail] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [isLoading, setIsLoading] = useState(false);

  // Backfill dialog states
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [actionDialogVisible, setActionDialogVisible] = useState(false);
  const [backfillDialogVisible, setBackfillDialogVisible] = useState(false);
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const handleAuthorize = async () => {
    if (!selectedDate || !selectedMember || !profile) return;
    setIsAuthorizing(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const result = await grantBackfillPermission(selectedMember.id, dateStr, profile.id);
    setIsAuthorizing(false);
    setBackfillDialogVisible(false);
    setActionDialogVisible(false);
    
    if (result.success) {
      setSnackMessage(`Authorized backfill for ${format(selectedDate, 'MMM dd, yyyy')}! 🎉`);
    } else {
      setSnackMessage(result.error || 'Failed to authorize backfill.');
    }
  };

  const loadTasksForLog = async (log: WorkLog) => {
    if (!selectedMember) return;
    try {
      const { data } = await supabase
        .from('tasks')
        .select('*')
        .or(`work_log_id.eq.${log.id},and(assigned_to.eq.${selectedMember.id},due_date.eq.${log.date})`)
        .order('created_at', { ascending: true });
      setSelectedLogTasks((data as Task[]) || []);
    } catch {
      setSelectedLogTasks([]);
    }
  };

  const handleOpenDetails = async () => {
    setActionDialogVisible(false);
    if (!selectedLog || !selectedMember) return;
    
    setShowDetail(true);
    loadTasksForLog(selectedLog);
  };

  const currentIndex = selectedLog ? workLogs.findIndex((l) => l.id === selectedLog.id) : -1;
  const hasNextDay = selectedLog ? currentIndex > 0 : false;
  const hasPrevDay = selectedLog ? (currentIndex !== -1 && currentIndex < workLogs.length - 1) : false;

  const handleNextDay = async () => {
    if (hasNextDay && currentIndex !== -1) {
      const nextLog = workLogs[currentIndex - 1];
      setSelectedLog(nextLog);
      loadTasksForLog(nextLog);
    }
  };

  const handlePrevDay = async () => {
    if (hasPrevDay && currentIndex !== -1) {
      const prevLog = workLogs[currentIndex + 1];
      setSelectedLog(prevLog);
      loadTasksForLog(prevLog);
    }
  };

  const loadHistory = useCallback(async () => {
    if (!selectedMember) return;
    setIsLoading(true);
    const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
    const result = await fetchWorkHistory(selectedMember.id, start, end);
    setWorkLogs(result.data);
    setIsLoading(false);
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

  const minDate = new Date();
  minDate.setMonth(minDate.getMonth() - 6);
  const isMinMonth = currentMonth <= startOfMonth(minDate);
  const isMaxMonth = currentMonth >= startOfMonth(new Date());

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Attendance History</Text>
      </View>

      {/* Member Picker */}
      <View style={styles.pickerSection}>
        <Button
          mode="outlined"
          onPress={() => setPickerVisible(true)}
          style={styles.pickerButton}
          textColor={Colors.text}
          icon="account"
        >
          {selectedMember?.full_name || 'Select a member'}
        </Button>
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

      {!selectedMember ? (
        <EmptyState icon="calendar-month-outline" title="Select a Member" subtitle="Choose a team member to view their attendance history" />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Month Navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1))}
              disabled={isMinMonth}
              style={{ opacity: isMinMonth ? 0.3 : 1, padding: 8 }}
            >
              <Feather name="chevron-left" size={24} color={Colors.accent} />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
            <TouchableOpacity
              onPress={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1))}
              disabled={isMaxMonth}
              style={{ opacity: isMaxMonth ? 0.3 : 1, padding: 8 }}
            >
              <Feather name="chevron-right" size={24} color={Colors.accent} />
            </TouchableOpacity>
          </View>

          {/* Calendar Grid */}
          <View style={styles.weekdayRow}>
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <Text key={d} style={styles.weekdayLabel}>{d}</Text>
            ))}
          </View>

          {isLoading ? (
            <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
              <ActivityIndicator size="large" color={Colors.accent} />
            </View>
          ) : (
            <View style={styles.calendarGrid}>
              {/* Empty cells for offset */}
              {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
                <View key={`empty-${i}`} style={styles.dayCell} />
              ))}
              {daysInMonth.map((day) => {
                const log = getLogForDay(day);
                const isToday = isSameDay(day, new Date());
                const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
                return (
                  <TouchableOpacity
                    key={day.toISOString()}
                    style={[
                      styles.dayCell,
                      { backgroundColor: getDayColor(log) },
                      log && { borderColor: getDayBorderColor(log), borderWidth: 1.5 },
                      isToday && styles.todayCell,
                    ]}
                    onPress={async () => {
                      if (!selectedMember) return;
                      setSelectedDate(day);
                      if (log) {
                        if (isPast) {
                          setSelectedLog(log);
                          setActionDialogVisible(true);
                        } else {
                          setSelectedLog(log);
                          setShowDetail(true);
                          // Fetch tasks for this work log
                          try {
                            const { data } = await supabase
                              .from('tasks')
                              .select('*')
                              .or(`work_log_id.eq.${log.id},and(assigned_to.eq.${selectedMember.id},due_date.eq.${log.date})`)
                              .order('created_at', { ascending: true });
                            setSelectedLogTasks((data as Task[]) || []);
                          } catch {
                            setSelectedLogTasks([]);
                          }
                        }
                      } else if (isPast) {
                        setBackfillDialogVisible(true);
                      }
                    }}
                    disabled={!log && !isPast}
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
          )}

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
        onDismiss={() => {
          setShowDetail(false);
          setSelectedLogTasks([]);
        }}
        workLog={selectedLog}
        tasks={selectedLogTasks}
        onNextDay={handleNextDay}
        onPrevDay={handlePrevDay}
        hasNextDay={hasNextDay}
        hasPrevDay={hasPrevDay}
      />

      <Portal>
        {/* Action Options for existing log on a past date */}
        <Dialog visible={actionDialogVisible} onDismiss={() => setActionDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Attendance Options</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <Text style={styles.dialogText}>
              Choose an action for {selectedDate ? format(selectedDate, 'MMMM dd, yyyy') : ''} for {selectedMember?.full_name}:
            </Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <Button 
              mode="contained" 
              onPress={handleOpenDetails} 
              buttonColor={Colors.accent}
              textColor="#FFFFFF"
              style={styles.dialogButtonPrimary}
              contentStyle={styles.dialogButtonContent}
              labelStyle={styles.dialogButtonText}
            >
              View Details
            </Button>
            <Button 
              mode="contained" 
              onPress={handleAuthorize} 
              loading={isAuthorizing} 
              disabled={isAuthorizing} 
              buttonColor={Colors.systemGray6}
              textColor={Colors.warning}
              style={styles.dialogButtonSecondary}
              contentStyle={styles.dialogButtonContent}
              labelStyle={styles.dialogButtonText}
            >
              Authorize Edit
            </Button>
          </View>
        </Dialog>

        {/* Dialog for past date with NO log */}
        <Dialog visible={backfillDialogVisible} onDismiss={() => setBackfillDialogVisible(false)} style={styles.dialog}>
          <Dialog.Title style={styles.dialogTitle}>Authorize Backfill</Dialog.Title>
          <Dialog.Content style={{ paddingHorizontal: 0 }}>
            <Text style={styles.dialogText}>
              Would you like to authorize {selectedMember?.full_name} to backfill their attendance log for {selectedDate ? format(selectedDate, 'MMMM dd, yyyy') : ''}?
            </Text>
          </Dialog.Content>
          <View style={styles.dialogActions}>
            <Button 
              mode="contained"
              onPress={() => setBackfillDialogVisible(false)} 
              buttonColor={Colors.systemGray6}
              textColor={Colors.textPrimary}
              style={styles.dialogButtonSecondary}
              contentStyle={styles.dialogButtonContent}
              labelStyle={styles.dialogButtonText}
            >
              Cancel
            </Button>
            <Button 
              mode="contained"
              onPress={handleAuthorize} 
              loading={isAuthorizing} 
              disabled={isAuthorizing} 
              buttonColor={Colors.accent}
              textColor="#FFFFFF"
              style={styles.dialogButtonPrimary}
              contentStyle={styles.dialogButtonContent}
              labelStyle={styles.dialogButtonText}
            >
              Authorize
            </Button>
          </View>
        </Dialog>
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
  pickerSection: { paddingHorizontal: 20, paddingTop: 12 },
  pickerButton: { borderColor: Colors.border, borderRadius: 12, justifyContent: 'flex-start' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
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
  dialog: {
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  dialogTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    color: Colors.text,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
  },
  dialogText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    paddingHorizontal: 24,
  },
  dialogActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 16,
    gap: 10,
  },
  dialogButtonContent: {
    height: 44,
  },
  dialogButtonSecondary: {
    flex: 1,
    borderRadius: 14,
  },
  dialogButtonPrimary: {
    flex: 1,
    borderRadius: 14,
  },
  dialogButtonText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
});
