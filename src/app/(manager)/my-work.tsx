// ============================================================================
// VEBOSSO EMS — Manager: My Work Screen
// ============================================================================
// Manager's own check-in, tasks, and day report (same UX as member home)

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Button, Snackbar } from 'react-native-paper';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { format, differenceInMinutes } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { CheckInModal } from '../../components/CheckInModal';
import { CheckOutModal } from '../../components/CheckOutModal';
import { TaskCard } from '../../components/TaskCard';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';

export default function ManagerMyWorkScreen() {
  const { profile } = useAuthStore();
  const { todayLog, todayTasks, isLoadingToday, fetchTodayLog, fetchTodayTasks, checkIn, checkOut, updateTaskStatus } = useWorkStore();
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState('');

  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (todayLog?.status === 'pending_approval') {
      pulseOpacity.value = withRepeat(withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) }), -1, true);
    }
  }, [todayLog?.status]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  useEffect(() => {
    if (profile) {
      fetchTodayLog(profile.id);
      fetchTodayTasks(profile.id);
    }
  }, [profile]);

  // Elapsed time counter
  useEffect(() => {
    if (todayLog?.status === 'working' && todayLog.check_in_time) {
      const interval = setInterval(() => {
        const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time!));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setElapsed(`${h}h ${m}m`);
      }, 60000);
      // Set initial
      const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time));
      setElapsed(`${Math.floor(mins / 60)}h ${mins % 60}m`);
      return () => clearInterval(interval);
    }
  }, [todayLog]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (profile) { await fetchTodayLog(profile.id); await fetchTodayTasks(profile.id); }
    setRefreshing(false);
  };

  const handleCheckIn = async (plan: string) => {
    setCheckInLoading(true);
    const result = await checkIn(plan);
    setCheckInLoading(false);
    if (result.success) { setShowCheckIn(false); setSnackMessage('Check-in submitted! Waiting for approval.'); }
    else setSnackMessage(result.error || 'Failed');
  };

  const handleCheckOut = async (report: string) => {
    const result = await checkOut(report);
    if (result.success) { setShowCheckOut(false); setSnackMessage('Day ended! Great work today. 🎉'); }
    else setSnackMessage(result.error || 'Failed');
  };

  const renderStatus = () => {
    if (isLoadingToday) return <ListSkeleton count={1} />;

    if (!todayLog) {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>☀️</Text>
          <Text style={styles.statusTitle}>Ready to start?</Text>
          <Text style={styles.statusSubtitle}>Check in to begin your work day</Text>
          <Button mode="contained" onPress={() => setShowCheckIn(true)} style={styles.startButton} contentStyle={styles.startButtonContent} buttonColor={Colors.accent} textColor={Colors.white} icon="play">
            Start Day
          </Button>
        </View>
      );
    }

    const statusConfig = WORK_LOG_STATUS_CONFIG[todayLog.status];

    if (todayLog.status === 'pending_approval') {
      return (
        <Animated.View style={[styles.statusCard, styles.pendingCard, pulseStyle]}>
          <Text style={styles.statusEmoji}>⏳</Text>
          <Text style={styles.statusTitle}>Waiting for Approval</Text>
          <Text style={styles.statusSubtitle}>Your check-in is being reviewed</Text>
          <View style={styles.pendingDots}>
            {[0, 1, 2].map((i) => <View key={i} style={[styles.dot, { backgroundColor: Colors.warning }]} />)}
          </View>
        </Animated.View>
      );
    }

    if (todayLog.status === 'working') {
      return (
        <View style={[styles.statusCard, styles.workingCard]}>
          <Text style={styles.statusEmoji}>💼</Text>
          <Text style={styles.statusTitle}>You're Working</Text>
          <View style={styles.workingInfo}>
            <View style={styles.workingDetail}>
              <Text style={styles.workingLabel}>Since</Text>
              <Text style={styles.workingValue}>{todayLog.check_in_time ? format(new Date(todayLog.check_in_time), 'hh:mm a') : '--'}</Text>
            </View>
            <View style={styles.workingDetail}>
              <Text style={styles.workingLabel}>Elapsed</Text>
              <Text style={styles.workingValue}>{elapsed}</Text>
            </View>
          </View>
          <Button mode="contained" onPress={() => setShowCheckOut(true)} style={styles.endButton} buttonColor={Colors.error} textColor={Colors.white} icon="stop">
            End Day
          </Button>
        </View>
      );
    }

    if (todayLog.status === 'done') {
      return (
        <View style={[styles.statusCard, styles.doneCard]}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.statusTitle}>Day Complete</Text>
          <Text style={styles.statusSubtitle}>
            {todayLog.total_hours ? `${todayLog.total_hours} hours worked` : 'Great work today!'}
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Work</Text>
        <Text style={styles.headerDate}>{format(new Date(), 'EEEE, MMMM dd')}</Text>
      </View>

      <View style={styles.content}>{renderStatus()}</View>

      {todayTasks.length > 0 && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          {todayTasks.map((task) => <TaskCard key={task.id} task={task} onStatusChange={updateTaskStatus} />)}
        </View>
      )}

      <CheckInModal visible={showCheckIn} onDismiss={() => setShowCheckIn(false)} onSubmit={handleCheckIn} isLoading={checkInLoading} />
      <CheckOutModal visible={showCheckOut} onDismiss={() => setShowCheckOut(false)} onSubmit={handleCheckOut} />
      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>{snackMessage}</Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 20 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: Colors.text },
  headerDate: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  content: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 20, marginBottom: 12 },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
    ...Colors.shadow,
  },
  pendingCard: { borderColor: Colors.warning },
  workingCard: { borderColor: Colors.success },
  doneCard: { borderColor: Colors.border },
  statusEmoji: { fontSize: 44, marginBottom: 10 },
  statusTitle: { fontSize: 20, fontWeight: '700', color: Colors.text },
  statusSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  startButton: { borderRadius: 14, marginTop: 20, width: '100%' },
  startButtonContent: { height: 52 },
  pendingDots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  workingInfo: { flexDirection: 'row', gap: 20, marginTop: 16, marginBottom: 16 },
  workingDetail: { alignItems: 'center' },
  workingLabel: { fontSize: 12, color: Colors.textSecondary },
  workingValue: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 2 },
  endButton: { borderRadius: 14, width: '100%' },
});
