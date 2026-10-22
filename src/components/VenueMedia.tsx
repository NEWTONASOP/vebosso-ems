// ============================================================================
// VEBOSSO EMS — A venue's photos and its "in business" permission (065)
// Shown inside the venue's detail sheet:
//   • Permission from the venue — the message / email they sent, pasted in,
//     plus screenshots of it. Shown once the venue is in business (or already
//     has proof).
//   • Photos — pictures from the venue.
// Pictures go to Cloudinary (lib/cloudinary); the venue keeps their links.
// Everyone who can see the venue sees these; adding, changing and removing
// need edit rights on the venue (`canEdit`, and the database checks it too).
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import { imageThumb, uploadImage } from '../lib/cloudinary';
import { addVenueImages, removeVenueImage, setBusinessProof } from '../lib/venues';
import { useAuthStore } from '../store/authStore';
import { CloudImage, Venue } from '../types/database';
import { ImageViewerModal } from './ImageViewerModal';
import { PaperOutlinedField } from './PaperOutlinedField';

type Field = 'photos' | 'business_proof_images';

export function VenueMedia({
  venue,
  canEdit,
  onChanged,
}: {
  venue: Venue;
  canEdit: boolean;
  /** The venue as saved, after any change here. */
  onChanged: (v: Venue) => void;
}) {
  const myName = useAuthStore((s) => s.profile?.full_name ?? null);
  const photos = venue.photos ?? [];
  const proofImages = venue.business_proof_images ?? [];
  const proof = venue.business_proof ?? '';

  const [busy, setBusy] = useState<{ field: Field; text: string } | null>(null);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState<string | null>(null);
  // The permission text being edited; null when not editing.
  const [draft, setDraft] = useState<string | null>(null);
  const [savingText, setSavingText] = useState(false);

  const showProof = venue.in_business || !!proof || proofImages.length > 0;

  const add = async (field: Field, source: 'library' | 'camera') => {
    setError('');
    try {
      const perm =
        source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') return setError('Permission is needed to add pictures');
      const res =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
          : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsMultipleSelection: true, quality: 0.8 });
      if (res.canceled || !res.assets?.length) return;

      const added: CloudImage[] = [];
      for (let i = 0; i < res.assets.length; i++) {
        setBusy({ field, text: res.assets.length > 1 ? `Uploading ${i + 1} of ${res.assets.length}…` : 'Uploading…' });
        const up = await uploadImage(res.assets[i].uri, myName);
        if (up.success) added.push(up.data);
        else setError(up.error);
      }
      if (added.length) {
        setBusy({ field, text: 'Saving…' });
        const saved = await addVenueImages(venue.id, field, added);
        if (saved.success) onChanged(saved.data);
        else setError(saved.error);
      }
    } catch (e: any) {
      setError(e?.message || 'Could not add the pictures');
    } finally {
      setBusy(null);
    }
  };

  /** Phone: camera or gallery. Web: the file picker only. */
  const chooseSource = (field: Field) => {
    if (Platform.OS === 'web') return void add(field, 'library');
    Alert.alert('Add pictures', undefined, [
      { text: 'Take a photo', onPress: () => void add(field, 'camera') },
      { text: 'Choose from gallery', onPress: () => void add(field, 'library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const remove = (field: Field, img: CloudImage) =>
    Alert.alert('Remove this picture?', 'It comes off this venue.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const res = await removeVenueImage(venue.id, field, img.public_id);
          if (res.success) onChanged(res.data);
          else setError(res.error);
        },
      },
    ]);

  const saveText = async () => {
    if (draft === null) return;
    setSavingText(true);
    const res = await setBusinessProof(venue.id, draft);
    setSavingText(false);
    if (!res.success) return setError(res.error);
    onChanged(res.data);
    setDraft(null);
  };

  const strip = (field: Field, list: CloudImage[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {list.map((img) => (
        <View key={img.public_id}>
          <Pressable onPress={() => setViewing(img.url)} accessibilityRole="imagebutton" accessibilityLabel="Open picture">
            <Image source={{ uri: imageThumb(img) }} style={styles.thumb} contentFit="cover" />
          </Pressable>
          {canEdit ? (
            <Pressable style={styles.thumbX} onPress={() => remove(field, img)} hitSlop={6} accessibilityLabel="Remove picture">
              <Feather name="x" size={12} color={T.white} />
            </Pressable>
          ) : null}
        </View>
      ))}
      {canEdit ? (
        <Pressable
          style={[styles.thumb, styles.addTile]}
          onPress={() => chooseSource(field)}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Add pictures"
        >
          {busy?.field === field ? <ActivityIndicator color={T.inkSoft} /> : <Feather name="plus" size={20} color={T.inkSoft} />}
        </Pressable>
      ) : null}
    </ScrollView>
  );

  return (
    <View>
      {showProof ? (
        <View style={styles.block}>
          <View style={styles.head}>
            <Feather name="shield" size={14} color={T.green} />
            <Text style={styles.title}>Permission from the venue</Text>
            {canEdit && draft === null ? (
              <Pressable onPress={() => setDraft(proof)} hitSlop={8} accessibilityLabel="Edit permission message">
                <Text style={styles.action}>{proof ? 'Edit' : 'Add'}</Text>
              </Pressable>
            ) : null}
          </View>

          {draft !== null ? (
            <>
              <PaperOutlinedField
                label="Paste the message or email"
                value={draft}
                onChangeText={setDraft}
                multiline
                maxLength={10000}
                style={{ marginTop: 8 }}
              />
              <View style={styles.btns}>
                <Pressable onPress={() => setDraft(null)} hitSlop={6}>
                  <Text style={styles.cancel}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.save} onPress={() => void saveText()} disabled={savingText}>
                  {savingText ? <ActivityIndicator color={T.white} size="small" /> : <Text style={styles.saveText}>Save</Text>}
                </Pressable>
              </View>
            </>
          ) : proof ? (
            <Text style={styles.proofText} selectable>
              {proof}
            </Text>
          ) : (
            <Text style={styles.empty}>
              {canEdit ? 'Paste the permission message or email they sent, and add screenshots.' : 'No permission message saved yet.'}
            </Text>
          )}

          {proofImages.length || canEdit ? (
            <>
              <Text style={styles.sub}>Screenshots{proofImages.length ? ` · ${proofImages.length}` : ''}</Text>
              {strip('business_proof_images', proofImages)}
            </>
          ) : null}
          {busy?.field === 'business_proof_images' ? <Text style={styles.busy}>{busy.text}</Text> : null}
        </View>
      ) : null}

      {photos.length || canEdit ? (
        <View style={styles.block}>
          <View style={styles.head}>
            <Feather name="image" size={14} color={T.blue} />
            <Text style={styles.title}>Photos{photos.length ? ` · ${photos.length}` : ''}</Text>
          </View>
          {photos.length === 0 && !canEdit ? <Text style={styles.empty}>No photos yet.</Text> : strip('photos', photos)}
          {busy?.field === 'photos' ? <Text style={styles.busy}>{busy.text}</Text> : null}
          {photos.length ? (
            <Text style={styles.meta}>
              Last added {photos[photos.length - 1].added_by_name ? `by ${photos[photos.length - 1].added_by_name} ` : ''}
              on {format(new Date(photos[photos.length - 1].added_at), 'd MMM yyyy')}
            </Text>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <ImageViewerModal uri={viewing} onDismiss={() => setViewing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: T.soft },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 13, color: T.ink },
  action: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.blue },
  sub: { fontFamily: 'Inter_600SemiBold', fontSize: 12, color: T.mute, marginTop: 10 },
  proofText: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.ink, lineHeight: 20, marginTop: 6 },
  empty: { fontFamily: 'Inter_400Regular', fontSize: 13, color: T.inkSoft, marginTop: 6 },
  meta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 6 },
  busy: { fontFamily: 'Inter_500Medium', fontSize: 12.5, color: T.inkSoft, marginTop: 6 },
  strip: { gap: 8, paddingTop: 8 },
  thumb: { width: 76, height: 76, borderRadius: 10, backgroundColor: T.soft2 },
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
  btns: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 8 },
  cancel: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.inkSoft },
  save: { height: 34, minWidth: 70, paddingHorizontal: 16, borderRadius: 999, backgroundColor: T.charcoal, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.white },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginTop: 8 },
});
