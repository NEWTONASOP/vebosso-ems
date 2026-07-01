// ============================================================================
// VEBOSSO EMS — Member Home Screen (Premium Fintech / Apple Wallet Aesthetic)
// ============================================================================

import { differenceInMinutes, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, Platform, Pressable } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { CheckInModal } from '../../components/CheckInModal';
import { CheckOutModal } from '../../components/CheckOutModal';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { TaskCard } from '../../components/TaskCard';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Feather } from '@expo/vector-icons';
import { TaskStatus } from '../../types/database';

import { PageTransition } from '../../components/PageTransition';
import { AnimatedPressable } from '../../components/AnimatedPressable';

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
  }, [profile?.id]);

  // Elapsed time counter
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    
    if (todayLog?.status === 'working' && todayLog.check_in_time) {
      const updateElapsed = () => {
        const mins = differenceInMinutes(new Date(), new Date(todayLog.check_in_time!));
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        setElapsed(`${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`);
      };
      updateElapsed();
      interval = setInterval(updateElapsed, 60000);
    } else {
      setElapsed('');
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [todayLog?.status, todayLog?.check_in_time]);

  const onRefresh = async () => {
    if (!profile?.id) return;
    
    setRefreshing(true);
    try {
      await Promise.all([
        fetchTodayLog(profile.id),
        fetchTodayTasks(profile.id),
      ]);
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
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

  const handleStatusChange = async (taskId: string, status: TaskStatus) => {
    try {
      await updateTaskStatus(taskId, status);
      setSnackMessage(status === 'done' ? 'Task completed! ✅' : 'Task updated');
    } catch {
      setSnackMessage('Failed to update task');
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

  const renderStatusCard = () => {
    if (isLoadingToday) return <ListSkeleton count={1} />;

    // Not checked in
    if (!todayLog) {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>☀️</Text>
          <Text style={styles.statusTitle}>Good {new Date().getHours() < 12 ? 'morning' : 'afternoon'}!</Text>
          <Text style={styles.statusSubtitle}>Ready to start your work day?</Text>
          <AnimatedPressable
            style={styles.startBtn}
            onPress={() => setShowCheckIn(true)}
          >
            <Feather name="play" size={16} color="#FFFFFF" />
            <Text style={styles.startBtnText}>Start Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Pending approval
    if (todayLog.status === 'pending_approval') {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>⏳</Text>
          <Text style={styles.heroLabel}>CHECK-IN REQUEST</Text>
          <Text style={styles.heroValue}>Awaiting Approval</Text>
          <Text style={styles.statusSubtitle}>Your check-in plan is being reviewed by your manager.</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Status</Text>
              <View style={[rowStyles.badge, { backgroundColor: '#FEF7E0' }]}>
                <Text style={[rowStyles.badgeText, { color: '#B06000' }]}>Pending</Text>
              </View>
            </View>
            <View style={rowStyles.separator} />
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Check-in Sent</Text>
              <Text style={rowStyles.value}>{formatLogTime(todayLog.check_in_time)}</Text>
            </View>
          </View>
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
              <View style={[rowStyles.badge, { backgroundColor: '#E8F0FE' }]}>
                <Text style={[rowStyles.badgeText, { color: '#1A73E8' }]}>Working</Text>
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

          <AnimatedPressable
            style={styles.endBtn}
            onPress={() => setShowCheckOut(true)}
          >
            <Feather name="power" size={16} color="#FF3B30" />
            <Text style={styles.endBtnText}>End Day</Text>
          </AnimatedPressable>
        </View>
      );
    }

    // Rejected
    if (todayLog.status === 'rejected') {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusEmoji}>❌</Text>
          <Text style={styles.heroLabel}>CHECK-IN REJECTED</Text>
          <Text style={styles.heroValue}>Try Again</Text>
          {todayLog.rejection_reason && (
            <Text style={styles.rejectionReason}>Reason: "{todayLog.rejection_reason}"</Text>
          )}
          <Text style={styles.statusSubtitle}>Please update your plan and submit another check-in.</Text>
          <AnimatedPressable
            style={styles.startBtn}
            onPress={() => setShowCheckIn(true)}
          >
            <Feather name="refresh-cw" size={16} color="#FFFFFF" />
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
          <Text style={styles.statusEmoji}>🎉</Text>
          <Text style={styles.heroLabel}>TOTAL HOURS LOGGED</Text>
          <Text style={styles.heroValue}>{formattedHours}</Text>
          
          <View style={styles.cardDetailsGroup}>
            <View style={rowStyles.rowContent}>
              <Text style={rowStyles.label}>Status</Text>
              <View style={[rowStyles.badge, { backgroundColor: '#E6F4EA' }]}>
                <Text style={[rowStyles.badgeText, { color: '#137333' }]}>Completed</Text>
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
    <PageTransition>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Hello, {profile?.full_name?.split(' ')[0] || 'there'} 👋
        </Text>
        <Text style={styles.date}>{format(new Date(), 'EEEE, MMMM dd')}</Text>
      </View>

      {/* Primary Dashboard Card */}
      <View style={styles.content}>
        {renderStatusCard()}
      </View>

      {/* Today's Tasks in unified Grouped Card */}
      {todayTasks.length > 0 && (
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Today's Tasks</Text>
          <View style={styles.groupedCard}>
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

      <CheckInModal visible={showCheckIn} onDismiss={() => setShowCheckIn(false)} onSubmit={handleCheckIn} isLoading={checkInLoading} />
      <CheckOutModal visible={showCheckOut} onDismiss={() => setShowCheckOut(false)} onSubmit={handleCheckOut} />
      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>{snackMessage}</Snackbar>
    </ScrollView>
    </PageTransition>
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
    color: '#8E8E93',
  },
  value: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#1C1C1E',
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
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 16,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED', // Premium Fintech light grey
  },
  scrollContent: {
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 12,
  },
  greeting: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#1C1C1E',
    letterSpacing: -0.7,
  },
  date: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  statusCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
  statusEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  statusTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: '#1C1C1E',
    letterSpacing: -0.4,
  },
  statusSubtitle: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 8,
  },
  // Hero Values
  heroLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    color: '#8E8E93',
    letterSpacing: 1,
  },
  heroValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 38,
    color: '#000000',
    letterSpacing: -1,
    marginVertical: 4,
  },
  cardDetailsGroup: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    marginTop: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
  },
  // Buttons
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000', // Solid Black Fintech style
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 20,
    gap: 8,
  },
  startBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  endBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 59, 48, 0.08)', // Soft red
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 20,
    gap: 8,
  },
  endBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: '#FF3B30',
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  rejectionReason: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#FF3B30',
    backgroundColor: 'rgba(255, 59, 48, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
    textAlign: 'center',
  },
  // Task sections
  sectionContainer: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#8E8E93',
    marginBottom: 8,
    marginLeft: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  groupedCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
});
