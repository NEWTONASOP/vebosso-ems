// ============================================================================
// VEBOSSO EMS — Profile Photo Editor
// The signed-in person's avatar with a camera badge. Tap to take or choose a
// photo (cropped square); "Remove photo" goes back to initials.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { Alert } from '../lib/alert';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import { uploadCheckoutPhoto } from '../store/workStore';
import { UserAvatar } from './UserAvatar';

const BUCKET = 'avatars';

/** "…/storage/v1/object/public/avatars/<uid>/<file>" → "<uid>/<file>" */
function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = `/${BUCKET}/`;
  const i = url.indexOf(marker);
  return i === -1 ? null : url.slice(i + marker.length).split('?')[0];
}

interface ProfilePhotoEditorProps {
  size?: number;
  /** Initials colours when there's no photo. */
  color?: string;
  bg?: string;
  onMessage?: (message: string) => void;
}

export function ProfilePhotoEditor({
  size = 72,
  color = T.charcoal,
  bg = T.soft,
  onMessage,
}: ProfilePhotoEditorProps) {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [busy, setBusy] = useState(false);

  if (!profile) return null;

  const notify = (m: string) => (onMessage ? onMessage(m) : Alert.alert(m));

  const savePhoto = async (uri: string) => {
    setBusy(true);
    try {
      const path = `${profile.id}/${Date.now()}.jpg`;
      await uploadCheckoutPhoto(path, uri, 'jpg', BUCKET, false);
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const oldPath = pathFromUrl(profile.avatar_url);
      const res = await updateProfile({ avatar_url: data.publicUrl });
      if (!res.success) {
        await supabase.storage.from(BUCKET).remove([path]);
        notify(res.error || 'Could not save your photo');
        return;
      }
      if (oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
      notify('Profile photo updated');
    } catch (err: any) {
      notify(err?.message || 'Could not upload your photo');
    } finally {
      setBusy(false);
    }
  };

  const pick = async (source: 'library' | 'camera') => {
    try {
      const perm =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') {
        notify(source === 'camera' ? 'Camera permission is needed' : 'Photo permission is needed');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
      };
      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled && result.assets?.[0]) {
        await savePhoto(result.assets[0].uri);
      }
    } catch {
      notify('Could not open the picker');
    }
  };

  const handlePress = () => {
    if (busy) return;
    // Web has no camera sheet worth offering; go straight to the file picker.
    if (Platform.OS === 'web') {
      void pick('library');
      return;
    }
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => void pick('camera') },
      { text: 'Choose from photos', onPress: () => void pick('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleRemove = () => {
    Alert.alert('Remove photo?', 'Your initials will show instead.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          const oldPath = pathFromUrl(profile.avatar_url);
          const res = await updateProfile({ avatar_url: null });
          if (res.success && oldPath) await supabase.storage.from(BUCKET).remove([oldPath]);
          setBusy(false);
          if (!res.success) notify(res.error || 'Could not remove your photo');
        },
      },
    ]);
  };

  const badge = Math.max(24, Math.round(size * 0.34));

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={profile.avatar_url ? 'Change profile photo' : 'Add profile photo'}
        style={({ pressed }) => pressed && { opacity: 0.85 }}
      >
        <UserAvatar
          uri={profile.avatar_url}
          size={size}
          label={profile.full_name.substring(0, 2).toUpperCase()}
          style={{ backgroundColor: bg }}
          labelStyle={{ color, fontFamily: 'Inter_700Bold', fontSize: Math.round(size * 0.34) }}
        />
        {busy ? (
          <View style={[styles.busy, { width: size, height: size, borderRadius: size / 2 }]}>
            <ActivityIndicator color={T.white} />
          </View>
        ) : null}
        <View
          style={[
            styles.badge,
            { width: badge, height: badge, borderRadius: badge / 2 },
          ]}
        >
          <Feather name="camera" size={Math.round(badge * 0.5)} color={T.white} />
        </View>
      </Pressable>
      {profile.avatar_url && !busy ? (
        <Pressable onPress={handleRemove} hitSlop={8} accessibilityRole="button">
          <Text style={styles.remove}>Remove photo</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 6,
  },
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    backgroundColor: T.charcoal,
    borderWidth: 2,
    borderColor: T.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remove: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    color: T.mute,
  },
});
