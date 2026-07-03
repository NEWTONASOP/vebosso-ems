// ============================================================================
// VEBOSSO EMS — Manager: My Work Screen
// ============================================================================
// Manager's own check-in, tasks, and day report (same UX as member home)

import { Feather } from '@expo/vector-icons';
import { differenceInMinutes, format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Snackbar, Text } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { CheckInModal } from '../../components/CheckInModal';
import { CheckOutModal } from '../../components/CheckOutModal';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { TaskCard } from '../../components/TaskCard';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';

export default function ManagerMyWorkScreen() {
  const router = useRouter();
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
  }, [todayLog?.status, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  useEffect(() => {
    if (profile) {
      fetchTodayLog(profile.id);
      fetchTodayTasks(profile.id);
    }
  }, [profile, fetchTodayLog, fetchTodayTasks]);

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
      // eslint-disable-next-line
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
          <Text style={styles.statusTitle}>You&apos;re Working</Text>
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
        <View>
          <Text style={styles.headerTitle}>My Work</Text>
          <Text style={styles.headerDate}>{format(new Date(), 'EEEE, MMMM dd')}</Text>
        </View>
        <Pressable style={({ pressed }) => [styles.headerAction, pressed && styles.headerActionPressed]} onPress={() => router.push('/(manager)/settings')}>
          <Feather name="settings" size={20} color={Colors.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.content}>{renderStatus()}</View>

      {todayTasks.length > 0 && (
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
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
  scrollContent: { paddingBottom: 110 },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 12 },
  headerTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  headerDate: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  headerActionPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  content: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 20, marginBottom: 12 },
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
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  settingsButtonPressed: {
    backgroundColor: Colors.surfacePressed,
  },
  pendingCard: { borderColor: Colors.warning },
  workingCard: { borderColor: Colors.success },
  doneCard: { borderColor: Colors.border },
  statusEmoji: { fontSize: 44, marginBottom: 10 },
  statusTitle: { fontSize: 20, fontFamily: 'Inter_700Bold', color: Colors.text },
  statusSubtitle: { fontSize: 14, fontFamily: 'Inter_500Medium', color: Colors.textSecondary, marginTop: 4, textAlign: 'center' },
  startButton: { borderRadius: 14, marginTop: 20, width: '100%' },
  startButtonContent: { height: 52 },
  pendingDots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  workingInfo: { flexDirection: 'row', gap: 20, marginTop: 16, marginBottom: 16 },
  workingDetail: { alignItems: 'center' },
  workingLabel: { fontSize: 12, fontFamily: 'Inter_500Medium', color: Colors.textSecondary },
  workingValue: { fontSize: 18, fontFamily: 'Inter_700Bold', color: Colors.text, marginTop: 2 },
  endButton: { borderRadius: 14, width: '100%' },
});
