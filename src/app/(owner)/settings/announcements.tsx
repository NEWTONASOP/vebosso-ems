// ============================================================================
// VEBOSSO EMS — Announcements Management Screen
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Snackbar, Text, TextInput } from 'react-native-paper';
import { AnnouncementCard } from '../../../components/AnnouncementCard';
import { EmptyState } from '../../../components/EmptyState';
import {
  AppRadius,
  AppSpace,
  AppTheme as T,
  appSoftShadow,
  screenChrome,
} from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';
import { Alert } from '../../../lib/alert';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { announcements, fetchAnnouncements, createAnnouncement, deleteAnnouncement } = useWorkStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  const isOwner = profile?.role === 'owner';

  useEffect(() => {
    if (profile) {
      fetchAnnouncements(profile.role, profile.id);
    }
  }, [profile, fetchAnnouncements]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setSnackMessage('Title and body are required');
      return;
    }
    if (!profile) return;
    if (!isOwner) {
      setSnackMessage('Only the Owner can create announcements.');
      return;
    }

    setIsLoading(true);
    const result = await createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      target_role: targetRole as any,
      created_by: profile.id,
    });
    setIsLoading(false);

    if (result.success) {
      setSnackMessage('Announcement sent!');
      setTitle('');
      setBody('');
      setShowForm(false);
      fetchAnnouncements(profile.role, profile.id);
    } else {
      setSnackMessage(result.error || 'Failed to send announcement. Please try again.');
    }
  };

  const handleDelete = (announcementId: string) => {
    if (!profile || !isOwner) return;
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to permanently delete this announcement?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteAnnouncement(announcementId);

            if (res.success) {
              setSnackMessage('Announcement deleted.');
              fetchAnnouncements(profile.role, profile.id);
            } else {
              setSnackMessage(res.error || 'Failed to delete announcement.');
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
        <Text style={screenChrome.title}>Announcements</Text>
        <View style={styles.headerSpacer} />
        {isOwner && (
          <Pressable
            style={({ pressed }) => [
              showForm ? styles.cancelBtn : screenChrome.primaryPill,
              pressed && styles.btnPressed,
            ]}
            onPress={() => setShowForm(!showForm)}
            accessibilityRole="button"
            accessibilityLabel={showForm ? 'Cancel' : 'New announcement'}
          >
            <Feather name={showForm ? 'x' : 'plus'} size={16} color={showForm ? T.inkSoft : T.white} />
            <Text style={showForm ? styles.cancelBtnText : screenChrome.primaryPillText}>
              {showForm ? 'Cancel' : 'New'}
            </Text>
          </Pressable>
        )}
      </View>

      {isOwner && showForm && (
        <View style={styles.formSection}>
          <TextInput
            mode="outlined"
            label="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            style={styles.input}
            outlineColor={T.soft2}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />
          <TextInput
            mode="outlined"
            label="Message"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={3}
            maxLength={2000}
            style={styles.input}
            outlineColor={T.soft2}
            activeOutlineColor={T.charcoal}
            textColor={T.ink}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: T.mute, surface: T.soft } }}
          />

          <Text style={styles.fieldLabel}>Target audience</Text>
          <View style={[screenChrome.segmentTrack, styles.segmentMargin]}>
            {[
              { value: 'all', label: 'Everyone' },
              { value: 'manager', label: 'Managers' },
              { value: 'member', label: 'Members' },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  screenChrome.segmentBtn,
                  targetRole === option.value && screenChrome.segmentBtnActive,
                ]}
                onPress={() => setTargetRole(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected: targetRole === option.value }}
                accessibilityLabel={option.label}
              >
                <Text
                  style={[
                    screenChrome.segmentText,
                    targetRole === option.value && screenChrome.segmentTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Single charcoal primary when form is open */}
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && styles.btnPressed,
              isLoading && styles.sendBtnDisabled,
            ]}
            onPress={handleSend}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel="Send Announcement"
          >
            <Feather name="send" size={16} color={T.white} />
            <Text style={styles.sendBtnText}>Send Announcement</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={announcements}
        renderItem={({ item }) => (
          <AnnouncementCard
            announcement={item}
            canDelete={isOwner}
            onDelete={(announcementId) => handleDelete(announcementId)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon="bullhorn-outline"
            title="No Announcements"
            subtitle="Create your first announcement to get started"
          />
        }
      />

      <Snackbar
        visible={!!snackMessage}
        onDismiss={() => setSnackMessage('')}
        duration={3000}
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
  headerSpacer: { flex: 1 },
  btnPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.soft,
    borderRadius: AppRadius.pill,
    paddingHorizontal: 16,
    height: 44,
    gap: 6,
  },
  cancelBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.inkSoft,
    letterSpacing: -0.1,
  },
  formSection: {
    backgroundColor: T.card,
    marginHorizontal: AppSpace.screen,
    borderRadius: AppRadius.card,
    padding: 20,
    ...appSoftShadow,
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    marginBottom: 14,
    backgroundColor: T.soft,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 0,
  },
  fieldLabel: {
    fontFamily: 'Inter_500Medium',
    fontSize: 13,
    color: T.mute,
    marginBottom: 8,
    marginLeft: 2,
  },
  segmentMargin: {
    marginBottom: 16,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.charcoal,
    borderRadius: AppRadius.pill,
    width: '100%',
    height: 48,
    marginTop: 4,
    gap: 8,
    ...appSoftShadow,
  },
  sendBtnDisabled: {
    opacity: 0.7,
  },
  sendBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: T.white,
    letterSpacing: -0.1,
  },
  list: {
    ...screenChrome.listPad,
    paddingTop: 14,
    flexGrow: 1,
  },
});
