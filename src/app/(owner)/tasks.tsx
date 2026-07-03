// ============================================================================
// VEBOSSO EMS — Owner: Task Tracking & Status Screen
// ============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Platform, Pressable } from 'react-native';
import { Text, Snackbar, Avatar } from 'react-native-paper';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { EmptyState } from '../../components/EmptyState';
import { Task, TaskStatus } from '../../types/database';
import { PageTransition } from '../../components/PageTransition';
import { Colors } from '../../constants/colors';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';

interface TaskWithAssignee extends Task {
  assignee: {
    full_name: string;
    employee_id: string;
    avatar_url: string | null;
    role: string;
  };
}

export default function OwnerTaskTrackingScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [snackMessage, setSnackMessage] = useState('');

  const fetchAssignedTasks = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    if (!silent) setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(full_name, employee_id, avatar_url, role)')
        .eq('assigned_by', profile.id)
        .order('created_at', { ascending: false });

      if (error) {
        setSnackMessage(error.message);
      } else {
        setTasks((data || []) as unknown as TaskWithAssignee[]);
      }
    } catch (err: any) {
      setSnackMessage(err.message || 'Failed to fetch tasks');
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchAssignedTasks();
  }, [fetchAssignedTasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedTasks(true);
    setRefreshing(false);
  };

  const filteredTasks = filter === 'all'
    ? tasks
    : tasks.filter((t) => t.status === filter);

  const stats = {
    total: tasks.length,
    done: tasks.filter((t) => t.status === 'done').length,
    inProgress: tasks.filter((t) => t.status === 'in_progress').length,
    pending: tasks.filter((t) => t.status === 'pending').length,
  };

  const getStatusConfig = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return {
          icon: 'check-circle',
          color: Colors.success,
          bgColor: Colors.success + '12',
          label: 'Completed',
        };
      case 'in_progress':
        return {
          icon: 'play-circle',
          color: Colors.accent,
          bgColor: Colors.accent + '12',
          label: 'Running',
        };
      default:
        return {
          icon: 'clock',
          color: Colors.textSecondary,
          bgColor: Colors.textSecondary + '12',
          label: 'Pending',
        };
    }
  };

  const getFormattedDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try {
      return format(new Date(dateStr), 'MMM dd');
    } catch {
      return dateStr;
    }
  };

  return (
    <PageTransition>
      <View style={styles.container}>
        {/* Header with back button */}
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
          <View style={styles.headerTextContainer}>
            <Text style={styles.title}>Track Tasks</Text>
            <Text style={styles.subtitle}>
              {stats.done}/{stats.total} completed
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Progress Analytics Card */}
          {stats.total > 0 && (
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressTitle}>Overall Task Progress</Text>
                <Text style={styles.progressValue}>
                  {Math.round((stats.done / stats.total) * 100)}%
                </Text>
              </View>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${(stats.done / stats.total) * 100}%` }]}
                />
              </View>
            </View>
          )}

          {/* Filter segment pills */}
          <View style={styles.filterRow}>
            {(['all', 'pending', 'in_progress', 'done'] as const).map((f) => {
              const isActive = filter === f;
              const count = f === 'all' ? stats.total : f === 'pending' ? stats.pending : f === 'in_progress' ? stats.inProgress : stats.done;
              const label = f === 'all' ? 'All' : f === 'pending' ? 'Pending' : f === 'in_progress' ? 'Running' : 'Done';
              return (
                <Pressable
                  key={f}
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setFilter(f)}
                >
                  <Text style={[styles.filterText, isActive && styles.filterTextActive]}>
                    {label} ({count})
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Tasks List */}
          <View style={styles.listContainer}>
            {isLoading ? (
              <ListSkeleton count={4} />
            ) : filteredTasks.length > 0 ? (
              <View style={styles.tasksList}>
                {filteredTasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status);
                  const dueDate = getFormattedDate(task.due_date);
                  
                  return (
                    <View key={task.id} style={styles.taskCard}>
                      <View style={styles.taskHeader}>
                        <View style={[styles.statusIconContainer, { backgroundColor: statusConfig.bgColor }]}>
                          <Feather name={statusConfig.icon as any} size={16} color={statusConfig.color} />
                        </View>
                        <View style={styles.taskInfo}>
                          <Text style={styles.taskTitle} numberOfLines={2}>
                            {task.title}
                          </Text>
                          {task.description && (
                            <Text style={styles.taskDesc} numberOfLines={2}>
                              {task.description}
                            </Text>
                          )}
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bgColor }]}>
                          <Text style={[styles.statusBadgeText, { color: statusConfig.color }]}>
                            {statusConfig.label}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.taskFooterDivider} />
                      
                      <View style={styles.taskFooter}>
                        <View style={styles.assigneeInfo}>
                          <Avatar.Text
                            size={20}
                            label={task.assignee?.full_name?.substring(0, 2).toUpperCase() || '??'}
                            style={styles.avatar}
                            labelStyle={styles.avatarLabel}
                          />
                          <Text style={styles.assigneeName} numberOfLines={1}>
                            {task.assignee?.full_name} ({task.assignee?.employee_id})
                          </Text>
                        </View>
                        {dueDate && (
                          <View style={styles.dueDateContainer}>
                            <Feather name="calendar" size={12} color={Colors.textTertiary} style={styles.calendarIcon} />
                            <Text style={styles.dueDateText}>Due {dueDate}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <EmptyState
                  icon="clipboard-text-outline"
                  title="No Tasks Found"
                  subtitle={filter === 'all' ? 'You haven\'t assigned any tasks yet.' : 'No tasks in this category'}
                />
              </View>
            )}
          </View>
        </ScrollView>

        <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
          {snackMessage}
        </Snackbar>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  btnPressed: {
    opacity: 0.7,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 24,
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    marginHorizontal: 20,
    marginTop: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: Colors.text,
  },
  progressValue: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 18,
    color: Colors.accent,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#F2F2F7',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.accent,
    borderColor: Colors.accent,
  },
  filterText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  tasksList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.04)',
    ...Colors.shadow,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: Colors.text,
    marginBottom: 4,
  },
  taskDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  taskFooterDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  assigneeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  avatar: {
    backgroundColor: '#F2F2F7',
  },
  avatarLabel: {
    fontSize: 9,
    fontFamily: 'Inter_700Bold',
    color: Colors.textSecondary,
  },
  assigneeName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
  },
  dueDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  calendarIcon: {
    marginRight: 4,
  },
  dueDateText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
});
