// ============================================================================
// VEBOSSO EMS — Manager: My Team Screen
// ============================================================================

import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberCard } from '../../components/MemberCard';
import { Colors } from '../../constants/colors';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Profile } from '../../types/database';

export default function ManagerMyTeamScreen() {
  const { profile } = useAuthStore();
  const { teamMembers, isLoadingTeam, fetchTeamMembers } = useWorkStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) fetchTeamMembers(profile.id);
  }, [profile]);

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

  const renderMember = useCallback(({ item }: { item: Profile }) => <MemberCard member={item} />, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Team</Text>
        <Text style={styles.subtitle}>{teamMembers.length} members</Text>
      </View>

      <View style={styles.searchSection}>
        <Searchbar
          placeholder="Search..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchbar}
          inputStyle={styles.searchInput}
          iconColor={Colors.textSecondary}
          placeholderTextColor={Colors.placeholder}
          theme={{ colors: { onSurface: Colors.text, elevation: { level3: Colors.inputBackground } } }}
        />
      </View>

      {isLoadingTeam ? (
        <View style={styles.content}><ListSkeleton count={5} /></View>
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderMember}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          ListEmptyComponent={<EmptyState icon="account-group-outline" title="No Team Members" subtitle="No members are assigned to your team yet" />}
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
  searchbar: { backgroundColor: Colors.inputBackground, borderRadius: 12, elevation: 0, borderWidth: 1, borderColor: Colors.border },
  searchInput: { color: Colors.text, fontSize: 14 },
  content: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
});
