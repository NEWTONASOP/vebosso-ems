// ============================================================================
// VEBOSSO EMS — Manager Dashboard (Premium Fintech Aesthetic)
// ============================================================================

import { format } from 'date-fns';
import React, { useCallback, useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { ApprovalCard } from '../../components/ApprovalCard';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Feather } from '@expo/vector-icons';

export default function ManagerDashboard() {
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
  }, [profile?.id]);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    
    loadData();
    subscribeToRealtime(profile.id, 'manager', profile.id);
    
    return () => unsubscribeFromRealtime();
  }, [profile?.id]);

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
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />}
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
      <View style={styles.statsGrid}>
        <StatCard
          icon="users"
          iconColor="#007AFF"
          value={stats.totalMembers.toString()}
          label="Team Members"
        />
        <StatCard
          icon="check-circle"
          iconColor="#34C759"
          value={stats.activeNow.toString()}
          label="Active Now"
        />
        <StatCard
          icon="sun"
          iconColor="#FF9500"
          value={stats.onLeaveToday.toString()}
          label="On Leave"
        />
        <StatCard
          icon="clock"
          iconColor="#5856D6"
          value={stats.pendingApprovals.toString()}
          label="Pending"
        />
      </View>

      {/* Pending Approvals */}
      <Text style={styles.sectionTitle}>
        Pending Approvals {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
      </Text>

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
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
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
    color: '#000000',
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: '#8E8E93',
    marginTop: 2,
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
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: '#8E8E93',
  },
  name: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#1C1C1E',
    marginTop: 2,
    letterSpacing: -0.7,
  },
  date: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: '#AEAEB2',
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#8E8E93',
    paddingHorizontal: 28,
    marginTop: 26,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
  },
  listContainer: {
    paddingHorizontal: 16,
  },
  emptyCard: {
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
});
