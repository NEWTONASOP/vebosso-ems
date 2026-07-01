// ============================================================================
// VEBOSSO EMS — Owner Team Screen
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Chip, Searchbar, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberCard } from '../../components/MemberCard';
import { Colors } from '../../constants/colors';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';

export default function OwnerTeamScreen() {
  const { teamMembers, isLoadingTeam, fetchTeamMembers } = useWorkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTeamMembers();
    setRefreshing(false);
  };

  // Get unique departments
  const departments = [...new Set(teamMembers.map((m) => m.department).filter(Boolean))] as string[];

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
    <MemberCard member={item} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 8 },
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
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 },
});
