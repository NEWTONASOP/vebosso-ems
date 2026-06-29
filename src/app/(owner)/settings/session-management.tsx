// ============================================================================
// VEBOSSO EMS — Session Management Screen
// ============================================================================

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Alert, RefreshControl } from 'react-native';
import { Text, Button, IconButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { format, formatDistanceToNow } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { Colors } from '../../../constants/colors';
import { EmptyState } from '../../../components/EmptyState';
import { ListSkeleton } from '../../../components/LoadingSkeleton';

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

  const handleLogoutAll = (userId: string, name: string) => {
    Alert.alert(
      'Logout All Sessions',
      `Force logout all sessions for ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout All',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.functions.invoke('force-logout', {
                body: { user_id: userId },
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

  const renderSession = ({ item }: { item: SessionInfo }) => (
    <View style={styles.sessionCard}>
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{item.profiles.full_name}</Text>
        <Text style={styles.sessionDetail}>
          {item.profiles.employee_id} • {item.device_info || 'Unknown device'}
        </Text>
        <Text style={styles.sessionTime}>
          Last active {formatDistanceToNow(new Date(item.last_active), { addSuffix: true })}
        </Text>
      </View>
      <View style={styles.sessionActions}>
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>Active</Text>
        </View>
        <Button
          mode="outlined"
          onPress={() => handleForceLogout(item)}
          compact
          textColor={Colors.error}
          style={styles.logoutButton}
        >
          Logout
        </Button>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton
          icon="arrow-left"
          iconColor={Colors.text}
          size={24}
          onPress={() => router.back()}
        />
        <Text style={styles.title}>Active Sessions</Text>
      </View>

      {isLoading ? (
        <View style={styles.content}>
          <ListSkeleton count={4} />
        </View>
      ) : (
        <FlatList
          data={sessions}
          renderItem={renderSession}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
          }
          ListEmptyComponent={
            <EmptyState icon="cellphone" title="No Active Sessions" subtitle="No users are currently logged in" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 8,
    gap: 4,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text },
  content: { paddingHorizontal: 20 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  sessionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  sessionInfo: { flex: 1 },
  sessionName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sessionDetail: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sessionTime: { fontSize: 11, color: Colors.textTertiary, marginTop: 4 },
  sessionActions: { alignItems: 'flex-end', gap: 8 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.success },
  activeText: { fontSize: 11, color: Colors.success, fontWeight: '600' },
  logoutButton: { borderColor: Colors.error, borderRadius: 8 },
});
