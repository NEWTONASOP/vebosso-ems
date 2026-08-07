// ============================================================================
// VEBOSSO EMS — Session Management Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, Pressable } from 'react-native';
import { Alert } from '../../../lib/alert';
import { Snackbar, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { parseFunctionError } from '../../../lib/errors';
import { EmptyState } from '../../../components/EmptyState';
import { InlineError } from '../../../components/InlineError';
import { ListSkeleton } from '../../../components/LoadingSkeleton';
import { Feather } from '@expo/vector-icons';
import {
  AppRadius,
  AppSpace,
  AppTheme as T,
  appSoftShadow,
  screenChrome,
} from '../../../constants/theme';

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
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [snackMessage, setSnackMessage] = useState('');

  const fetchSessions = async () => {
    try {
      setFetchError(null);
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
      setFetchError('Failed to load sessions. Please try again.');
      if (__DEV__) console.error('Fetch sessions error:', e);
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
              const { data, error } = await supabase.functions.invoke('force-logout', {
                body: { user_id: session.user_id, session_id: session.id },
              });
              if (error) {
                setSnackMessage(parseFunctionError(error));
                return;
              }
              if (data?.error) {
                setSnackMessage(data.error);
                return;
              }
              setSnackMessage(`${session.profiles.full_name} has been logged out.`);
              fetchSessions();
            } catch (e) {
              setSnackMessage('Failed to force logout. Please try again.');
              if (__DEV__) console.error(e);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={screenChrome.root}>
      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            screenChrome.iconButton,
            pressed && styles.btnPressed,
          ]}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="arrow-left" size={18} color={T.charcoal} />
        </Pressable>
        <Text style={screenChrome.title}>Active Sessions</Text>
      </View>

      {isLoading ? (
        <View style={styles.skeletonContainer}>
          <ListSkeleton count={3} variant="task-row" />
        </View>
      ) : fetchError ? (
        <View style={styles.errorWrap}>
          <InlineError
            message={fetchError}
            onRetry={async () => { setIsLoading(true); await fetchSessions(); }}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
          showsVerticalScrollIndicator={false}
        >
          {sessions.length > 0 ? (
            <>
              <Text style={styles.sectionHint}>
                {sessions.length} active {sessions.length === 1 ? 'session' : 'sessions'}
              </Text>
              <View style={styles.groupedCard}>
                {sessions.map((session, index) => {
                  const timeAgo = formatDistanceToNow(new Date(session.last_active), { addSuffix: true });
                  return (
                    <View key={session.id} style={styles.rowWrapper}>
                      <View style={styles.rowContent}>
                        <View style={styles.infoCol}>
                          <Text style={styles.sessionName}>{session.profiles.full_name}</Text>
                          <Text style={styles.sessionDetail}>
                            {session.profiles.employee_id} • {session.device_info || 'Unknown device'}
                          </Text>
                          <Text style={styles.sessionTime}>Active {timeAgo}</Text>
                        </View>

                        <View style={styles.actionCol}>
                          <View style={styles.activeBadge}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>Active</Text>
                          </View>

                          <Pressable
                            style={({ pressed }) => [
                              styles.logoutBtn,
                              pressed && styles.btnPressed,
                            ]}
                            onPress={() => handleForceLogout(session)}
                            accessibilityRole="button"
                            accessibilityLabel={`Force logout ${session.profiles.full_name}`}
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
            </>
          ) : (
            <View style={styles.emptyCard}>
              <EmptyState
                icon="cellphone"
                title="No Active Sessions"
                subtitle="No users are currently logged in"
              />
            </View>
          )}
        </ScrollView>
      )}

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={4000}
        theme={{ colors: { inverseSurface: T.charcoal, inverseOnSurface: T.white } }}
        wrapperStyle={{ marginBottom: 90 }}
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
    paddingTop: Platform.OS === 'ios' ? 60 : 44,
    paddingBottom: 12,
    gap: 12,
  },
  skeletonContainer: {
    paddingHorizontal: AppSpace.screen,
    marginTop: 14,
  },
  errorWrap: {
    paddingHorizontal: AppSpace.screen,
    marginTop: 14,
  },
  scrollContent: {
    paddingHorizontal: AppSpace.screen,
    paddingBottom: 110,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  sectionHint: {
    ...screenChrome.sectionHint,
    marginTop: 8,
    marginBottom: 10,
  },
  groupedCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    overflow: 'hidden',
    ...appSoftShadow,
  },
  rowWrapper: {
    backgroundColor: T.card,
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    minHeight: 72,
  },
  infoCol: {
    flex: 1,
    paddingRight: 12,
  },
  sessionName: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: T.ink,
    letterSpacing: -0.2,
  },
  sessionDetail: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
    marginTop: 3,
  },
  sessionTime: {
    fontFamily: 'Inter_400Regular',
    fontSize: 12,
    color: T.mute,
    marginTop: 4,
  },
  actionCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: T.greenSoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AppRadius.chip,
    gap: 4,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: T.green,
  },
  activeText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: T.green,
  },
  logoutBtn: {
    backgroundColor: T.coralSoft,
    paddingHorizontal: 14,
    minHeight: 44,
    borderRadius: AppRadius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.coral,
  },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: T.hairline,
    marginHorizontal: 16,
  },
  emptyCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    padding: 24,
    alignItems: 'center',
    ...appSoftShadow,
    marginTop: 14,
  },
});
