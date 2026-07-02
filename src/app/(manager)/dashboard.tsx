// ============================================================================
// VEBOSSO EMS — Manager Dashboard (Premium Fintech Aesthetic)
// ============================================================================

import { format } from 'date-fns';
import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { ApprovalCard } from '../../components/ApprovalCard';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton, StatsSkeleton } from '../../components/LoadingSkeleton';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { useRouter } from 'expo-router';

export default function ManagerDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    stats, pendingApprovals, isLoadingApprovals,
    fetchStats, fetchPendingApprovals, fetchSettings,
    approveCheckIn, rejectCheckIn,
    subscribeToRealtime, unsubscribeFromRealtime,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    await Promise.all([
      fetchStats(profile.id),
      fetchPendingApprovals(profile.id),
      fetchSettings(),
    ]);
  }, [profile, fetchStats, fetchPendingApprovals, fetchSettings]);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    
    loadData();
    subscribeToRealtime(profile.id, 'manager', profile.id);
    
    return () => unsubscribeFromRealtime();
  }, [profile, loadData, subscribeToRealtime, unsubscribeFromRealtime]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (workLogId: string) => {
    if (!profile?.id) return;
    try {
      await approveCheckIn(workLogId, profile.id);
    } catch (e) {
      console.error('Approve error:', e);
    }
  };

  const handleReject = async (workLogId: string) => {
    if (!profile?.id) return;
    try {
      await rejectCheckIn(workLogId, profile.id, 'Please revise your plan');
    } catch (e) {
      console.error('Reject error:', e);
    }
  };

  const today = format(new Date(), 'EEEE, MMMM dd');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
        </Text>
        <Text style={styles.name}>{profile?.full_name?.split(' ')[0] || 'Manager'} 👋</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      {/* Stats Cards Dashboard widgets */}
      <Text style={styles.sectionTitle}>My Team Overview</Text>
      {isLoadingApprovals && stats.totalMembers === 0 ? (
        <View style={styles.statsSkeletonContainer}>
          <StatsSkeleton />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            icon="users"
            iconColor={Colors.managerAccent}
            value={stats.totalMembers.toString()}
            label="Team Members"
          />
          <StatCard
            icon="check-circle"
            iconColor={Colors.success}
            value={stats.activeNow.toString()}
            label="Active Now"
          />
          <StatCard
            icon="sun"
            iconColor={Colors.warning}
            value={stats.onLeaveToday.toString()}
            label="On Leave"
          />
          <StatCard
            icon="clock"
            iconColor={Colors.info}
            value={stats.pendingApprovals.toString()}
            label="Pending"
          />
        </View>
      )}

      {/* Pending Approvals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Pending Approvals {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
        </Text>
        {pendingApprovals.length > 5 && (
          <Text style={styles.viewAllBtn} onPress={() => router.push('/(manager)/approvals')}>
            View All
          </Text>
        )}
      </View>

      <View style={styles.listContainer}>
        {isLoadingApprovals ? (
          <ListSkeleton count={2} />
        ) : pendingApprovals.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="checkbox-marked-circle-outline"
              title="All caught up!"
              subtitle="No pending approvals from your team"
            />
          </View>
        ) : (
          pendingApprovals.slice(0, 5).map((workLog) => (
            <ApprovalCard
              key={workLog.id}
              workLog={workLog}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

// ============================================================================
// Stat Card component
// ============================================================================

interface StatCardProps {
  icon: string;
  iconColor: string;
  value: string;
  label: string;
}

function StatCard({ icon, iconColor, value, label }: StatCardProps) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconBg, { backgroundColor: iconColor + '12' }]}>
        <Feather name={icon as any} size={18} color={iconColor} />
      </View>
      <Text style={statStyles.value}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  iconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 2,
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
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
  },
  greeting: {
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: Colors.textSecondary,
  },
  name: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    marginTop: 2,
    letterSpacing: -0.7,
  },
  date: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 20,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 26,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  viewAllBtn: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.accent,
    marginTop: 26,
    marginBottom: 12,
  },
  statsSkeletonContainer: {
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
});
