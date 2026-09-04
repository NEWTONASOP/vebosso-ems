// ============================================================================
// VEBOSSO EMS — Manager: My Team Screen
// ============================================================================

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberAttendanceModal } from '../../components/MemberAttendanceModal';
import { MemberCard } from '../../components/MemberCard';
import { AppSpace, AppTheme, RoleAccent, screenChrome } from '../../constants/theme';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';

export default function ManagerMyTeamScreen() {
  const { profile } = useAuthStore();
  const {
    teamMembers,
    isLoadingTeam,
    fetchTeamMembers,
    refreshMemberLiveStatus,
    memberLiveStatus,
    subscribeToRealtime,
  } = useWorkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [attendanceMember, setAttendanceMember] = useState<Profile | null>(null);

  useEffect(() => {
    if (profile) fetchTeamMembers(profile.id);
  }, [profile, fetchTeamMembers]);

  useFocusEffect(
    useCallback(() => {
      if (!profile?.id) return;

      refreshMemberLiveStatus();
      subscribeToRealtime(profile.id, 'manager', profile.id);

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
    if (profile) await fetchTeamMembers(profile.id);
    setRefreshing(false);
  };

  const filtered = teamMembers.filter((m) =>
    searchQuery === '' ||
    m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.employee_id.toLowerCase().includes(searchQuery.toLowerCase())
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
        onPress={() => setAttendanceMember(item)}
      />
    );
  }, [memberLiveStatus]);

  const headerSubtitle =
    teamMembers.length === 0
      ? 'People assigned to you'
      : `${teamMembers.length} member${teamMembers.length === 1 ? '' : 's'}`;

  return (
    <View style={screenChrome.root}>
      <View style={screenChrome.header}>
        <Text style={screenChrome.title}>My Team</Text>
        <Text style={screenChrome.subtitle}>{headerSubtitle}</Text>
      </View>

      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search by name or ID…"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar as any}
          inputStyle={styles.searchInput}
          iconColor={AppTheme.mute}
          placeholderTextColor={AppTheme.mute}
          theme={{ colors: { onSurface: AppTheme.ink, elevation: { level3: AppTheme.card } } }}
        />
      </View>

      {isLoadingTeam ? (
        <View style={styles.content}><ListSkeleton count={5} variant="member" /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={AppTheme.charcoal} />}
          ListEmptyComponent={
            <EmptyState
              icon="account-group-outline"
              title={searchQuery ? 'No matches' : 'No team members yet'}
              subtitle={
                searchQuery
                  ? 'Try a different name or employee ID.'
                  : 'Ask your owner to assign members to you. Once they join, their live status appears here.'
              }
            />
          }
        />
      )}

      <MemberAttendanceModal
        visible={!!attendanceMember}
        member={attendanceMember}
        onDismiss={() => setAttendanceMember(null)}
        accentColor={RoleAccent.manager.color}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  searchSection: {
    paddingHorizontal: AppSpace.screen,
    paddingTop: 4,
    paddingBottom: 8,
  },
  searchbar: {
    ...screenChrome.searchbar,
  },
  searchInput: {
    color: AppTheme.ink,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
  },
  content: { paddingHorizontal: AppSpace.screen },
  list: {
    ...screenChrome.listPad,
    paddingTop: 4,
    flexGrow: 1,
  },
});
