// ============================================================================
// VEBOSSO EMS — Session Management Screen (Premium Fintech Aesthetic)
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, Pressable } from 'react-native';
import { Alert } from '../../../lib/alert';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { EmptyState } from '../../../components/EmptyState';
import { ListSkeleton } from '../../../components/LoadingSkeleton';
import { Feather } from '@expo/vector-icons';
import { Colors } from '../../../constants/colors';

interface SessionInfo {
  id: string;
  user_id: string;
  device_info: string | null;
  last_active: string;
  is_active: boolean;
  profiles: { full_name: string; employee_id: string };
}

export default function SessionManagementScreen() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          profiles (full_name, employee_id)
        `)
        .eq('is_active', true)
        .order('last_active', { ascending: false });

      if (error) throw error;
      setSessions((data || []) as unknown as SessionInfo[]);
    } catch (e) {
      console.error('Fetch sessions error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchSessions();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSessions();
    setRefreshing(false);
  };

  const handleForceLogout = (session: SessionInfo) => {
    Alert.alert(
      'Force Logout',
      `Are you sure you want to force logout ${session.profiles.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Force Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('force-logout', {
                body: { user_id: session.user_id, session_id: session.id },
              });
              if (error) throw error;
              fetchSessions();
            } catch (e) {
              console.error(e);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with circular outline back button */}
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
        <Text style={styles.title}>Active Sessions</Text>
      </View>

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <ListSkeleton count={3} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {sessions.length > 0 ? (
            <View style={styles.groupedCard}>
              {sessions.map((session, index) => {
                const timeAgo = formatDistanceToNow(new Date(session.last_active), { addSuffix: true });
                return (
                  <View key={session.id} style={styles.rowWrapper}>
                    <View style={styles.rowContent}>
                      {/* Left: Device Info and Profile */}
                      <View style={styles.infoCol}>
                        <Text style={styles.sessionName}>{session.profiles.full_name}</Text>
                        <Text style={styles.sessionDetail}>
                          {session.profiles.employee_id} • {session.device_info || 'Unknown device'}
                        </Text>
                        <Text style={styles.sessionTime}>Active {timeAgo}</Text>
                      </View>

                      {/* Right: Active Pill and Logout Button */}
                      <View style={styles.actionCol}>
                        <View style={styles.activeBadge}>
                          <View style={styles.activeDot} />
                          <Text style={styles.activeText}>Active</Text>
                        </View>

                        <Pressable
                          style={({ pressed }) => [
                            styles.logoutBtn,
                            pressed && styles.btnPressed
                          ]}
                          onPress={() => handleForceLogout(session)}
                        >
                          <Text style={styles.logoutBtnText}>Logout</Text>
                        </Pressable>
                      </View>
                    </View>
                    {index < sessions.length - 1 && <View style={styles.separator} />}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <EmptyState icon="cellphone" title="No Active Sessions" subtitle="No users are currently logged in" />
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background, // Premium Fintech light grey
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
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
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  skeletonContainer: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  groupedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    overflow: 'hidden',
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    marginTop: 14,
  },
  rowWrapper: {
    backgroundColor: Colors.surface,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  infoCol: {
    flex: 1,
    paddingRight: 12,
  },
  sessionName: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  sessionDetail: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 3,
  },
  sessionTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: Colors.textTertiary,
    marginTop: 4,
  },
  actionCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.successLight, // Soft Green capsule
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  activeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: Colors.success,
  },
  logoutBtn: {
    backgroundColor: Colors.errorLight, // Soft red
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  logoutBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.error,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.divider,
    marginHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    marginTop: 14,
  },
});
