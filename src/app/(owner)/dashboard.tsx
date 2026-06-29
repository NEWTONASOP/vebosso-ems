// ============================================================================
// VEBOSSO EMS — Owner Dashboard
// ============================================================================

import React, { useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Surface } from 'react-native-paper';
import { format } from 'date-fns';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { StatsSkeleton, ListSkeleton } from '../../components/LoadingSkeleton';
import { ApprovalCard } from '../../components/ApprovalCard';
import { EmptyState } from '../../components/EmptyState';

export default function OwnerDashboard() {
  const { profile } = useAuthStore();
  const {
    stats,
    pendingApprovals,
    isLoadingApprovals,
    fetchStats,
    fetchPendingApprovals,
    fetchSettings,
    approveCheckIn,
    rejectCheckIn,
    subscribeToRealtime,
    unsubscribeFromRealtime,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchPendingApprovals(),
      fetchSettings(),
    ]);
  }, []);

  useEffect(() => {
    loadData();
    if (profile) {
      subscribeToRealtime(profile.id, 'owner');
    }
    return () => unsubscribeFromRealtime();
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (workLogId: string) => {
    if (!profile) return;
    try {
      await approveCheckIn(workLogId, profile.id);
    } catch (e) {
      console.error(e);
    }
  };

  const handleReject = async (workLogId: string) => {
    if (!profile) return;
    try {
      await rejectCheckIn(workLogId, profile.id, 'Please revise your plan');
    } catch (e) {
      console.error(e);
    }
  };

  const today = format(new Date(), 'EEEE, MMMM dd');

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
          </Text>
          <Text style={styles.name}>{profile?.full_name || 'Owner'} 👋</Text>
          <Text style={styles.date}>{today}</Text>
        </View>
      </View>

      {/* Stats Cards */}
      <Text style={styles.sectionTitle}>Overview</Text>
      <View style={styles.statsGrid}>
        <StatCard
          emoji="👥"
          value={stats.totalMembers.toString()}
          label="Total Members"
          color={Colors.accent}
          bgColor={Colors.accentSubtle}
        />
        <StatCard
          emoji="🟢"
          value={stats.activeNow.toString()}
          label="Active Now"
          color={Colors.success}
          bgColor={Colors.successLight}
        />
        <StatCard
          emoji="🏖️"
          value={stats.onLeaveToday.toString()}
          label="On Leave"
          color={Colors.warning}
          bgColor={Colors.warningLight}
        />
        <StatCard
          emoji="⏳"
          value={stats.pendingApprovals.toString()}
          label="Pending"
          color={Colors.error}
          bgColor={Colors.errorLight}
        />
      </View>

      {/* Pending Approvals */}
      <Text style={styles.sectionTitle}>
        Pending Approvals {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
      </Text>

      {isLoadingApprovals ? (
        <ListSkeleton count={2} />
      ) : pendingApprovals.length === 0 ? (
        <EmptyState
          icon="checkbox-marked-circle-outline"
          title="All caught up!"
          subtitle="No pending approvals at the moment"
        />
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
    </ScrollView>
  );
}

function StatCard({
  emoji,
  value,
  label,
  color,
  bgColor,
}: {
  emoji: string;
  value: string;
  label: string;
  color: string;
  bgColor: string;
}) {
  return (
    <View style={statStyles.card}>
      <View style={[statStyles.iconBg, { backgroundColor: bgColor }]}>
        <Text style={statStyles.emoji}>{emoji}</Text>
      </View>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={statStyles.label}>{label}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  iconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emoji: { fontSize: 18 },
  value: { fontSize: 26, fontWeight: '800' },
  label: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingBottom: 20 },
  header: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  greeting: { fontSize: 16, color: Colors.textSecondary },
  name: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 2 },
  date: { fontSize: 13, color: Colors.textTertiary, marginTop: 4 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    paddingHorizontal: 20,
    marginTop: 24,
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 20,
  },
});
