// ============================================================================
// VEBOSSO EMS — Member Home Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { differenceInMinutes, format } from 'date-fns';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { CheckInModal } from '../../components/CheckInModal';
import { CheckOutModal } from '../../components/CheckOutModal';
import { InlineError } from '../../components/InlineError';
import { StatusCardSkeleton } from '../../components/LoadingSkeleton';
import { PageTransition } from '../../components/PageTransition';
import { TaskCard } from '../../components/TaskCard';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { TaskStatus } from '../../types/database';
import { NotificationBell } from '../../components/NotificationBell';


export default function MemberHomeScreen() {
  const { profile } = useAuthStore();
  const todayLog = useWorkStore((s) => s.todayLog);
  const todayTasks = useWorkStore((s) => s.todayTasks);
  const isLoadingToday = useWorkStore((s) => s.isLoadingToday);
  const todayError = useWorkStore((s) => s.todayError);
  const fetchTodayLog = useWorkStore((s) => s.fetchTodayLog);
  const fetchTodayTasks = useWorkStore((s) => s.fetchTodayTasks);
  const fetchSettings = useWorkStore((s) => s.fetchSettings);
  const checkIn = useWorkStore((s) => s.checkIn);
  const updateCheckInPlan = useWorkStore((s) => s.updateCheckInPlan);
  const checkOut = useWorkStore((s) => s.checkOut);
  const updateTaskStatus = useWorkStore((s) => s.updateTaskStatus);
  const subscribeToRealtime = useWorkStore((s) => s.subscribeToRealtime);
  const unsubscribeFromRealtime = useWorkStore((s) => s.unsubscribeFromRealtime);

  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showEditPlan, setShowEditPlan] = useState(false);
  const [showCheckOut, setShowCheckOut] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);
  const [editPlanLoading, setEditPlanLoading] = useState(false);
  const [checkOutLoading, setCheckOutLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    
    fetchTodayLog(profile.id);
    fetchTodayTasks(profile.id);
    fetchSettings();
    subscribeToRealtime(profile.id, 'member');
    
    return () => unsubscribeFromRealtime();
  }, [profile?.id, fetchTodayLog, fetchTodayTasks, fetchSettings, subscribeToRealtime, unsubscribeFromRealtime]);

  useEffect(() => {
    if (todayLog?.status !== 'working' || !todayLog.check_in_time) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, [todayLog?.status, todayLog?.check_in_time]);

  const elapsed = useMemo(() => {
    if (todayLog?.status !== 'working' || !todayLog.check_in_time) return '';
    const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayLog?.status, todayLog?.check_in_time, tick]);

  const onRefresh = async () => {
    if (!profile?.id) return;
    
    setRefreshing(true);
    try {
      await Promise.all([
        fetchTodayLog(profile.id),
        fetchTodayTasks(profile.id),
      ]);
    } catch (error) {
      if (__DEV__) console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCheckIn = useCallback(async (plan: string) => {
    setCheckInLoading(true);
    const result = await checkIn(plan);
    setCheckInLoading(false);
    if (result.success) {
      setShowCheckIn(false);
      setSnackMessage('Check-in submitted! Waiting for approval.');
    } else {
      setSnackMessage(result.error || 'Failed to check in');
    }
  }, [checkIn]);

  const handleDismissCheckIn = useCallback(() => setShowCheckIn(false), []);
  const handleDismissEditPlan = useCallback(() => setShowEditPlan(false), []);
  const handleDismissCheckOut = useCallback(() => setShowCheckOut(false), []);

  const handleUpdatePlan = useCallback(async (plan: string) => {
    setEditPlanLoading(true);
    const result = await updateCheckInPlan(plan);
    setEditPlanLoading(false);
    if (result.success) {
      setShowEditPlan(false);
      setSnackMessage("Today's plan updated");
    } else {
      setSnackMessage(result.error || 'Failed to update plan');
    }
  }, [updateCheckInPlan]);

  const handleCheckOut = useCallback(async (report: string, photoUris: string[]) => {
    setCheckOutLoading(true);
    const result = await checkOut(report, photoUris);
    setCheckOutLoading(false);
    if (result.success) {
      setShowCheckOut(false);
      setSnackMessage('Day ended! Great work today.');
    } else {
      setSnackMessage(result.error || 'Failed to check out');
    }
  }, [checkOut]);

  const handleStatusChange = async (taskId: string, status: TaskStatus, completionNote?: string) => {
    const result = await updateTaskStatus(taskId, status, completionNote);
    if (result.success) {
      setSnackMessage(status === 'done' ? 'Task completed!' : 'Task updated');
    } else {
      setSnackMessage(result.error || 'Failed to update task.');
    }
  };

  const formatLogTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return '--';
    try {
      return format(new Date(timeStr), 'hh:mm a');
    } catch {
      return '--';
    }
  };

  const renderPlanSection = () => {
    const canEditPlan =
      todayLog?.status === 'working' || todayLog?.status === 'pending_approval';
    if (!canEditPlan) return null;

    return (
      <View style={styles.planSection}>
        <View style={styles.planHeader}>
          <Text style={rowStyles.label}>Today&apos;s Plan</Text>
          <AnimatedPressable style={styles.editPlanBtn} onPress={() => setShowEditPlan(true)}>
            <Feather name="edit-2" size={14} color={Colors.accent} />
            <Text style={styles.editPlanBtnText}>Update</Text>
          </AnimatedPressable>
        </View>
        {todayLog.check_in_plan ? (
          <Text style={styles.planText}>{todayLog.check_in_plan}</Text>
        ) : (
          <Text style={styles.planPlaceholder}>Tap Update to describe what you are working on</Text>
        )}
      </View>
    );
  };

  const renderStatusCard = () => {
    if (isLoadingToday) return <StatusCardSkeleton />;

    // Not checked in
    if (!todayLog) {
      return (
        <View style={styles.statusCard}>
          <View style={styles.statusIconCircle}>
            <Feather name="sun" size={32} color={Colors.warning} />
          </View>
          <Text style={styles.statusTitle}>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}!</Text>
          <Text style={styles.statusSubtitle}>Ready to start your work day?</Text>
          <AnimatedPressable
            style={styles.startBtn}
            onPress={() => setShowCheckIn(true)}
          >
            <Feather name="play" size={16} color={Colors.white} />
            <Text style={styles.startBtnText}>Start Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Pending approval
    if (todayLog.status === 'pending_approval') {
      return (
        <View style={styles.statusCard}>
          <View style={styles.statusIconCircle}>
            <Feather name="clock" size={32} color={Colors.warning} />
          </View>
          <Text style={styles.heroLabel}>CHECK-IN REQUEST</Text>
          <Text style={styles.heroValue}>Awaiting Approval</Text>
          <Text style={styles.statusSubtitle}>Your check-in plan is being reviewed by your manager.</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Status</Text>
              <View style={[rowStyles.badge, { backgroundColor: Colors.warningLight }]}>
                <Text style={[rowStyles.badgeText, { color: Colors.warning }]}>Pending</Text>
              </View>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-in Sent</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
          </View>

          {renderPlanSection()}

          <AnimatedPressable
            style={styles.endBtn}
            onPress={() => setShowCheckOut(true)}
          >
            <Feather name="power" size={16} color={Colors.error} />
            <Text style={styles.endBtnText}>End Day</Text>
          </AnimatedPressable>
          <Text style={styles.endDayHint}>
            You may end your day even if your check-in has not been approved.
          </Text>
        </View>
      );
    }

    // Working
    if (todayLog.status === 'working') {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.heroLabel}>ELAPSED TIME TODAY</Text>
          <Text style={styles.heroValue}>{elapsed || '00h 00m'}</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Status</Text>
              <View style={[rowStyles.badge, { backgroundColor: Colors.successLight }]}>
                <Text style={[rowStyles.badgeText, { color: Colors.memberAccent }]}>Working</Text>
              </View>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Started At</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Tasks Completed</Text>
              <Text style={rowStyles.value}>
                {todayTasks.filter((t) => t.status === 'done').length}/{todayTasks.length}
              </Text>
            </View>
          </View>

          {renderPlanSection()}

          <AnimatedPressable
            style={styles.endBtn}
            onPress={() => setShowCheckOut(true)}
          >
            <Feather name="power" size={16} color={Colors.error} />
            <Text style={styles.endBtnText}>End Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Rejected
    if (todayLog.status === 'rejected') {
      return (
        <View style={styles.statusCard}>
          <View style={styles.statusIconCircle}>
            <Feather name="x-circle" size={32} color={Colors.error} />
          </View>
          <Text style={styles.heroLabel}>CHECK-IN REJECTED</Text>
          <Text style={styles.heroValue}>Try Again</Text>
          {todayLog.rejection_reason && (
            <Text style={styles.rejectionReason}>Reason: &quot;{todayLog.rejection_reason}&quot;</Text>
          )}
          <Text style={styles.statusSubtitle}>Please update your plan and submit another check-in.</Text>
          <AnimatedPressable
            style={styles.startBtn}
            onPress={() => setShowCheckIn(true)}
          >
            <Feather name="refresh-cw" size={16} color={Colors.white} />
            <Text style={styles.startBtnText}>Re-submit Check-in</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Done
    if (todayLog.status === 'done') {
      const formattedHours = todayLog.total_hours ? `${Math.floor(todayLog.total_hours)}h ${Math.round((todayLog.total_hours % 1) * 60)}m` : '--';
      return (
        <View style={styles.statusCard}>
          <View style={styles.statusIconCircle}>
            <Feather name="check-circle" size={32} color={Colors.success} />
          </View>
          <Text style={styles.heroLabel}>TOTAL HOURS LOGGED</Text>
          <Text style={styles.heroValue}>{formattedHours}</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Status</Text>
              <View style={[rowStyles.badge, { backgroundColor: Colors.successLight }]}>
                <Text style={[rowStyles.badgeText, { color: Colors.success }]}>Completed</Text>
              </View>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-in</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-out</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_out_time)}</Text>
            </View>
          </View>
        </View>
      );
    }

    return null;
  };

  return (
    <>
    <PageTransition>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            Hello, {profile?.full_name?.split(' ')[0] || 'there'} 👋
          </Text>
          <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM dd')}</Text>
        </View>
        <NotificationBell role="member" />
      </View>

      {/* Primary Dashboard Card */}
      <View style={styles.content}>
        {todayError && !isLoadingToday ? (
          <InlineError
            message={todayError}
            onRetry={() => profile?.id && fetchTodayLog(profile.id)}
          />
        ) : (
          renderStatusCard()
        )}
      </View>

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Today&apos;s Tasks</Text>
          <View style={styles.tasksContainer}>
            {todayTasks.map((task, index) => (
              <TaskCard
                key={task.id}
                task={task}
                onStatusChange={handleStatusChange}
                isLast={index === todayTasks.length - 1}
              />
            ))}
          </View>
        </View>
      )}

    </ScrollView>
    </PageTransition>

    {showCheckIn ? (
      <CheckInModal
        visible
        onDismiss={handleDismissCheckIn}
        onSubmit={handleCheckIn}
        isLoading={checkInLoading}
      />
    ) : null}
    {showEditPlan ? (
      <CheckInModal
        visible
        mode="edit"
        initialPlan={todayLog?.check_in_plan ?? ''}
        onDismiss={handleDismissEditPlan}
        onSubmit={handleUpdatePlan}
        isLoading={editPlanLoading}
      />
    ) : null}
    {showCheckOut ? (
      <CheckOutModal
        visible
        onDismiss={handleDismissCheckOut}
        onSubmit={handleCheckOut}
        isLoading={checkOutLoading}
      />
    ) : null}
    <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>{snackMessage}</Snackbar>
    </>
  );
}

// ============================================================================
// Styles
// ============================================================================

const rowStyles = StyleSheet.create({
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.textPrimary,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
  },
  greeting: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  date: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.04)',
    ...Colors.shadowHeavy,
  },
  statusIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  statusSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  // Hero Values
  heroLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: Colors.textSecondary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  heroValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 38,
    color: Colors.textPrimary,
    letterSpacing: -1,
    marginVertical: 4,
    textAlign: 'center',
  },
  cardDetailsGroup: {
    width: '100%',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    marginTop: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.divider,
  },
  // Buttons
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 20,
    gap: 8,
  },
  startBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.white,
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.errorLight,
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 20,
    gap: 8,
  },
  endBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.error,
  },
  endDayHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  rejectionReason: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.error,
    backgroundColor: Colors.errorLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    textAlign: 'center',
  },
  // Task sections
  sectionContainer: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tasksContainer: {
    paddingTop: 4,
  },
  planSection: {
    width: '100%',
    marginTop: 16,
    padding: 16,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
  },
  planPlaceholder: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  editPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editPlanBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.accent,
  },
});
