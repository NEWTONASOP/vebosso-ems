// ============================================================================
// VEBOSSO EMS — Owner Dashboard (Premium Fintech Aesthetic)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect } from 'react';
import { Platform, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Snackbar, Text } from 'react-native-paper';
import { AnimatedPressable } from '../../components/AnimatedPressable';
import { ApprovalCard } from '../../components/ApprovalCard';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton, StatsSkeleton } from '../../components/LoadingSkeleton';
import { MemberPickerModal } from '../../components/MemberPickerModal';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';

export default function OwnerDashboard() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    stats,
    pendingApprovals,
    isLoadingApprovals,
    approvalsError,
    teamMembers,
    fetchStats,
    fetchPendingApprovals,
    fetchSettings,
    fetchTeamMembers,
    approveCheckIn,
    rejectCheckIn,
    subscribeToRealtime,
    unsubscribeFromRealtime,
    addTask,
  } = useWorkStore();

  const [refreshing, setRefreshing] = React.useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = React.useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = React.useState(false);
  const [selectedMember, setSelectedMember] = React.useState<Profile | null>(null);
  const [isAssigningTask, setIsAssigningTask] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<string | null>(null);
  const [rejectingId, setRejectingId] = React.useState<string | null>(null);
  const [snackMessage, setSnackMessage] = React.useState('');

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchStats(),
      fetchPendingApprovals(),
      fetchSettings(),
      fetchTeamMembers(),
    ]);
  }, [fetchStats, fetchPendingApprovals, fetchSettings, fetchTeamMembers]);

  useEffect(() => {
    if (!profile?.id) {
      console.warn('Profile not loaded yet');
      return;
    }
    
    loadData();
    subscribeToRealtime(profile.id, 'owner');
    
    return () => unsubscribeFromRealtime();
  }, [profile?.id, loadData, subscribeToRealtime, unsubscribeFromRealtime]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleApprove = async (workLogId: string) => {
    if (!profile?.id) return;
    setApprovingId(workLogId);
    const result = await approveCheckIn(workLogId, profile.id);
    setApprovingId(null);
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to approve check-in. Please try again.');
    }
  };

  const handleReject = async (workLogId: string) => {
    if (!profile?.id) return;
    setRejectingId(workLogId);
    const result = await rejectCheckIn(workLogId, profile.id, 'Please revise your plan');
    setRejectingId(null);
    if (!result.success) {
      setSnackMessage(result.error || 'Failed to reject check-in. Please try again.');
    }
  };

  const handleOpenMemberPicker = () => {
    setMemberPickerVisible(true);
  };

  const handleSelectMember = (member: Profile) => {
    setSelectedMember(member);
    setMemberPickerVisible(false);
    setAssignTaskModalVisible(true);
  };

  const handleAssignTask = async (title: string, description: string | null, dueDate: string | null) => {
    if (!profile?.id || !selectedMember?.id) return;

    setIsAssigningTask(true);
    const result = await addTask({
      assigned_to: selectedMember.id,
      assigned_by: profile.id,
      title,
      description,
      due_date: dueDate,
      status: 'pending',
    });
    setIsAssigningTask(false);

    if (result.success) {
      setSnackMessage(`Task assigned to ${selectedMember.full_name} ✅`);
      setAssignTaskModalVisible(false);
      setSelectedMember(null);
    } else {
      setSnackMessage(result.error || 'Failed to assign task. Please try again.');
    }
  };

  const today = format(new Date(), 'EEEE, MMMM dd');

  return (
    <>
      <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
      }
      showsVerticalScrollIndicator={false}
    >
      {/* Header Greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'},
        </Text>
        <Text style={styles.name}>{profile?.full_name?.split(' ')[0] || 'Owner'} 👋</Text>
        <Text style={styles.date}>{today}</Text>
      </View>

      {/* Stats Cards Dashboard widgets */}
      <Text style={styles.sectionTitle}>Overview</Text>
      {isLoadingApprovals && stats.totalMembers === 0 ? (
        <View style={styles.statsSkeletonContainer}>
          <StatsSkeleton />
        </View>
      ) : (
        <View style={styles.statsGrid}>
          <StatCard
            icon="users"
            iconColor={Colors.info}
            value={stats.totalMembers.toString()}
            label="Total Members"
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
            iconColor="#5856D6"
            value={stats.pendingApprovals.toString()}
            label="Pending"
          />
        </View>
      )}

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.quickActionsContainer}>
        <QuickActionCard
          icon="clipboard"
          title="Assign Task"
          subtitle="Create a new task"
          onPress={handleOpenMemberPicker}
        />
      </View>

      {/* Pending Approvals */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Pending Approvals {pendingApprovals.length > 0 ? `(${pendingApprovals.length})` : ''}
        </Text>
        {pendingApprovals.length > 5 && (
          <Text style={styles.viewAllBtn} onPress={() => router.push('/(owner)/approvals')}>
            View All
          </Text>
        )}
      </View>

      <View style={styles.listContainer}>
        {isLoadingApprovals ? (
          <ListSkeleton count={2} />
        ) : approvalsError ? (
          <InlineError
            message={approvalsError}
            onRetry={() => fetchPendingApprovals()}
          />
        ) : pendingApprovals.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              icon="checkbox-marked-circle-outline"
              title="All caught up!"
              subtitle="No pending approvals at the moment"
            />
          </View>
        ) : (
          pendingApprovals.slice(0, 5).map((workLog) => (
            <ApprovalCard
              key={workLog.id}
              workLog={workLog}
              onApprove={handleApprove}
              onReject={handleReject}
              isApproving={approvingId === workLog.id}
              isRejecting={rejectingId === workLog.id}
            />
          ))
        )}
      </View>
      </ScrollView>

      <MemberPickerModal
        visible={memberPickerVisible}
        onDismiss={() => {
          setMemberPickerVisible(false);
          setSelectedMember(null);
        }}
        members={teamMembers}
        selectedMember={selectedMember}
        onSelectMember={handleSelectMember}
      />

      <AssignTaskModal
        visible={assignTaskModalVisible}
        onDismiss={() => {
          setAssignTaskModalVisible(false);
          setSelectedMember(null);
        }}
        targetMember={selectedMember}
        onSubmit={handleAssignTask}
        isLoading={isAssigningTask}
      />

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>
        {snackMessage}
      </Snackbar>
    </>
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
    color: Colors.text,
    letterSpacing: -0.5,
  },
  label: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginTop: 2,
  },
});

// ============================================================================
// Quick Action Card component
// ============================================================================

interface QuickActionCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function QuickActionCard({ icon, title, subtitle, onPress }: QuickActionCardProps) {
  return (
    <AnimatedPressable 
      style={quickActionStyles.container}
      onPress={onPress}
    >
      <Feather name={icon as any} size={24} color={Colors.accent} style={quickActionStyles.icon} />
      <View style={quickActionStyles.content}>
        <Text style={quickActionStyles.title}>{title}</Text>
        <Text style={quickActionStyles.subtitle}>{subtitle}</Text>
      </View>
      <Feather name="chevron-right" size={22} color={Colors.textTertiary} />
    </AnimatedPressable>
  );
}

const quickActionStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  icon: {
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
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
    color: Colors.text,
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
  quickActionsContainer: {
    paddingHorizontal: 20,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
});
