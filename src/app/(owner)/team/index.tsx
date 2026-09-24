// ============================================================================
// VEBOSSO EMS — Owner Team Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { Searchbar, Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../../components/EmptyState';
import { InlineError } from '../../../components/InlineError';
import { ListSkeleton } from '../../../components/LoadingSkeleton';
import { MemberCard } from '../../../components/MemberCard';
import { OwnerMemberMenu } from '../../../components/OwnerMemberMenu';
import { AppSpace, AppTheme, screenChrome } from '../../../constants/theme';
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
    memberLiveStatus,
    subscribeToRealtime,
  } = useWorkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Profile | null>(null);
  const [snackMessage, setSnackMessage] = useState('');

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
  }, []);

  const roleCounts = useMemo(() => {
    let managers = 0;
    let members = 0;
    for (const m of teamMembers) {
      if (m.role === 'manager') managers += 1;
      else if (m.role === 'member') members += 1;
    }
    return { all: teamMembers.length, manager: managers, member: members };
  }, [teamMembers]);

  const workingNowCount = useMemo(
    () => teamMembers.filter((m) => memberLiveStatus[m.id]?.status === 'working').length,
    [teamMembers, memberLiveStatus]
  );

  const headerSubtitle = useMemo(() => {
    const total = teamMembers.length;
    if (Object.keys(memberLiveStatus).length > 0) {
      return `${total} members · ${workingNowCount} working now`;
    }
    return `${total} members`;
  }, [teamMembers.length, memberLiveStatus, workingNowCount]);

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

  const filterOptions = useMemo(
    () => [
      { label: 'All', count: roleCounts.all, value: null as string | null },
      { label: 'Managers', count: roleCounts.manager, value: 'manager' },
      { label: 'Members', count: roleCounts.member, value: 'member' },
    ],
    [roleCounts]
  );

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
    <View style={screenChrome.root}>
      <View style={screenChrome.headerRow}>
        <View>
          <Text style={screenChrome.title}>Team</Text>
          <Text style={screenChrome.subtitle}>{headerSubtitle}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [screenChrome.primaryPill, pressed && styles.addButtonPressed]}
          onPress={() => router.push('/(owner)/team/add-member')}
          accessibilityLabel="Add Member"
        >
          <Feather name="user-plus" size={15} color={AppTheme.white} />
          <Text style={screenChrome.primaryPillText}>Add Member</Text>
        </Pressable>
      </View>

      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by name or ID..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar as any}
          inputStyle={styles.searchInput}
          iconColor={AppTheme.mute}
          placeholderTextColor={AppTheme.mute}
          theme={{ colors: { onSurface: AppTheme.ink, elevation: { level3: AppTheme.card } } }}
        />

        <FlatList
          horizontal
          data={filterOptions}
          renderItem={({ item }) => {
            const isActive = item.value ? selectedRole === item.value : !selectedRole;

            return (
              <Pressable
                style={[
                  screenChrome.filterChip,
                  isActive && screenChrome.filterChipActive,
                ]}
                onPress={() => {
                  if (item.value) {
                    setSelectedRole(isActive ? null : item.value);
                  } else {
                    setSelectedRole(null);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={`${item.label}, ${item.count}`}
              >
                <Text
                  style={[
                    screenChrome.filterChipText,
                    isActive && screenChrome.filterChipTextActive,
                  ]}
                >
                  {item.label}{' '}
                  <Text
                    style={[
                      screenChrome.filterChipCount,
                      isActive && screenChrome.filterChipCountActive,
                    ]}
                  >
                    {item.count}
                  </Text>
                </Text>
              </Pressable>
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
        <View style={styles.errorPad}>
          <InlineError message={teamError} onRetry={() => fetchTeamMembers()} />
        </View>
      ) : (
        <FlatList
          data={filteredMembers}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.charcoal} />
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

      <OwnerMemberMenu
        member={selectedMember}
        onClose={() => setSelectedMember(null)}
        onMessage={setSnackMessage}
      />

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  searchSection: {
    paddingHorizontal: AppSpace.screen,
    paddingTop: AppSpace.sm,
  },
  searchbar: {
    ...screenChrome.searchbar,
  },
  searchInput: {
    color: AppTheme.ink,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  filterRow: {
    paddingTop: AppSpace.md,
    paddingBottom: AppSpace.xs,
    gap: AppSpace.sm,
  },
  list: {
    paddingHorizontal: AppSpace.screen,
    paddingTop: AppSpace.sm,
    paddingBottom: 110,
  },
  errorPad: {
    paddingHorizontal: AppSpace.screen,
  },
  addButtonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
