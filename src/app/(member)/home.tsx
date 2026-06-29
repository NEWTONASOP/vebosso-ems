// ============================================================================
// VEBOSSO EMS — Member Home Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Button, Snackbar } from 'react-native-paper';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing, FadeInDown } from 'react-native-reanimated';
import { format, differenceInMinutes } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { CheckInModal } from '../../components/CheckInModal';
import { CheckOutModal } from '../../components/CheckOutModal';
import { TaskCard } from '../../components/TaskCard';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { WORK_LOG_STATUS_CONFIG } from '../../constants/roles';

export default function MemberHomeScreen() {
  const { profile } = useAuthStore();
  const {
    todayLog, todayTasks, isLoadingToday,
    fetchTodayLog, fetchTodayTasks, fetchSettings,
    checkIn, checkOut, updateTaskStatus,
    subscribeToRealtime, unsubscribeFromRealtime,
  } = useWorkStore();

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [elapsed, setElapsed] = useState('');

  // Pulse animation for pending status
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (todayLog?.status === 'pending_approval') {
      pulseScale.value = withRepeat(
        withTiming(1.05, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
      pulseOpacity.value = withRepeat(
        withTiming(0.5, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        -1, true
      );
    } else {
      pulseScale.value = 1;
      pulseOpacity.value = 1;
    }
  }, [todayLog?.status]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  useEffect(() => {
    if (profile) {
      fetchTodayLog(profile.id);
      fetchTodayTasks(profile.id);
      fetchSettings();
      subscribeToRealtime(profile.id, 'member');
    }
    return () => unsubscribeFromRealtime();
  }, [profile]);

  // Elapsed time counter
  useEffect(() => {
    if (todayLog?.status === 'working' && todayLog.check_in_time) {
      const updateElapsed = () => {
        const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time!));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setElapsed(`${h}h ${m}m`);
      };
      updateElapsed();
      const interval = setInterval(updateElapsed, 60000);
      return () => clearInterval(interval);
    }
  }, [todayLog]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (profile) {
      await fetchTodayLog(profile.id);
      await fetchTodayTasks(profile.id);
    }
    setRefreshing(false);
  };

  const handleCheckIn = async (plan: string) => {
    setCheckInLoading(true);
    const result = await checkIn(plan);
    setCheckInLoading(false);
    if (result.success) {
      setShowCheckIn(false);
      setSnackMessage('Check-in submitted! Waiting for approval. ⏳');
    } else {
      setSnackMessage(result.error || 'Failed to check in');
    }
  };

  const handleCheckOut = async (report: string) => {
    const result = await checkOut(report);
    if (result.success) {
      setShowCheckOut(false);
      setSnackMessage('Day ended! Great work today. 🎉');
    } else {
      setSnackMessage(result.error || 'Failed to check out');
    }
  };

  const renderStatusCard = () => {
    if (isLoadingToday) return <ListSkeleton count={1} />;

    // Not checked in
    if (!todayLog) {
      return (
        <Animated.View entering={FadeInDown.duration(600)} style={styles.statusCard}>
          <Text style={styles.statusEmoji}>☀️</Text>
          <Text style={styles.statusTitle}>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}!</Text>
          <Text style={styles.statusSubtitle}>Ready to start your work day?</Text>
          <Button
            mode="contained"
            onPress={() => setShowCheckIn(true)}
            style={styles.startButton}
            contentStyle={styles.startButtonContent}
            buttonColor={Colors.accent}
            textColor={Colors.white}
            labelStyle={styles.startButtonLabel}
            icon="play-circle"
          >
            Start Day
          </Button>
        </Animated.View>
      );
    }

    // Pending approval
    if (todayLog.status === 'pending_approval') {
      return (
        <View style={[styles.statusCard, styles.pendingCard]}>
          <Animated.View style={pulseStyle}>
            <Text style={styles.statusEmoji}>⏳</Text>
          </Animated.View>
          <Text style={styles.statusTitle}>Waiting for Approval</Text>
          <Text style={styles.statusSubtitle}>
            Your check-in is being reviewed by your manager
          </Text>
          <View style={styles.pendingDots}>
            <Animated.View style={[styles.dot, { backgroundColor: Colors.warning }, pulseStyle]} />
            <Animated.View style={[styles.dot, { backgroundColor: Colors.warning }, pulseStyle]} />
            <Animated.View style={[styles.dot, { backgroundColor: Colors.warning }, pulseStyle]} />
          </View>
          <View style={styles.pendingInfo}>
            <Text style={styles.pendingInfoText}>
              Checked in at {todayLog.check_in_time ? format(new Date(todayLog.check_in_time), 'hh:mm a') : '--'}
            </Text>
          </View>
        </View>
      );
    }

    // Working
    if (todayLog.status === 'working') {
      return (
        <View style={[styles.statusCard, styles.workingCard]}>
          <Text style={styles.statusEmoji}>💼</Text>
          <Text style={styles.statusTitle}>You're Working!</Text>

          <View style={styles.workingStats}>
            <View style={styles.workingStat}>
              <Text style={styles.workingStatLabel}>Started</Text>
              <Text style={styles.workingStatValue}>
                {todayLog.check_in_time ? format(new Date(todayLog.check_in_time), 'hh:mm a') : '--'}
              </Text>
            </View>
            <View style={styles.workingDivider} />
            <View style={styles.workingStat}>
              <Text style={styles.workingStatLabel}>Elapsed</Text>
              <Text style={styles.workingStatValue}>{elapsed}</Text>
            </View>
            <View style={styles.workingDivider} />
            <View style={styles.workingStat}>
              <Text style={styles.workingStatLabel}>Tasks</Text>
              <Text style={styles.workingStatValue}>
                {todayTasks.filter((t) => t.status === 'done').length}/{todayTasks.length}
              </Text>
            </View>
          </View>

          <Button
            mode="contained"
            onPress={() => setShowCheckOut(true)}
            style={styles.endButton}
            contentStyle={styles.endButtonContent}
            buttonColor={Colors.error}
            textColor={Colors.white}
            icon="stop-circle"
          >
            End Day
          </Button>
        </View>
      );
    }

    // Rejected
    if (todayLog.status === 'rejected') {
      return (
        <View style={[styles.statusCard, styles.rejectedCard]}>
          <Text style={styles.statusEmoji}>❌</Text>
          <Text style={styles.statusTitle}>Check-in Rejected</Text>
          {todayLog.rejection_reason && (
            <Text style={styles.rejectionReason}>"{todayLog.rejection_reason}"</Text>
          )}
          <Text style={styles.statusSubtitle}>Please try again with an updated plan</Text>
        </View>
      );
    }

    // Done
    if (todayLog.status === 'done') {
      return (
        <View style={[styles.statusCard, styles.doneCard]}>
          <Text style={styles.statusEmoji}>✅</Text>
          <Text style={styles.statusTitle}>Day Complete!</Text>
          <View style={styles.doneStats}>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatLabel}>Check-in</Text>
              <Text style={styles.doneStatValue}>
                {todayLog.check_in_time ? format(new Date(todayLog.check_in_time), 'hh:mm a') : '--'}
              </Text>
            </View>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatLabel}>Check-out</Text>
              <Text style={styles.doneStatValue}>
                {todayLog.check_out_time ? format(new Date(todayLog.check_out_time), 'hh:mm a') : '--'}
              </Text>
            </View>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatLabel}>Hours</Text>
              <Text style={[styles.doneStatValue, { color: Colors.success }]}>
                {todayLog.total_hours ? `${todayLog.total_hours}h` : '--'}
              </Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Hello, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM dd, yyyy')}</Text>
        </View>
      </View>

      {/* Status Card */}
      <View style={styles.content}>
        {renderStatusCard()}
      </View>

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          {todayTasks.map((task) => (
            <TaskCard key={task.id} task={task} onStatusChange={updateTaskStatus} />
          ))}
        </View>
      )}

      <CheckInModal visible={showCheckIn} onDismiss={() => setShowCheckIn(false)} onSubmit={handleCheckIn} isLoading={checkInLoading} />
      <CheckOutModal visible={showCheckOut} onDismiss={() => setShowCheckOut(false)} onSubmit={handleCheckOut} />
      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} style={styles.snackbar}>{snackMessage}</Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 20 },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  greeting: { fontSize: 26, fontWeight: '800', color: Colors.text },
  date: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  content: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 24, marginBottom: 12 },
  statusCard: { backgroundColor: Colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: Colors.border, marginTop: 8 },
  pendingCard: { borderColor: Colors.warning },
  workingCard: { borderColor: Colors.success },
  rejectedCard: { borderColor: Colors.error },
  doneCard: { borderColor: Colors.textTertiary },
  statusEmoji: { fontSize: 48, marginBottom: 12 },
  statusTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  statusSubtitle: { fontSize: 14, color: Colors.textSecondary, marginTop: 6, textAlign: 'center' },
  startButton: { borderRadius: 16, marginTop: 24, width: '100%' },
  startButtonContent: { height: 56 },
  startButtonLabel: { fontSize: 18, fontWeight: '700' },
  pendingDots: { flexDirection: 'row', gap: 8, marginTop: 16 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  pendingInfo: { marginTop: 12, backgroundColor: Colors.warningLight, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  pendingInfoText: { fontSize: 12, color: Colors.warning, fontWeight: '600' },
  workingStats: { flexDirection: 'row', marginTop: 20, marginBottom: 20, width: '100%', justifyContent: 'space-around' },
  workingStat: { alignItems: 'center' },
  workingStatLabel: { fontSize: 12, color: Colors.textSecondary },
  workingStatValue: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 4 },
  workingDivider: { width: 1, height: 40, backgroundColor: Colors.divider },
  endButton: { borderRadius: 14, width: '100%' },
  endButtonContent: { height: 50 },
  rejectionReason: { fontSize: 14, color: Colors.error, fontStyle: 'italic', marginTop: 8, textAlign: 'center' },
  doneStats: { flexDirection: 'row', marginTop: 16, width: '100%', justifyContent: 'space-around' },
  doneStat: { alignItems: 'center' },
  doneStatLabel: { fontSize: 12, color: Colors.textSecondary },
  doneStatValue: { fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 4 },
  snackbar: { backgroundColor: Colors.surfaceLight },
});
