// ============================================================================
// VEBOSSO EMS — Member Home Screen
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
import { NotificationBell } from '../../components/NotificationBell';
import { PageTransition } from '../../components/PageTransition';
import { TaskCard } from '../../components/TaskCard';
import {
  AppTheme as T,
  AppSpace,
  AppRadius,
  appShadow,
  appSoftShadow,
  RoleAccent,
} from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { TaskStatus } from '../../types/database';

const memberAccent = RoleAccent.member;

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

  const handleCheckIn = useCallback(async (plan: string, photoUris?: string[]) => {
    setCheckInLoading(true);
    const result = await checkIn(plan, photoUris);
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

  const doneCount = todayTasks.filter((t) => t.status === 'done').length;

  const renderPlanSection = () => {
    const canEditPlan =
      todayLog?.status === 'working' || todayLog?.status === 'pending_approval';
    if (!canEditPlan) return null;

    return (
      <View style={styles.planSection}>
        <View style={styles.planHeader}>
          <Text style={styles.detailLabel}>Today&apos;s Plan</Text>
          <AnimatedPressable
            style={styles.editPlanBtn}
            onPress={() => setShowEditPlan(true)}
            accessibilityRole="button"
            accessibilityLabel="Update today's plan"
          >
            <Feather name="edit-2" size={14} color={T.inkSoft} />
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
          <View style={[styles.statusIconCircle, { backgroundColor: T.amberSoft }]}>
            <Feather name="sun" size={28} color={T.amber} />
          </View>
          <Text style={styles.statusTitle}>
            Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}!
          </Text>
          <Text style={styles.statusSubtitle}>Ready to start your work day?</Text>
          <AnimatedPressable
            style={styles.primaryBtn}
            onPress={() => setShowCheckIn(true)}
            accessibilityRole="button"
            accessibilityLabel="Start day"
          >
            <Feather name="play" size={16} color={T.white} />
            <Text style={styles.primaryBtnText}>Start Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Pending approval
    if (todayLog.status === 'pending_approval') {
      return (
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.amberSoft }]}>
            <Feather name="clock" size={28} color={T.amber} />
          </View>
          <View style={[styles.stateChip, { backgroundColor: T.amberSoft }]}>
            <Text style={[styles.stateChipText, { color: T.amber }]}>Awaiting approval</Text>
          </View>
          <Text style={styles.heroValue}>Check-in sent</Text>
          <Text style={styles.statusSubtitle}>
            Your manager is reviewing your plan. You can still end your day if needed.
          </Text>

          <View style={styles.cardDetailsGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Sent at</Text>
              <Text style={styles.detailValue}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
          </View>

          {renderPlanSection()}

          <AnimatedPressable
            style={styles.destructiveBtn}
            onPress={() => setShowCheckOut(true)}
            accessibilityRole="button"
            accessibilityLabel="End day"
          >
            <Feather name="power" size={16} color={T.coral} />
            <Text style={styles.destructiveBtnText}>End Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Working
    if (todayLog.status === 'working') {
      return (
        <View style={styles.statusCard}>
          <View style={[styles.stateChip, { backgroundColor: memberAccent.soft }]}>
            <View style={[styles.stateDot, { backgroundColor: memberAccent.color }]} />
            <Text style={[styles.stateChipText, { color: memberAccent.color }]}>Working</Text>
          </View>
          <Text style={styles.heroLabel}>Elapsed today</Text>
          <Text style={styles.heroValue}>{elapsed || '00h 00m'}</Text>

          <View style={styles.cardDetailsGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Started</Text>
              <Text style={styles.detailValue}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            {todayTasks.length > 0 ? (
              <>
                <View style={styles.detailSeparator} />
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tasks done</Text>
                  <Text style={styles.detailValue}>
                    {doneCount}/{todayTasks.length}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {renderPlanSection()}

          <AnimatedPressable
            style={styles.destructiveBtn}
            onPress={() => setShowCheckOut(true)}
            accessibilityRole="button"
            accessibilityLabel="End day"
          >
            <Feather name="power" size={16} color={T.coral} />
            <Text style={styles.destructiveBtnText}>End Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Rejected
    if (todayLog.status === 'rejected') {
      return (
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.coralSoft }]}>
            <Feather name="x-circle" size={28} color={T.coral} />
          </View>
          <View style={[styles.stateChip, { backgroundColor: T.coralSoft }]}>
            <Text style={[styles.stateChipText, { color: T.coral }]}>Rejected</Text>
          </View>
          <Text style={styles.heroValue}>Try again</Text>
          {todayLog.rejection_reason ? (
            <Text style={styles.rejectionReason}>{todayLog.rejection_reason}</Text>
          ) : null}
          <Text style={styles.statusSubtitle}>
            Update your plan and submit another check-in.
          </Text>
          <AnimatedPressable
            style={styles.primaryBtn}
            onPress={() => setShowCheckIn(true)}
            accessibilityRole="button"
            accessibilityLabel="Re-submit check-in"
          >
            <Feather name="refresh-cw" size={16} color={T.white} />
            <Text style={styles.primaryBtnText}>Re-submit Check-in</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Pending checkout approval
    if (todayLog.status === 'pending_checkout') {
      return (
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.amberSoft }]}>
            <Feather name="clock" size={28} color={T.amber} />
          </View>
          <View style={[styles.stateChip, { backgroundColor: T.amberSoft }]}>
            <Text style={[styles.stateChipText, { color: T.amber }]}>Checkout pending</Text>
          </View>
          <Text style={styles.heroValue}>Awaiting review</Text>
          <Text style={styles.statusSubtitle}>
            Your day report is with your manager.
          </Text>

          <View style={styles.cardDetailsGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-in</Text>
              <Text style={styles.detailValue}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={styles.detailSeparator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-out sent</Text>
              <Text style={styles.detailValue}>{formatLogTime(todayLog.check_out_time)}</Text>
            </View>
          </View>
        </View>
      );
    }

    // Done
    if (todayLog.status === 'done') {
      const formattedHours = todayLog.total_hours
        ? `${Math.floor(todayLog.total_hours)}h ${Math.round((todayLog.total_hours % 1) * 60)}m`
        : '--';
      return (
        <View style={styles.statusCard}>
          <View style={[styles.statusIconCircle, { backgroundColor: T.greenSoft }]}>
            <Feather name="check-circle" size={28} color={T.green} />
          </View>
          <View style={[styles.stateChip, { backgroundColor: T.greenSoft }]}>
            <Text style={[styles.stateChipText, { color: T.green }]}>Day complete</Text>
          </View>
          <Text style={styles.heroLabel}>Hours logged</Text>
          <Text style={styles.heroValue}>{formattedHours}</Text>

          <View style={styles.cardDetailsGroup}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-in</Text>
              <Text style={styles.detailValue}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
            <View style={styles.detailSeparator} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Check-out</Text>
              <Text style={styles.detailValue}>{formatLogTime(todayLog.check_out_time)}</Text>
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                Hello, {profile?.full_name?.split(' ')[0] || 'there'}
              </Text>
              <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM dd')}</Text>
            </View>
            <NotificationBell role="member" />
          </View>

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
      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        wrapperStyle={{ marginBottom: 90 }}
      >
        {snackMessage}
      </Snackbar>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: T.bg,
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
    paddingHorizontal: AppSpace.screen,
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 12,
  },
  greeting: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    color: T.ink,
    letterSpacing: -0.9,
  },
  date: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    marginTop: 3,
  },
  content: {
    paddingHorizontal: AppSpace.screen,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.hero,
    padding: 24,
    alignItems: 'center',
    ...appShadow,
  },
  statusIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: AppRadius.pill,
    marginBottom: 10,
  },
  stateDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  stateChipText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    letterSpacing: -0.1,
  },
  statusTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    color: T.ink,
    letterSpacing: -0.4,
  },
  statusSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.inkSoft,
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  heroLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.mute,
    letterSpacing: -0.1,
    textAlign: 'center',
  },
  heroValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 36,
    color: T.ink,
    letterSpacing: -0.9,
    marginVertical: 2,
    textAlign: 'center',
  },
  cardDetailsGroup: {
    width: '100%',
    backgroundColor: T.soft,
    borderRadius: 16,
    marginTop: 18,
    overflow: 'hidden',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  detailLabel: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.inkSoft,
  },
  detailValue: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.ink,
  },
  detailSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.hairline,
    marginHorizontal: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.charcoal,
    borderRadius: AppRadius.pill,
    width: '100%',
    height: 52,
    marginTop: 22,
    gap: 8,
    ...appSoftShadow,
  },
  primaryBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.white,
    letterSpacing: -0.1,
  },
  destructiveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.coralSoft,
    borderRadius: AppRadius.pill,
    width: '100%',
    height: 52,
    marginTop: 20,
    gap: 8,
  },
  destructiveBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.coral,
    letterSpacing: -0.1,
  },
  rejectionReason: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.coral,
    backgroundColor: T.coralSoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    marginTop: 10,
    textAlign: 'center',
    overflow: 'hidden',
  },
  sectionContainer: {
    marginTop: AppSpace.xxl,
    paddingHorizontal: AppSpace.screen,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.ink,
    letterSpacing: -0.35,
    marginBottom: 10,
  },
  tasksContainer: {
    paddingTop: 2,
    gap: 10,
  },
  planSection: {
    width: '100%',
    marginTop: 16,
    padding: 16,
    backgroundColor: T.soft,
    borderRadius: 16,
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
    color: T.ink,
    lineHeight: 20,
  },
  planPlaceholder: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    color: T.mute,
    lineHeight: 20,
  },
  editPlanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  editPlanBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.inkSoft,
  },
});
