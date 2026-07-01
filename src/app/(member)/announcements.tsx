// ============================================================================
// VEBOSSO EMS — Member Announcements Screen (Premium Fintech Aesthetic)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Colors } from '../../constants/colors';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { EmptyState } from '../../components/EmptyState';
import { PageTransition } from '../../components/PageTransition';

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
    <PageTransition>
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Announcements</Text>
        <Text style={styles.subtitle}>
          {announcements.length} announcement{announcements.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <FlatList
        data={announcements}
        renderItem={({ item, index }) => <AnnouncementCard announcement={item} index={index} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#000000" />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <EmptyState
              icon="bullhorn-outline"
              title="No Announcements"
              subtitle="You'll see company announcements here"
            />
          </View>
        }
      />
    </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDEDED', // Premium Fintech light grey
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 12,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: '#1C1C1E',
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: '#8E8E93',
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    elevation: 3,
  },
});
