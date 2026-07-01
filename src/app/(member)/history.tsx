// ============================================================================
// VEBOSSO EMS — Member History Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { WorkLog } from '../../types/database';
import { WorkLogDetail } from '../../components/WorkLogDetail';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';
import { Feather } from '@expo/vector-icons';
import { PageTransition } from '../../components/PageTransition';

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
            <Feather name="chevron-left" size={18} color="#1C1C1E" />
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{format(currentMonth, 'MMMM yyyy')}</Text>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1))}
            activeOpacity={0.7}
          >
            <Feather name="chevron-right" size={18} color="#1C1C1E" />
          </TouchableOpacity>
        </View>

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
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => { if (log) { setSelectedLog(log); setShowDetail(true); } }}
                  disabled={!log}
                  activeOpacity={0.6}
                >
                  <Text style={[styles.dayNumber, isToday && styles.todayText]}>
                    {format(day, 'd')}
                  </Text>
                  {log && (
                    <Text style={[styles.dayHours, { color: statusColor }]}>
                      {log.total_hours ? `${log.total_hours}h` : '·'}
                    </Text>
                  )}
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

      <WorkLogDetail visible={showDetail} onDismiss={() => setShowDetail(false)} workLog={selectedLog} />
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
    backgroundColor: '#EDEDED', // Premium Fintech light grey
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 8,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#1C1C1E',
    letterSpacing: -0.7,
  },
  scrollContent: {
    paddingHorizontal: 16,
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
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  monthTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: '#1C1C1E',
    letterSpacing: -0.2,
  },
  // Unified Summary Card
  summaryCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
    marginBottom: 20,
  },
  summaryCol: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 20,
    color: '#000000',
    letterSpacing: -0.3,
  },
  summaryLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
    color: '#8E8E93',
    marginTop: 3,
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  // Grouped Calendar Card
  calendarCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#AEAEB2',
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
    borderColor: '#000000',
    borderWidth: 1.5,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
  },
  dayNumber: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#1C1C1E',
  },
  todayText: {
    fontFamily: 'Inter_700Bold',
    color: '#000000',
  },
  dayHours: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9,
    marginTop: 1,
  },
  legendDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
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
    color: '#8E8E93',
  },
});
