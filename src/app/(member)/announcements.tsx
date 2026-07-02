// ============================================================================
// VEBOSSO EMS — Member Announcements Screen (Premium Fintech Aesthetic)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { EmptyState } from '../../components/EmptyState';
import { PageTransition } from '../../components/PageTransition';
import { Colors } from '../../constants/colors';

export default function MemberAnnouncementsScreen() {
  const { profile } = useAuthStore();
  const { announcements, fetchAnnouncements } = useWorkStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (profile) fetchAnnouncements(profile.role, profile.id);
  }, [profile, fetchAnnouncements]);

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
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
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 28,
    color: Colors.textPrimary,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
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
