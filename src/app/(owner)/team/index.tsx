// ============================================================================
// VEBOSSO EMS — Owner Team Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, Searchbar, Snackbar, Text } from 'react-native-paper';
import { AssignManagerModal } from '../../../components/AssignManagerModal';
import { AssignTaskModal } from '../../../components/AssignTaskModal';
import { EmptyState } from '../../../components/EmptyState';
import { InlineError } from '../../../components/InlineError';
import { ListSkeleton } from '../../../components/LoadingSkeleton';
import { MemberActionsModal } from '../../../components/MemberActionsModal';
import { MemberCard } from '../../../components/MemberCard';
import { Colors } from '../../../constants/colors';
import { parseSupabaseError } from '../../../lib/errors';
import { supabase } from '../../../lib/supabase';
import { sortMembersByLiveStatus } from '../../../lib/teamSort';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';
import { Profile } from '../../../types/database';

export default function OwnerTeamScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    teamMembers,
    isLoadingTeam,
    teamError,
    fetchTeamMembers,
    refreshMemberLiveStatus,
    addTask,
    memberLiveStatus,
    subscribeToRealtime,
  } = useWorkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = useState(false);
  const [assignManagerModalVisible, setAssignManagerModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [isAssigningManager, setIsAssigningManager] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [actionsModalVisible, setActionsModalVisible] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  // Keep live status fresh while Team tab is focused (realtime + poll fallback)
  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;

      refreshMemberLiveStatus();
      subscribeToRealtime(profile.id, 'owner');

      const pollId = setInterval(() => {
        refreshMemberLiveStatus();
      }, 15000);

      return () => {
        clearInterval(pollId);
      };
    }, [profile?.id, refreshMemberLiveStatus, subscribeToRealtime])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeamMembers();
    setRefreshing(false);
  };

  const handleMemberPress = useCallback((member: Profile) => {
    setSelectedMember(member);
    setActionsModalVisible(true);
  }, []);

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
      setSnackMessage(`Task assigned to ${selectedMember.full_name}`);
      setAssignTaskModalVisible(false);
      setSelectedMember(null);
    } else {
      setSnackMessage(result.error || 'Failed to assign task. Please try again.');
    }
  };

  const handleAssignManager = async (managerId: string | null) => {
    if (!selectedMember?.id) return;

    setIsAssigningManager(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', selectedMember.id);

      if (error) throw error;

      // Send notification to employee about manager assignment
      if (managerId) {
        const { data: managerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', managerId)
          .single();

        if (managerProfile) {
          const { sendPushNotification } = await import('../../../lib/notifications');
          sendPushNotification(
            selectedMember.id,
            'Manager Assigned',
            `${managerProfile.full_name} is now your manager`,
            { type: 'manager_assigned', manager_id: managerId }
          );
        }
      }

      setSnackMessage(
        managerId
          ? `Manager assigned to ${selectedMember.full_name}`
          : `Manager removed from ${selectedMember.full_name}`
      );
      setAssignManagerModalVisible(false);
      setSelectedMember(null);
      await fetchTeamMembers();
    } catch (error) {
      setSnackMessage(parseSupabaseError(error));
    } finally {
      setIsAssigningManager(false);
    }
  };

  // Filter and sort members (status priority, then name)
  const filteredMembers = useMemo(() => {
    const filtered = teamMembers.filter((member) => {
      const matchesSearch =
        searchQuery === '' ||
        member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRole = !selectedRole || member.role === selectedRole;
      return matchesSearch && matchesRole;
    });
    return sortMembersByLiveStatus(filtered, memberLiveStatus);
  }, [teamMembers, searchQuery, selectedRole, memberLiveStatus]);

  const managers = teamMembers.filter((m) => m.role === 'manager');

  const renderMember = useCallback(({ item }: { item: Profile }) => {
    const live = memberLiveStatus[item.id];
    return (
      <MemberCard
        member={item}
        currentStatus={live?.status ?? 'offline'}
        checkInTime={live?.checkInTime}
        checkOutTime={live?.checkOutTime}
        checkInPlan={live?.checkInPlan}
        dayReport={live?.dayReport}
        pendingTaskCount={live?.pendingTaskCount ?? 0}
        inProgressTaskCount={live?.inProgressTaskCount ?? 0}
        doneTaskCount={live?.doneTaskCount ?? 0}
        activeTasks={live?.activeTasks ?? []}
        onPress={() => handleMemberPress(item)}
      />
    );
  }, [handleMemberPress, memberLiveStatus]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Team</Text>
          <Text style={styles.subtitle}>{teamMembers.length} members</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          onPress={() => router.push('/(owner)/team/add-member')}
        >
          <Feather name="user-plus" size={15} color={Colors.white} />
          <Text style={styles.addButtonText}>Add Member</Text>
        </Pressable>
      </View>

      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.placeholder}
          theme={{ colors: { onSurface: Colors.text, elevation: { level3: Colors.inputBackground } } }}
        />

        <FlatList
          horizontal
          data={[
            { label: 'All', value: null },
            { label: 'Managers', value: 'manager' },
            { label: 'Members', value: 'member' },
          ]}
          renderItem={({ item }) => {
            const isActive = item.value ? selectedRole === item.value : !selectedRole;

            return (
              <Chip
                selected={isActive}
                onPress={() => {
                  if (item.value) {
                    setSelectedRole(isActive ? null : item.value);
                  } else {
                    setSelectedRole(null);
                  }
                }}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                textStyle={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                compact
              >
                {item.label}
              </Chip>
            );
          }}
          keyExtractor={(item) => item.label}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        />
      </View>

      {isLoadingTeam ? (
        <View style={styles.list}>
          <ListSkeleton count={5} variant="member" />
        </View>
      ) : teamError ? (
        <View style={{ paddingHorizontal: 20 }}>
          <InlineError message={teamError} onRetry={() => fetchTeamMembers()} />
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="account-search-outline"
              title="No members found"
              subtitle={searchQuery ? 'Try a different search term' : 'Tap + to add your first member'}
            />
          }
        />
      )}

      {selectedMember && (
        <MemberActionsModal
          visible={actionsModalVisible}
          member={selectedMember}
          onDismiss={() => {
            setActionsModalVisible(false);
            setSelectedMember(null);
          }}
          onAssignTask={() => {
            setActionsModalVisible(false);
            setAssignTaskModalVisible(true);
          }}
          onAssignManager={() => {
            setActionsModalVisible(false);
            setAssignManagerModalVisible(true);
          }}
          onManageProfile={() => {
            setActionsModalVisible(false);
            router.push(`/(owner)/member/${selectedMember.id}` as any);
            setSelectedMember(null);
          }}
          currentStatus={memberLiveStatus[selectedMember.id]?.status ?? 'offline'}
          checkInTime={memberLiveStatus[selectedMember.id]?.checkInTime}
          checkOutTime={memberLiveStatus[selectedMember.id]?.checkOutTime}
          checkInPlan={memberLiveStatus[selectedMember.id]?.checkInPlan}
          dayReport={memberLiveStatus[selectedMember.id]?.dayReport}
          pendingTaskCount={memberLiveStatus[selectedMember.id]?.pendingTaskCount ?? 0}
          inProgressTaskCount={memberLiveStatus[selectedMember.id]?.inProgressTaskCount ?? 0}
          doneTaskCount={memberLiveStatus[selectedMember.id]?.doneTaskCount ?? 0}
          activeTasks={memberLiveStatus[selectedMember.id]?.activeTasks ?? []}
        />
      )}

      {assignTaskModalVisible && selectedMember ? (
        <AssignTaskModal
          visible
          key={selectedMember.id}
          onDismiss={() => {
            setAssignTaskModalVisible(false);
            setSelectedMember(null);
          }}
          targetMember={selectedMember}
          onSubmit={handleAssignTask}
          isLoading={isAssigningTask}
        />
      ) : null}

      {assignManagerModalVisible && selectedMember ? (
        <AssignManagerModal
          visible
          onDismiss={() => {
            setAssignManagerModalVisible(false);
            setSelectedMember(null);
          }}
          targetMember={selectedMember}
          managers={managers}
          onAssign={handleAssignManager}
          isLoading={isAssigningManager}
        />
      ) : null}

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 8,
  },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 42,
    gap: 6,
  },
  addButtonText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.white,
  },
  addButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  searchSection: { paddingHorizontal: 20, paddingTop: 12 },
  searchbar: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 12,
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: { color: Colors.text, fontSize: 14 },
  filterRow: { paddingTop: 12, paddingBottom: 8, gap: 8 },
  filterChip: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.accentSubtle,
    borderColor: Colors.accent,
  },
  filterChipText: { color: Colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: Colors.accent, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 110 },
});
