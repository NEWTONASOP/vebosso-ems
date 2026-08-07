// ============================================================================
// VEBOSSO EMS — Member Announcements Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { AnnouncementCard } from '../../components/AnnouncementCard';
import { EmptyState } from '../../components/EmptyState';
import { PageTransition } from '../../components/PageTransition';
import {
  AppTheme as T,
  AppSpace,
  screenChrome,
} from '../../constants/theme';

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
      <View style={screenChrome.root}>
        <View style={screenChrome.header}>
          <Text style={screenChrome.title}>Announcements</Text>
          <Text style={screenChrome.subtitle}>
            {announcements.length === 0
              ? 'Company updates will appear here'
              : `${announcements.length} update${announcements.length !== 1 ? 's' : ''}`}
          </Text>
        </View>

        <FlatList
          data={announcements}
          renderItem={({ item, index }) => (
            <AnnouncementCard announcement={item} index={index} />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={T.charcoal}
            />
          }
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="bullhorn-outline"
              title="No announcements yet"
              subtitle="When leadership posts an update, you'll see it here. Pull down to refresh."
            />
          }
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: AppSpace.screen,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    gap: 12,
  },
});
