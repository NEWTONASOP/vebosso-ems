// ============================================================================
// VEBOSSO EMS — Work Log Detail Component
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, appSoftShadow } from '../constants/theme';
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

/**
 * Long descriptions are clamped so the modal stays navigable. Measuring the
 * rendered text would be exact but `onTextLayout` is unreliable on web, so the
 * affordance appears past a length that reliably wraps beyond the clamp.
 */
const LIKELY_CLAMPED = 130;

const TASK_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: AppTheme.mute, bg: AppTheme.soft, label: 'Pending' },
  in_progress: { color: AppTheme.blue, bg: AppTheme.blueSoft, label: 'In Progress' },
  done: { color: AppTheme.green, bg: AppTheme.greenSoft, label: 'Done' },
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
  const [checkInPhotoUrls, setCheckInPhotoUrls] = useState<string[]>([]);
  const [checkOutPhotoUrls, setCheckOutPhotoUrls] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [expandedTasks, setExpandedTasks] = useState<string[]>([]);

  const toggleTask = (id: string) =>
    setExpandedTasks((open) =>
      open.includes(id) ? open.filter((t) => t !== id) : [...open, id]
    );

  // Reset state during render when workLog changes
  const [prevWorkLogId, setPrevWorkLogId] = useState<string | undefined>(undefined);
  if (workLog?.id !== prevWorkLogId) {
    setPrevWorkLogId(workLog?.id);
    setCheckInPhotoUrls([]);
    setCheckOutPhotoUrls([]);
    setExpandedTasks([]);
  }

  useEffect(() => {
    const paths = workLog?.check_in_photos;
    if (!paths?.length) {
      setCheckInPhotoUrls([]);
      return;
    }
    let isMounted = true;
    const loadPhotos = async () => {
      try {
        const urls = await Promise.all(
          paths.map(async (path) => {
            const { data } = await supabase.storage.from('checkouts').createSignedUrl(path, 3600);
            return data?.signedUrl || '';
          })
        );
        if (isMounted) setCheckInPhotoUrls(urls.filter(Boolean));
      } catch (err) {
        console.error('Failed to load check-in photo URLs:', err);
      }
    };
    void loadPhotos();
    return () => {
      isMounted = false;
    };
  }, [workLog?.check_in_photos]);

  useEffect(() => {
    const paths = workLog?.check_out_photos;
    if (!paths?.length) {
      setCheckOutPhotoUrls([]);
      return;
    }
    let isMounted = true;
    const loadPhotos = async () => {
      try {
        const urls = await Promise.all(
          paths.map(async (path) => {
            const { data } = await supabase.storage.from('checkouts').createSignedUrl(path, 3600);
            return data?.signedUrl || '';
          })
        );
        if (isMounted) setCheckOutPhotoUrls(urls.filter(Boolean));
      } catch (err) {
        console.error('Failed to load checkout photo URLs:', err);
      }
    };
    void loadPhotos();
    return () => {
      isMounted = false;
    };
  }, [workLog?.check_out_photos]);

  if (!workLog) return null;

  const statusConfig = WORK_LOG_STATUS_CONFIG[workLog.status];
  const logDate = new Date(workLog.date);
  const showStepper = !!(onPrevDay || onNextDay);

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.weekday}>{format(logDate, 'EEEE')}</Text>
              <Text style={styles.dateTitle}>{format(logDate, 'd MMMM yyyy')}</Text>
            </View>
            <Pressable
              onPress={onDismiss}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.5 }]}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Feather name="x" size={20} color={AppTheme.inkSoft} />
            </Pressable>
          </View>

          <View style={styles.metaRow}>
            <View
              style={[styles.statusPill, { backgroundColor: statusConfig.backgroundColor }]}
            >
              <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusConfig.label}
              </Text>
            </View>

            {showStepper ? (
              <View style={styles.stepper}>
                <Pressable
                  onPress={onPrevDay}
                  disabled={!hasPrevDay}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    pressed && hasPrevDay && { opacity: 0.5 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous day with a record"
                >
                  <Feather
                    name="chevron-left"
                    size={19}
                    color={hasPrevDay ? AppTheme.ink : AppTheme.mute}
                  />
                </Pressable>
                <View style={styles.stepDivider} />
                <Pressable
                  onPress={onNextDay}
                  disabled={!hasNextDay}
                  style={({ pressed }) => [
                    styles.stepBtn,
                    pressed && hasNextDay && { opacity: 0.5 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next day with a record"
                >
                  <Feather
                    name="chevron-right"
                    size={19}
                    color={hasNextDay ? AppTheme.ink : AppTheme.mute}
                  />
                </Pressable>
              </View>
            ) : null}
          </View>

          {/* Session summary — one bar reads as a span of time, where three
              separate tiles read as three unrelated numbers. */}
          <View style={styles.session}>
            <View style={styles.sessionSide}>
              <View style={styles.sessionLabelRow}>
                <View style={[styles.endpoint, { backgroundColor: AppTheme.green }]} />
                <Text style={styles.sessionLabel}>In</Text>
              </View>
              <Text style={styles.sessionTime}>
                {workLog.check_in_time
                  ? format(new Date(workLog.check_in_time), 'h:mm a')
                  : '--:--'}
              </Text>
            </View>

            <View style={styles.sessionMid}>
              <View style={styles.sessionLine} />
              <View style={styles.hoursPill}>
                <Text style={styles.hoursText}>
                  {workLog.total_hours ? `${workLog.total_hours.toFixed(2)}h` : 'Open'}
                </Text>
              </View>
              <View style={styles.sessionLine} />
            </View>

            <View style={[styles.sessionSide, styles.sessionSideEnd]}>
              <View style={styles.sessionLabelRow}>
                <Text style={styles.sessionLabel}>Out</Text>
                <View
                  style={[
                    styles.endpoint,
                    { backgroundColor: workLog.check_out_time ? AppTheme.coral : AppTheme.soft2 },
                  ]}
                />
              </View>
              <Text style={styles.sessionTime}>
                {workLog.check_out_time
                  ? format(new Date(workLog.check_out_time), 'h:mm a')
                  : '--:--'}
              </Text>
            </View>
          </View>

          {workLog.check_in_plan ? (
            <Section label="Plan for the day">
              <Text style={styles.body}>{workLog.check_in_plan}</Text>
            </Section>
          ) : null}

          {checkInPhotoUrls.length > 0 ? (
            <Section label="Start photos">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photosContainer}>
                  {checkInPhotoUrls.map((url, index) => (
                    <Pressable
                      key={`in-${index}`}
                      onPress={() => setSelectedPhoto(url)}
                      style={({ pressed }) => [styles.photoWrapper, pressed && { opacity: 0.9 }]}
                    >
                      <Image source={{ uri: url }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Section>
          ) : null}

          {workLog.day_report ? (
            <Section label="Day report">
              <Text style={styles.body}>{workLog.day_report}</Text>
            </Section>
          ) : null}

          {checkOutPhotoUrls.length > 0 ? (
            <Section label="End photos">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.photosContainer}>
                  {checkOutPhotoUrls.map((url, index) => (
                    <Pressable
                      key={`out-${index}`}
                      onPress={() => setSelectedPhoto(url)}
                      style={({ pressed }) => [styles.photoWrapper, pressed && { opacity: 0.9 }]}
                    >
                      <Image source={{ uri: url }} style={styles.photo} />
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </Section>
          ) : null}

          {workLog.rejection_reason ? (
            <Section label="Why this was rejected">
              <View style={styles.alertBox}>
                <Text style={styles.alertText}>{workLog.rejection_reason}</Text>
              </View>
            </Section>
          ) : null}

          {tasks.length > 0 ? (
            <Section label={`Tasks · ${tasks.length}`}>
                {tasks.map((task, index) => {
                  const tConfig = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending;
                  const open = expandedTasks.includes(task.id);
                  const canExpand = (task.description?.length ?? 0) > LIKELY_CLAMPED;
                  return (
                    <Pressable
                      key={task.id}
                      onPress={canExpand ? () => toggleTask(task.id) : undefined}
                      style={({ pressed }) => [
                        styles.taskRow,
                        index > 0 && styles.taskRowDivided,
                        pressed && canExpand && { opacity: 0.6 },
                      ]}
                    >
                      <View style={styles.taskHeader}>
                        <View style={[styles.taskDot, { backgroundColor: tConfig.color }]} />
                        <Text style={styles.taskTitle}>{task.title}</Text>
                        <Text style={[styles.taskStatus, { color: tConfig.color }]}>
                          {tConfig.label}
                        </Text>
                      </View>
                      {task.description ? (
                        <Text
                          style={styles.taskDesc}
                          numberOfLines={open || !canExpand ? undefined : 3}
                        >
                          {task.description}
                        </Text>
                      ) : null}
                      {canExpand ? (
                        <View style={styles.moreRow}>
                          <Text style={styles.moreText}>
                            {open ? 'Show less' : 'Show full details'}
                          </Text>
                          <Feather
                            name={open ? 'chevron-up' : 'chevron-down'}
                            size={13}
                            color={AppTheme.blue}
                          />
                        </View>
                      ) : null}
                      {task.completion_note && task.status === 'done' ? (
                        <View style={styles.completionNoteBox}>
                          <Text style={styles.completionNoteLabel}>Completion note</Text>
                          <Text style={styles.completionNoteText}>{task.completion_note}</Text>
                        </View>
                      ) : null}
                      {task.due_date ? (
                        <Text style={styles.taskDueText}>
                          Due {format(new Date(task.due_date), 'MMM dd')}
                        </Text>
                      ) : null}
                    </Pressable>
                  );
                })}
            </Section>
          ) : null}
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
                <Feather name="x" size={24} color={AppTheme.white} />
              </Pressable>
            </View>
          )}
        </Modal>
      </Portal>
    </Portal>
  );
}

/**
 * Content sits directly on the sheet, divided by a hairline. Wrapping every
 * block in its own filled card stacked boxes inside boxes and made the sheet
 * read as a pile of containers rather than a document.
 */
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    // Percentage width keeps the inset on phones while the cap stops the sheet
    // stretching across a desktop browser window.
    width: '92%',
    maxWidth: 560,
    alignSelf: 'center',
    marginVertical: 16,
    borderRadius: 24,
    padding: 20,
    maxHeight: '85%',
    ...appSoftShadow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  weekday: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.mute,
    marginBottom: 1,
  },
  dateTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    letterSpacing: -0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
    marginBottom: 18,
    gap: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.soft,
    borderRadius: 999,
    overflow: 'hidden',
  },
  stepBtn: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDivider: {
    width: 1,
    height: 16,
    backgroundColor: AppTheme.soft2,
  },
  session: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.soft,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 22,
    gap: 10,
  },
  sessionSide: {
    gap: 3,
  },
  sessionSideEnd: {
    alignItems: 'flex-end',
  },
  sessionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  endpoint: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  sessionLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sessionTime: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    letterSpacing: -0.3,
  },
  sessionMid: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  sessionLine: {
    flex: 1,
    height: 2,
    borderRadius: 1,
    backgroundColor: AppTheme.soft2,
  },
  hoursPill: {
    paddingHorizontal: 9,
    height: 24,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.card,
  },
  hoursText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.inkSoft,
  },
  section: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.hairline,
    paddingTop: 16,
    marginBottom: 18,
  },
  sectionLabel: {
    fontSize: 11.5,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.mute,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  body: {
    fontSize: 14.5,
    color: AppTheme.ink,
    lineHeight: 23,
    fontFamily: 'Inter_400Regular',
  },
  // The one tinted block in the sheet, because a rejection is the only thing
  // here that needs to interrupt someone reading.
  alertBox: {
    backgroundColor: AppTheme.coralSoft,
    borderRadius: 12,
    padding: 13,
  },
  alertText: {
    fontSize: 14,
    color: AppTheme.ink,
    lineHeight: 21,
    fontFamily: 'Inter_400Regular',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskRow: {
    paddingVertical: 12,
  },
  taskRowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppTheme.hairline,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  taskTitle: {
    flex: 1,
    fontSize: 14.5,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
    letterSpacing: -0.2,
  },
  taskStatus: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  taskDesc: {
    fontSize: 13.5,
    color: AppTheme.inkSoft,
    lineHeight: 21,
    marginTop: 6,
    marginLeft: 15,
    fontFamily: 'Inter_400Regular',
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 8,
    marginLeft: 15,
  },
  moreText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12.5,
    color: AppTheme.blue,
  },
  taskDueText: {
    fontSize: 11.5,
    color: AppTheme.mute,
    fontFamily: 'Inter_500Medium',
    marginTop: 6,
    marginLeft: 15,
  },
  completionNoteBox: {
    backgroundColor: AppTheme.greenSoft,
    borderRadius: 10,
    padding: 11,
    marginTop: 10,
    marginLeft: 15,
  },
  completionNoteLabel: {
    fontSize: 10.5,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.green,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  completionNoteText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.ink,
    lineHeight: 19,
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
    borderRadius: 14,
    overflow: 'hidden',
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
