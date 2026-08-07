// ============================================================================
// VEBOSSO EMS — User Leave History & Request Screen
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Snackbar, Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { LeaveCard } from '../../components/LeaveCard';
import { LeaveRequestModal } from '../../components/LeaveRequestModal';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { AppSpace, AppTheme, screenChrome } from '../../constants/theme';

export default function LeavesScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const {
    leaveRequests,
    isLoadingLeaves,
    fetchLeaveRequests,
    submitLeaveRequest,
  } = useWorkStore();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');

  const loadLeaves = useCallback(async () => {
    if (!profile) return;
    await fetchLeaveRequests(profile.role, profile.id);
  }, [profile, fetchLeaveRequests]);

  useEffect(() => {
    loadLeaves();
  }, [loadLeaves]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLeaves();
    setRefreshing(false);
  };

  const handleRequestSubmit = async (date: string, reason: string) => {
    if (!profile) return;
    setIsSubmitting(true);
    const result = await submitLeaveRequest(date, reason, profile.id);
    setIsSubmitting(false);

    if (result.success) {
      setSnackMessage('Leave request submitted successfully! ✈️');
      setModalVisible(false);
      loadLeaves();
    } else {
      setSnackMessage(result.error || 'Failed to submit leave request');
    }
  };

  // Filter requests to show only current user's leaves
  const myLeaves = leaveRequests.filter((l) => l.user_id === profile?.id);

  return (
    <View style={screenChrome.root}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            screenChrome.iconButton,
            styles.backBtn,
            pressed && styles.btnPressed,
          ]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={18} color={AppTheme.ink} />
        </Pressable>
        <View style={styles.headerText}>
          <Text style={screenChrome.title}>My Leaves</Text>
          <Text style={screenChrome.subtitle}>
            {myLeaves.length === 0
              ? 'Request time off when you need it'
              : `${myLeaves.length} request${myLeaves.length === 1 ? '' : 's'}`}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            screenChrome.primaryPill,
            pressed && styles.btnPressed,
          ]}
          onPress={() => setModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Apply for leave"
        >
          <Feather name="plus" size={16} color={AppTheme.white} />
          <Text style={screenChrome.primaryPillText}>Apply</Text>
        </Pressable>
      </View>

      {isLoadingLeaves && !refreshing ? (
        <View style={styles.skeletonContainer}>
          <ListSkeleton count={3} variant="approval" />
        </View>
      ) : (
        <FlatList
          data={myLeaves}
          renderItem={({ item, index }) => (
            <LeaveCard leave={item} showUser={false} index={index} />
          )}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={AppTheme.charcoal}
              colors={[AppTheme.charcoal]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-blank"
              title="No leave requests yet"
              subtitle="Need a day off? Submit a request and your owner will review it."
              actionLabel="Apply for Leave"
              onAction={() => setModalVisible(true)}
            />
          }
        />
      )}

      {modalVisible ? (
        <LeaveRequestModal
          visible
          onDismiss={() => setModalVisible(false)}
          onSubmit={handleRequestSubmit}
          isLoading={isSubmitting}
        />
      ) : null}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        theme={{ colors: { inverseSurface: AppTheme.charcoal, inverseOnSurface: AppTheme.white } }}
        wrapperStyle={{ marginBottom: 20 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpace.screen,
    paddingTop: screenChrome.headerRow.paddingTop,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  skeletonContainer: {
    paddingHorizontal: AppSpace.screen,
    paddingTop: 14,
  },
  list: {
    ...screenChrome.listPad,
    paddingTop: 8,
    flexGrow: 1,
  },
});
