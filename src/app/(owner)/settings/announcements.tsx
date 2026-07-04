// ============================================================================
// VEBOSSO EMS — Announcements Management Screen
// ============================================================================

import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View, Platform, Pressable } from 'react-native';
import { Snackbar, Text, TextInput } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
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
  }, [profile, fetchAnnouncements]);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) {
      setSnackMessage('Title and body are required');
      return;
    }
    if (!profile) return;

    setIsLoading(true);
    const result = await createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      target_role: targetRole as any,
      created_by: profile.id,
    });
    setIsLoading(false);

    if (result.success) {
      setSnackMessage('Announcement sent! 📢');
      setTitle('');
      setBody('');
      setShowForm(false);
      fetchAnnouncements(profile.role, profile.id);
    } else {
      setSnackMessage(result.error || 'Failed to send announcement. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
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
        <Text style={styles.title}>Announcements</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          style={({ pressed }) => [
            styles.newBtn,
            pressed && styles.btnPressed,
            showForm && styles.newBtnActive
          ]}
          onPress={() => setShowForm(!showForm)}
        >
          <Feather name={showForm ? 'x' : 'plus'} size={16} color={showForm ? Colors.textPrimary : Colors.white} />
          <Text style={[styles.newBtnText, showForm && styles.newBtnTextActive]}>
            {showForm ? 'Cancel' : 'New'}
          </Text>
        </Pressable>
      </View>

      {showForm && (
        <View style={styles.formSection}>
          <TextInput
            mode="outlined"
            label="Title"
            value={title}
            onChangeText={setTitle}
            maxLength={200}
            style={styles.input}
            outlineColor={Colors.border}
            activeOutlineColor={Colors.textPrimary}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.systemGray6 } }}
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
            outlineColor={Colors.border}
            activeOutlineColor={Colors.textPrimary}
            textColor={Colors.textPrimary}
            outlineStyle={styles.inputOutline}
            theme={{ colors: { onSurfaceVariant: Colors.textTertiary, surface: Colors.systemGray6 } }}
          />

          <Text style={styles.fieldLabel}>Target Audience</Text>
          <View style={styles.segmentedContainer}>
            {[
              { value: 'all', label: 'Everyone' },
              { value: 'manager', label: 'Managers' },
              { value: 'member', label: 'Members' }
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[styles.segmentBtn, targetRole === option.value && styles.segmentBtnActive]}
                onPress={() => setTargetRole(option.value)}
              >
                <Text style={[styles.segmentText, targetRole === option.value && styles.segmentTextActive]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && styles.btnPressed,
              isLoading && { opacity: 0.7 }
            ]}
            onPress={handleSend}
            disabled={isLoading}
          >
            <Feather name="send" size={16} color={Colors.white} />
            <Text style={styles.sendBtnText}>Send Announcement</Text>
          </Pressable>
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

      <Snackbar visible={!!snackMessage} onDismiss={() => setSnackMessage('')} duration={3000} wrapperStyle={{ marginBottom: 90 }}>
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  newBtnActive: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  newBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: Colors.white,
  },
  newBtnTextActive: {
    color: Colors.textPrimary,
  },
  formSection: {
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    ...Colors.shadow,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 3,
    marginTop: 14,
  },
  input: {
    marginBottom: 14,
    backgroundColor: Colors.systemGray6,
    fontSize: 15,
  },
  inputOutline: {
    borderRadius: 14,
    borderWidth: 1,
  },
  fieldLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.systemGray6,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  segmentBtnActive: {
    backgroundColor: Colors.surface,
    ...Colors.shadow,
  },
  segmentText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: Colors.accent,
  },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent, // Solid Black pill
    borderRadius: 24,
    width: '100%',
    height: 48,
    marginTop: 8,
    gap: 8,
  },
  sendBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: Colors.white,
  },
  list: { paddingHorizontal: 20, paddingBottom: 110, paddingTop: 14 },
});
