// ============================================================================
// VEBOSSO EMS — Owner Team Screen
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { FlatList, Platform, RefreshControl, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Menu, Searchbar, Snackbar, Text } from 'react-native-paper';
import { AssignManagerModal } from '../../components/AssignManagerModal';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { EmptyState } from '../../components/EmptyState';
import { InlineError } from '../../components/InlineError';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberCard } from '../../components/MemberCard';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';
import { parseSupabaseError } from '../../lib/errors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';

export default function OwnerTeamScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { teamMembers, isLoadingTeam, teamError, fetchTeamMembers, addTask } = useWorkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [assignTaskModalVisible, setAssignTaskModalVisible] = useState(false);
  const [assignManagerModalVisible, setAssignManagerModalVisible] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [isAssigningTask, setIsAssigningTask] = useState(false);
  const [isAssigningManager, setIsAssigningManager] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    fetchTeamMembers();
  }, [fetchTeamMembers]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeamMembers();
    setRefreshing(false);
  };

  const handleMemberPress = (member: Profile) => {
    setSelectedMember(member);
    setMenuVisible(true);
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

  const handleAssignManager = async (managerId: string | null) => {
    if (!selectedMember?.id) return;

    setIsAssigningManager(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ manager_id: managerId })
        .eq('id', selectedMember.id);

      if (error) throw error;

      setSnackMessage(
        managerId
          ? `Manager assigned to ${selectedMember.full_name} ✅`
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

  // Get unique departments
  const departments = [...new Set(teamMembers.map((m) => m.department).filter(Boolean))] as string[];

  // Get all managers for assignment
  const managers = teamMembers.filter((m) => m.role === 'manager');

  // Filter members
  const filteredMembers = teamMembers.filter((member) => {
    const matchesSearch =
      searchQuery === '' ||
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.employee_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !selectedRole || member.role === selectedRole;
    const matchesDept = !selectedDept || member.department === selectedDept;
    return matchesSearch && matchesRole && matchesDept;
  });

  const renderMember = useCallback(({ item }: { item: Profile }) => (
    <MemberCard member={item} onPress={() => handleMemberPress(item)} />
  ), []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Team</Text>
        <Text style={styles.subtitle}>{teamMembers.length} members</Text>
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
            ...departments.map((d) => ({ label: d, value: `dept:${d}` })),
          ]}
          renderItem={({ item }) => {
            const isRole = item.value && !item.value.startsWith('dept:');
            const isDept = item.value?.startsWith('dept:');
            const isActive = isRole
              ? selectedRole === item.value
              : isDept
              ? selectedDept === item.value?.replace('dept:', '')
              : !selectedRole && !selectedDept;

            return (
              <Chip
                selected={isActive}
                onPress={() => {
                  if (isRole) {
                    setSelectedRole(isActive ? null : item.value);
                    setSelectedDept(null);
                  } else if (isDept) {
                    setSelectedDept(isActive ? null : item.value!.replace('dept:', ''));
                    setSelectedRole(null);
                  } else {
                    setSelectedRole(null);
                    setSelectedDept(null);
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
        <ListSkeleton count={5} />
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
              subtitle={searchQuery ? 'Try a different search term' : 'Add members in Settings'}
            />
          }
        />
      )}

      {/* Context Menu */}
      <Menu
        visible={menuVisible}
        onDismiss={() => setMenuVisible(false)}
        anchor={menuAnchor || { x: 0, y: 0 }}
        contentStyle={styles.menuContent}
      >
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            setAssignTaskModalVisible(true);
          }}
          title="Assign Task"
          leadingIcon="clipboard-text-outline"
          titleStyle={styles.menuItemText}
        />
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            setAssignManagerModalVisible(true);
          }}
          title="Assign Manager"
          leadingIcon="account-supervisor"
          titleStyle={styles.menuItemText}
        />
        <Menu.Item
          onPress={() => {
            setMenuVisible(false);
            if (selectedMember) {
              router.push(`/(owner)/member/${selectedMember.id}` as any);
            }
          }}
          title="Manage Profile"
          leadingIcon="account-cog-outline"
          titleStyle={styles.menuItemText}
        />
      </Menu>

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

      <AssignManagerModal
        visible={assignManagerModalVisible}
        onDismiss={() => {
          setAssignManagerModalVisible(false);
          setSelectedMember(null);
        }}
        targetMember={selectedMember}
        managers={managers}
        onAssign={handleAssignManager}
        isLoading={isAssigningManager}
      />

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 48, paddingBottom: 8 },
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
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
  menuContent: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  menuItemText: {
    color: Colors.text,
    fontSize: 14,
  },
});
