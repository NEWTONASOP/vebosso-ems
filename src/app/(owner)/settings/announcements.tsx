// ============================================================================
// VEBOSSO EMS — Announcements Management Screen
// ============================================================================

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, IconButton, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';
import { AnnouncementCard } from '../../../components/AnnouncementCard';
import { EmptyState } from '../../../components/EmptyState';
import { Colors } from '../../../constants/colors';
import { useAuthStore } from '../../../store/authStore';
import { useWorkStore } from '../../../store/workStore';

export default function AnnouncementsScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { announcements, fetchAnnouncements, createAnnouncement } = useWorkStore();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetRole, setTargetRole] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [snackMessage, setSnackMessage] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (profile) {
      fetchAnnouncements(profile.role, profile.id);
    }
  }, [profile]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setSnackMessage('Title and body are required');
      return;
    }
    if (!profile) return;

    setIsLoading(true);
    try {
      await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        target_role: targetRole as any,
        created_by: profile.id,
      });
      setSnackMessage('Announcement sent! 📢');
      setTitle('');
      setBody('');
      setShowForm(false);
      fetchAnnouncements(profile.role, profile.id);
    } catch (e) {
      setSnackMessage('Failed to send announcement');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <IconButton icon="arrow-left" iconColor={Colors.text} size={24} onPress={() => router.back()} />
        <Text style={styles.title}>Announcements</Text>
        <View style={{ flex: 1 }} />
        <Button
          mode="contained"
          onPress={() => setShowForm(!showForm)}
          compact
          buttonColor={Colors.accent}
          textColor={Colors.white}
          icon={showForm ? 'close' : 'plus'}
          style={styles.newButton}
        >
          {showForm ? 'Cancel' : 'New'}
        </Button>
      </View>

      {showForm && (
        <View style={styles.formSection}>
          <TextInput
            mode="outlined"
            label="Title"
            value={title}
            onChangeText={setTitle}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.inputBackground } }}
          />
          <TextInput
            mode="outlined"
            label="Message"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={3}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.accent}
            textColor={Colors.text}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.inputBackground } }}
          />

          <Text style={styles.fieldLabel}>Target Audience</Text>
          <SegmentedButtons
            value={targetRole}
            onValueChange={setTargetRole}
            buttons={[
              { value: 'all', label: 'Everyone' },
              { value: 'manager', label: 'Managers' },
              { value: 'member', label: 'Members' },
            ]}
            style={styles.segmented}
          />

          <Button
            mode="contained"
            onPress={handleSend}
            loading={isLoading}
            disabled={isLoading}
            buttonColor={Colors.accent}
            textColor={Colors.white}
            style={styles.sendButton}
            icon="send"
          >
            Send Announcement
          </Button>
        </View>
      )}

      <FlatList
        data={announcements}
        renderItem={({ item }) => <AnnouncementCard announcement={item} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState icon="bullhorn-outline" title="No Announcements" subtitle="Create your first announcement to get started" />
        }
      />

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000}>
        {snackMessage}
      </Snackbar>
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
  title: { fontFamily: 'Inter_800ExtraBold', fontSize: 28, color: Colors.text, letterSpacing: -0.7 },
  newButton: { borderRadius: 10 },
  formSection: {
    backgroundColor: Colors.surface,
    margin: 16,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Colors.shadow,
  },
  input: { marginBottom: 12, backgroundColor: Colors.inputBackground },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  segmented: { marginBottom: 14 },
  sendButton: { borderRadius: 10, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
});
