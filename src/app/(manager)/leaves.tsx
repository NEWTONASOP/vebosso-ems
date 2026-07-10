// ============================================================================
// VEBOSSO EMS — User Leave History & Request Screen
// ============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Platform, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Snackbar, Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';

import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { LeaveCard } from '../../components/LeaveCard';
import { LeaveRequestModal } from '../../components/LeaveRequestModal';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { Colors } from '../../constants/colors';

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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backBtn,
            pressed && styles.btnPressed
          ]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={18} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.title}>My Leaves</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={({ pressed }) => [
            styles.newBtn,
            pressed && styles.btnPressed
          ]}
          onPress={() => setModalVisible(true)}
        >
          <Feather name="plus" size={16} color={Colors.white} />
          <Text style={styles.newBtnText}>Apply</Text>
        </Pressable>
      </View>

      {/* Main List */}
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
              tintColor={Colors.accent}
              colors={[Colors.accent]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="calendar-blank"
              title="No Leave Requests"
              subtitle="You haven't requested any leaves yet."
              actionLabel="Apply for Leave"
              onAction={() => setModalVisible(true)}
            />
          }
        />
      )}

      {/* Leave Request Modal */}
      {modalVisible ? (
        <LeaveRequestModal
          visible
          onDismiss={() => setModalVisible(false)}
          onSubmit={handleRequestSubmit}
          isLoading={isSubmitting}
        />
      ) : null}

      {/* Success/Error Toast */}
      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
        theme={{ colors: { inverseSurface: '#1C1C1E', inverseOnSurface: '#FFFFFF' } }}
        wrapperStyle={{ marginBottom: 20 }}
      >
        {snackMessage}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
    elevation: 1,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  newBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  newBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.white,
  },
  skeletonContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  list: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 14,
  },
});
