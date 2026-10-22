// ============================================================================
// VEBOSSO EMS — "Report a problem" sheet
// What went wrong, where (optional), up to 3 screenshots. The device and app
// version are added automatically. Goes to the owners (lib/bugReports).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { sendBugReport } from '../lib/bugReports';
import { imageThumb, uploadImage } from '../lib/cloudinary';
import { useAuthStore } from '../store/authStore';
import { CloudImage } from '../types/database';
import { PaperOutlinedField } from './PaperOutlinedField';
import { SheetFrame } from './SheetFrame';

const MAX_SHOTS = 3;

export function BugReportSheet({ onDismiss, onSent }: { onDismiss: () => void; onSent: (message: string) => void }) {
  const profile = useAuthStore((s) => s.profile);
  const [description, setDescription] = useState('');
  const [place, setPlace] = useState('');
  const [shots, setShots] = useState<CloudImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const addShots = async () => {
    setError('');
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return setError('Permission is needed to add screenshots');
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsMultipleSelection: true,
        selectionLimit: MAX_SHOTS - shots.length,
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.length) return;
      setUploading(true);
      for (const a of res.assets.slice(0, MAX_SHOTS - shots.length)) {
        const up = await uploadImage(a.uri, profile?.full_name ?? null);
        if (up.success) setShots((s) => [...s, up.data].slice(0, MAX_SHOTS));
        else setError(up.error);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not add the screenshots');
    } finally {
      setUploading(false);
    }
  };

  const send = async () => {
    if (!profile) return;
    if (!description.trim()) return setError('Write what went wrong');
    setSending(true);
    const res = await sendBugReport({
      description,
      place: place || null,
      screenshots: shots,
      senderId: profile.id,
      senderName: profile.full_name,
    });
    setSending(false);
    if (!res.success) return setError(res.error);
    onSent('Thanks — the problem was reported');
    onDismiss();
  };

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title="Report a problem"
      subtitle="Tell us what went wrong"
      icon="alert-triangle"
      iconColor={T.coral}
      iconBg={T.coralSoft}
      footer={
        <View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.sendBtn, (sending || uploading) && { opacity: 0.6 }]}
            onPress={() => void send()}
            disabled={sending || uploading}
            accessibilityRole="button"
          >
            {sending ? <ActivityIndicator color={T.white} /> : <Text style={styles.sendText}>Send report</Text>}
          </Pressable>
        </View>
      }
    >
      <PaperOutlinedField
        label="What went wrong?"
        value={description}
        onChangeText={(t) => {
          setDescription(t);
          if (error) setError('');
        }}
        multiline
        maxLength={5000}
        placeholder="What did you do, what happened, what did you expect?"
      />
      <PaperOutlinedField
        label="Where in the app? (optional)"
        value={place}
        onChangeText={setPlace}
        maxLength={200}
        placeholder="e.g. Bills, check-in, a venue"
        style={{ marginTop: 10 }}
      />

      <Text style={styles.label}>Screenshots (optional, up to {MAX_SHOTS})</Text>
      <View style={styles.shots}>
        {shots.map((img) => (
          <View key={img.public_id}>
            <Image source={{ uri: imageThumb(img) }} style={styles.thumb} contentFit="cover" />
            <Pressable
              style={styles.thumbX}
              onPress={() => setShots((s) => s.filter((x) => x.public_id !== img.public_id))}
              hitSlop={6}
              accessibilityLabel="Remove screenshot"
            >
              <Feather name="x" size={12} color={T.white} />
            </Pressable>
          </View>
        ))}
        {shots.length < MAX_SHOTS ? (
          <Pressable style={[styles.thumb, styles.addTile]} onPress={() => void addShots()} disabled={uploading} accessibilityLabel="Add screenshots">
            {uploading ? <ActivityIndicator color={T.inkSoft} /> : <Feather name="plus" size={20} color={T.inkSoft} />}
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.note}>Your phone model and app version are added automatically.</Text>
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft, marginTop: 16, marginBottom: 8 },
  shots: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  thumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: T.soft2 },
  thumbX: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: T.soft2, borderStyle: 'dashed', backgroundColor: T.card },
  note: { fontFamily: 'Inter_400Regular', fontSize: 12.5, color: T.mute, marginTop: 14 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginBottom: 8 },
  sendBtn: { height: 48, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  sendText: { fontFamily: 'Inter_600SemiBold', fontSize: 15, color: T.white },
});
