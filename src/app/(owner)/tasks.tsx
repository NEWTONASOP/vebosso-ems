// ============================================================================
// VEBOSSO EMS — Owner: Task Tracking & Status Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Snackbar, Text } from 'react-native-paper';
import { EmptyState } from '../../components/EmptyState';
import { ListSkeleton } from '../../components/LoadingSkeleton';
import { MemberPickerModal } from '../../components/MemberPickerModal';
import { PageTransition } from '../../components/PageTransition';
import { TaskDetailModal } from '../../components/TaskDetailModal';
import {
  AppTheme as T,
  AppSpace,
  AppRadius,
  appSoftShadow,
  screenChrome,
} from '../../constants/theme';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';
import { useWorkStore } from '../../store/workStore';
import { Task, TaskStatus } from '../../types/database';

interface TaskWithAssignee extends Task {
  assignee: {
    id: string;
    full_name: string;
    employee_id: string;
    avatar_url: string | null;
    role: string;
  };
}

export default function OwnerTaskTrackingScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { reassignTask } = useWorkStore();
  const [tasks, setTasks] = useState<TaskWithAssignee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TaskStatus | 'all'>('all');
  const [snackMessage, setSnackMessage] = useState('');
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignee | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);

  const fetchAssignedTasks = useCallback(async (silent = false) => {
    if (!profile?.id) return;
    if (!silent) setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*, assignee:profiles!tasks_assigned_to_fkey(id, full_name, employee_id, avatar_url, role)')
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
    fetchTeamMembers();
  }, [fetchAssignedTasks]);

  const fetchTeamMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, employee_id, avatar_url, role')
        .eq('is_active', true)
        .neq('role', 'owner')
        .order('full_name');

      if (error) {
        if (__DEV__) console.error('Error fetching team members:', error);
      } else {
        setTeamMembers(data || []);
      }
    } catch (err) {
      if (__DEV__) console.error('Error fetching team members:', err);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAssignedTasks(true);
    setRefreshing(false);
  };

  const handleTaskPress = (task: TaskWithAssignee) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const handleReassignPress = () => {
    setShowMemberPicker(true);
  };

  const handleMemberSelect = async (member: any) => {
    if (!selectedTask || !profile?.id) return;
    
    setShowMemberPicker(false);
    
    const result = await reassignTask(selectedTask.id, member.id, profile.id);
    
    if (result.success) {
      setSnackMessage('Task reassigned successfully');
      setShowDetailModal(false);
      fetchAssignedTasks(true);
    } else {
      setSnackMessage(result.error || 'Failed to reassign task');
    }
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
          color: T.green,
          bgColor: T.greenSoft,
          label: 'Completed',
        };
      case 'in_progress':
        return {
          icon: 'play-circle',
          color: T.blue,
          bgColor: T.blueSoft,
          label: 'Running',
        };
      default:
        return {
          icon: 'clock',
          color: T.amber,
          bgColor: T.amberSoft,
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

  const filterOptions = [
    { key: 'all' as const, label: 'All', count: stats.total },
    { key: 'pending' as const, label: 'Pending', count: stats.pending },
    { key: 'in_progress' as const, label: 'Running', count: stats.inProgress },
    { key: 'done' as const, label: 'Done', count: stats.done },
  ];

  return (
    <PageTransition>
      <View style={styles.container}>
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
            <Feather name="arrow-left" size={18} color={T.charcoal} />
          </Pressable>
          <View style={styles.headerTextContainer}>
            <Text style={screenChrome.title}>Track Tasks</Text>
            <Text style={screenChrome.subtitle}>
              {stats.done}/{stats.total} completed
            </Text>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.charcoal} />}
          showsVerticalScrollIndicator={false}
        >
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

          <View style={styles.filterRow}>
            {filterOptions.map((f) => {
              const isActive = filter === f.key;
              return (
                <Pressable
                  key={f.key}
                  style={[
                    screenChrome.filterChip,
                    isActive && screenChrome.filterChipActive,
                  ]}
                  onPress={() => setFilter(f.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={`${f.label}, ${f.count} tasks`}
                >
                  <Text
                    style={[
                      screenChrome.filterChipText,
                      isActive && screenChrome.filterChipTextActive,
                    ]}
                  >
                    {f.label}{' '}
                    <Text
                      style={[
                        screenChrome.filterChipCount,
                        isActive && screenChrome.filterChipCountActive,
                      ]}
                    >
                      {f.count}
                    </Text>
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.listContainer}>
            {isLoading ? (
              <ListSkeleton count={4} variant="task-row" />
            ) : filteredTasks.length > 0 ? (
              <View style={styles.tasksList}>
                {filteredTasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status);
                  const dueDate = getFormattedDate(task.due_date);
                  
                  return (
                    <Pressable
                      key={task.id}
                      style={({ pressed }) => [
                        styles.taskCard,
                        pressed && styles.taskCardPressed,
                      ]}
                      onPress={() => handleTaskPress(task)}
                    >
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
                            <Feather name="calendar" size={12} color={T.mute} style={styles.calendarIcon} />
                            <Text style={styles.dueDateText}>Due {dueDate}</Text>
                          </View>
                        )}
                      </View>
                    </Pressable>
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

        <TaskDetailModal
          visible={showDetailModal}
          onDismiss={() => setShowDetailModal(false)}
          task={selectedTask}
          onReassign={handleReassignPress}
        />

        <MemberPickerModal
          visible={showMemberPicker}
          onDismiss={() => setShowMemberPicker(false)}
          members={teamMembers}
          selectedMember={null}
          onSelectMember={handleMemberSelect}
        />
      </View>
    </PageTransition>
  );
}

const styles = StyleSheet.create({
  container: screenChrome.root,
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: AppSpace.screen,
    paddingTop: screenChrome.headerRow.paddingTop,
    paddingBottom: 12,
  },
  backBtn: {
    marginRight: 12,
  },
  btnPressed: {
    opacity: 0.7,
  },
  headerTextContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  progressCard: {
    backgroundColor: T.card,
    marginHorizontal: AppSpace.screen,
    marginTop: 12,
    padding: 18,
    borderRadius: AppRadius.card,
    ...appSoftShadow,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
    color: T.ink,
    letterSpacing: -0.2,
  },
  progressValue: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    color: T.ink,
    letterSpacing: -0.4,
  },
  progressBar: {
    height: 6,
    backgroundColor: T.soft,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: T.charcoal,
    borderRadius: 3,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: AppSpace.screen,
    marginTop: 20,
    marginBottom: 12,
    gap: 8,
  },
  listContainer: {
    paddingHorizontal: AppSpace.screen,
  },
  tasksList: {
    gap: 12,
  },
  taskCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    padding: 16,
    ...appSoftShadow,
  },
  taskCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    color: T.ink,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  taskDesc: {
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    color: T.mute,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AppRadius.chip,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    fontFamily: 'Inter_500Medium',
    fontSize: 11,
  },
  taskFooterDivider: {
    height: 1,
    backgroundColor: T.hairline,
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
    backgroundColor: T.soft,
  },
  avatarLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    color: T.mute,
  },
  assigneeName: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: T.mute,
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
    color: T.mute,
  },
  emptyCard: {
    backgroundColor: T.card,
    borderRadius: AppRadius.card,
    padding: 24,
    alignItems: 'center',
    ...appSoftShadow,
  },
});
