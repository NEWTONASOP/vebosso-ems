// ============================================================================
// VEBOSSO EMS — Manager Dashboard (Focused on Approvals)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { ApprovalCard } from '../../components/ApprovalCard';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';

export default function ManagerDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    pendingApprovals, isLoadingApprovals,
    fetchPendingApprovals, fetchSettings,
    approveCheckIn, rejectCheckIn,
    subscribeToRealtime, unsubscribeFromRealtime,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = useCallback(async () => {
    if (!profile?.id) return;
    await Promise.all([
      fetchPendingApprovals(profile.id),
      fetchSettings(),
    ]);
  }, [profile, fetchPendingApprovals, fetchSettings]);

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

      {/* Pending Approvals Count Card */}
      <View style={styles.approvalCountCard}>
        <View style={[styles.iconBg, { backgroundColor: Colors.managerAccent + '12' }]}>
          <Feather name="clock" size={24} color={Colors.managerAccent} />
        </View>
        <View style={styles.approvalCountInfo}>
          <Text style={styles.approvalCountValue}>{pendingApprovals.length}</Text>
          <Text style={styles.approvalCountLabel}>Pending Approvals</Text>
        </View>
      </View>

      {/* Pending Approvals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Team Check-in Requests
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
  approvalCountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  iconBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  approvalCountInfo: {
    flex: 1,
  },
  approvalCountValue: {
    fontSize: 32,
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  approvalCountLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginTop: 2,
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
