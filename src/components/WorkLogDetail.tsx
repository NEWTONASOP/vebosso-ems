// ============================================================================
// VEBOSSO EMS — Work Log Detail Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Divider, Modal, Portal, Text } from 'react-native-paper';
import { Colors } from '../constants/colors';
import { WORK_LOG_STATUS_CONFIG } from '../constants/roles';
import { supabase } from '../lib/supabase';
import { Task, WorkLog } from '../types/database';

interface WorkLogDetailProps {
  visible: boolean;
  onDismiss: () => void;
  workLog: WorkLog | null;
  tasks?: Task[];
  onPrevDay?: () => void;
  onNextDay?: () => void;
  hasPrevDay?: boolean;
  hasNextDay?: boolean;
}

const TASK_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#8E8E93', bg: '#F4F4F6', label: 'Pending' },
  in_progress: { color: '#007AFF', bg: 'rgba(0,122,255,0.08)', label: 'In Progress' },
  done: { color: '#34C759', bg: 'rgba(52,199,89,0.08)', label: 'Done' },
};

export function WorkLogDetail({ 
  visible, 
  onDismiss, 
  workLog, 
  tasks = [],
  onPrevDay,
  onNextDay,
  hasPrevDay = false,
  hasNextDay = false
}: WorkLogDetailProps) {
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  // Reset state during render when workLog changes
  const [prevWorkLogId, setPrevWorkLogId] = useState<string | undefined>(undefined);
  if (workLog?.id !== prevWorkLogId) {
    setPrevWorkLogId(workLog?.id);
    setPhotoUrls([]);
  }

  useEffect(() => {
    if (workLog?.check_out_photos && workLog.check_out_photos.length > 0) {
      let isMounted = true;
      const loadPhotos = async () => {
        try {
          const urls = await Promise.all(
            workLog.check_out_photos!.map(async (path) => {
              const { data } = await supabase.storage
                .from('checkouts')
                .createSignedUrl(path, 3600); // 1 hour
              return data?.signedUrl || '';
            })
          );
          if (isMounted) {
            setPhotoUrls(urls.filter(Boolean));
          }
        } catch (err) {
          console.error('Failed to load signed URLs:', err);
        }
      };
      loadPhotos();
      return () => {
        isMounted = false;
      };
    }
  }, [workLog?.check_out_photos]);

  if (!workLog) return null;

  const statusConfig = WORK_LOG_STATUS_CONFIG[workLog.status];

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.dateTitle}>
              {format(new Date(workLog.date), 'EEEE, MMMM dd, yyyy')}
            </Text>
            <View style={styles.headerActions}>
              <Chip
                style={[styles.statusChip, { backgroundColor: statusConfig.backgroundColor }]}
                textStyle={[styles.statusText, { color: statusConfig.color }]}
                compact
              >
                {statusConfig.label}
              </Chip>
              <View style={styles.navButtons}>
                {onPrevDay && (
                  <Pressable
                    onPress={onPrevDay}
                    disabled={!hasPrevDay}
                    style={({ pressed }) => [
                      styles.closeBtn,
                      !hasPrevDay && { opacity: 0.3 },
                      pressed && hasPrevDay && { opacity: 0.5 }
                    ]}
                    hitSlop={12}
                  >
                    <Feather name="chevron-left" size={26} color={Colors.textSecondary} />
                  </Pressable>
                )}
                {onNextDay && (
                  <Pressable
                    onPress={onNextDay}
                    disabled={!hasNextDay}
                    style={({ pressed }) => [
                      styles.closeBtn,
                      !hasNextDay && { opacity: 0.3 },
                      pressed && hasNextDay && { opacity: 0.5 }
                    ]}
                    hitSlop={12}
                  >
                    <Feather name="chevron-right" size={26} color={Colors.textSecondary} />
                  </Pressable>
                )}
                <Pressable
                  onPress={onDismiss}
                  style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
                  hitSlop={12}
                >
                  <Feather name="x" size={24} color={Colors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>

          <Divider style={styles.divider} />

          {/* Time Summary */}
          <View style={styles.timeRow}>
            <View style={styles.timeCard}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(52, 199, 89, 0.1)' }]}>
                <Feather name="log-in" size={16} color="#34C759" />
              </View>
              <Text style={styles.timeLabel}>Check In</Text>
              <Text style={styles.timeValue}>
                {workLog.check_in_time
                  ? format(new Date(workLog.check_in_time), 'hh:mm a')
                  : '--:--'}
              </Text>
            </View>
            <View style={styles.timeCard}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(255, 59, 48, 0.1)' }]}>
                <Feather name="log-out" size={16} color="#FF3B30" />
              </View>
              <Text style={styles.timeLabel}>Check Out</Text>
              <Text style={styles.timeValue}>
                {workLog.check_out_time
                  ? format(new Date(workLog.check_out_time), 'hh:mm a')
                  : '--:--'}
              </Text>
            </View>
            <View style={styles.timeCard}>
              <View style={[styles.iconWrapper, { backgroundColor: 'rgba(0, 122, 255, 0.1)' }]}>
                <Feather name="clock" size={16} color="#007AFF" />
              </View>
              <Text style={styles.timeLabel}>Total Hours</Text>
              <Text style={styles.timeValue}>
                {workLog.total_hours ? `${workLog.total_hours}h` : '--'}
              </Text>
            </View>
          </View>

          {/* Check-in Plan */}
          {workLog.check_in_plan && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Feather name="clipboard" size={14} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>Plan for the Day</Text>
              </View>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionText}>{workLog.check_in_plan}</Text>
              </View>
            </View>
          )}

          {/* Day Report */}
          {workLog.day_report && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Feather name="edit-3" size={14} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>Day Report</Text>
              </View>
              <View style={styles.sectionContent}>
                <Text style={styles.sectionText}>{workLog.day_report}</Text>
              </View>
            </View>
          )}

          {/* Checkout Photos */}
          {photoUrls.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Feather name="image" size={14} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>Day Photos</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
                <View style={styles.photosContainer}>
                  {photoUrls.map((url, index) => (
                    <Pressable
                      key={index}
                      onPress={() => setSelectedPhoto(url)}
                      style={({ pressed }) => [styles.photoWrapper, pressed && { opacity: 0.9 }]}
                    >
                      <Image source={{ uri: url }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Rejection Reason */}
          {workLog.rejection_reason && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Feather name="x-circle" size={14} color={Colors.error} />
                <Text style={styles.sectionTitle}>Rejection Reason</Text>
              </View>
              <View style={[styles.sectionContent, styles.rejectionContent]}>
                <Text style={styles.sectionText}>{workLog.rejection_reason}</Text>
              </View>
            </View>
          )}

          {/* Tasks */}
          {tasks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionTitleRow}>
                <Feather name="list" size={14} color={Colors.textSecondary} />
                <Text style={styles.sectionTitle}>Tasks ({tasks.length})</Text>
              </View>
              <View style={styles.tasksList}>
                {tasks.map((task) => {
                  const tConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending;
                  return (
                    <View key={task.id} style={styles.taskItem}>
                      <View style={styles.taskHeader}>
                        <View style={[styles.taskStatusDot, { backgroundColor: tConfig.color }]} />
                        <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                        <View style={[styles.taskStatusBadge, { backgroundColor: tConfig.bg }]}>
                          <Text style={[styles.taskStatusText, { color: tConfig.color }]}>
                            {tConfig.label}
                          </Text>
                        </View>
                      </View>
                      {task.description ? (
                        <Text style={styles.taskDesc} numberOfLines={2}>{task.description}</Text>
                      ) : null}
                      {task.completion_note && task.status === 'done' ? (
                        <View style={styles.completionNoteBox}>
                          <View style={styles.completionNoteHeader}>
                            <Feather name="check-circle" size={12} color={Colors.success} />
                            <Text style={styles.completionNoteLabel}>Completion Note</Text>
                          </View>
                          <Text style={styles.completionNoteText}>{task.completion_note}</Text>
                        </View>
                      ) : null}
                      {task.due_date ? (
                        <View style={styles.taskDueRow}>
                          <Feather name="calendar" size={11} color={Colors.textTertiary} />
                          <Text style={styles.taskDueText}>
                            Due {format(new Date(task.due_date), 'MMM dd')}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </Modal>

      {/* Full-screen Photo Modal */}
      <Portal>
        <Modal
          visible={!!selectedPhoto}
          onDismiss={() => setSelectedPhoto(null)}
          contentContainerStyle={styles.fullImageModal}
        >
          {selectedPhoto && (
            <View style={styles.fullImageWrapper}>
              <Image source={{ uri: selectedPhoto }} style={styles.fullImage} resizeMode="contain" />
              <Pressable
                onPress={() => setSelectedPhoto(null)}
                style={styles.closeFullImageBtn}
              >
                <Feather name="x" size={24} color={Colors.white} />
              </Pressable>
            </View>
          )}
        </Modal>
      </Portal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  header: {
    gap: 10,
  },
  dateTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusChip: {
    alignSelf: 'center',
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
  },
  divider: {
    backgroundColor: Colors.divider,
    marginVertical: 16,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  timeCard: {
    flex: 1,
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  timeLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  timeValue: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  sectionContent: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 10,
    padding: 14,
  },
  rejectionContent: {
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  sectionText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 22,
  },
  // Tasks
  closeBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLighter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tasksList: {
    gap: 10,
  },
  taskItem: {
    backgroundColor: Colors.primaryLight,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  taskStatusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  taskStatusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  taskStatusText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
  },
  taskDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginLeft: 15,
    marginTop: 2,
    fontFamily: 'Inter_400Regular',
  },
  taskDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    marginLeft: 15,
  },
  taskDueText: {
    fontSize: 11,
    color: Colors.textTertiary,
    fontFamily: 'Inter_500Medium',
  },
  completionNoteBox: {
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    marginLeft: 15,
    borderLeftWidth: 2,
    borderLeftColor: Colors.success,
  },
  completionNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  completionNoteLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
  },
  completionNoteText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    lineHeight: 18,
  },
  photosScroll: {
    marginTop: 8,
    marginBottom: 4,
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  photoWrapper: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  fullImageModal: {
    margin: 0,
    padding: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullImageWrapper: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
  closeFullImageBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
