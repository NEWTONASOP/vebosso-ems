// ============================================================================
// VEBOSSO EMS — Member Announcements Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { EmptyState } from '../../components/EmptyState';
import { AnnouncementWithCreator } from '../../types/database';

export default function MemberAnnouncementsScreen() {
  const { profile } = useAuthStore();
  const { announcements, isLoadingAnnouncements, fetchAnnouncements } = useWorkStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) fetchAnnouncements(profile.role, profile.id);
  }, [profile]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (profile) await fetchAnnouncements(profile.role, profile.id);
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Announcements</Text>
        <Text style={styles.subtitle}>{announcements.length} announcement{announcements.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={announcements}
        renderItem={({ item }) => <AnnouncementCard announcement={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <EmptyState icon="📢" title="No Announcements" subtitle="You'll see company announcements here" />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: Colors.text },
  subtitle: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
});
