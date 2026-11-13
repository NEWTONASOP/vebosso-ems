// ============================================================================
// VEBOSSO EMS — Attachments of one check-in / check-out
// Just the photos and files, opened from the "2 photos · 1 file" chip on the
// attendance timeline. Tap a photo to see it big, a file to open it.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { fetchWorkLogFiles, openDocumentFile, signDocumentUrls } from '../lib/employeeRecords';
import { imageSource } from '../lib/imageSource';
import { supabase } from '../lib/supabase';
import { EmployeeDocument } from '../types/database';
import { ImageViewerModal } from './ImageViewerModal';
import { SheetFrame } from './SheetFrame';

export function WorkLogAttachmentsSheet({
  workLogId,
  phase,
  photoPaths,
  subtitle,
  onDismiss,
}: {
  workLogId: string;
  phase: 'check_in' | 'check_out';
  photoPaths: string[];
  subtitle?: string;
  onDismiss: () => void;
}) {
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<EmployeeDocument[]>([]);
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [enlarged, setEnlarged] = useState<string | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const photoKey = photoPaths.join('|');

  useEffect(() => {
    let active = true;
    void (async () => {
      const [signedPhotos, docs] = await Promise.all([
        photoKey
          ? supabase.storage.from('checkouts').createSignedUrls(photoKey.split('|'), 3600).then(({ data }) => data ?? [])
          : Promise.resolve([]),
        fetchWorkLogFiles(workLogId).then((all) =>
          all.filter((d) => (phase === 'check_out' ? d.work_phase === 'check_out' : d.work_phase !== 'check_out')),
        ),
      ]);
      const signedFiles = await signDocumentUrls(docs.map((d) => d.file_path));
      if (!active) return;
      const map: Record<string, string> = {};
      for (const item of signedPhotos) if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
      setPhotoUrls(map);
      setFiles(docs);
      setFileUrls(signedFiles);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [workLogId, phase, photoKey]);

  const openFile = async (d: EmployeeDocument) => {
    const url = fileUrls[d.file_path];
    if (!url) return setError('Could not load this file');
    setError('');
    setOpening(d.id);
    const res = await openDocumentFile(d, url);
    setOpening(null);
    if (!res.success) setError(res.error);
  };

  const photos = photoPaths.filter((p) => photoUrls[p]);

  return (
    <SheetFrame
      visible
      onDismiss={onDismiss}
      title={phase === 'check_out' ? 'Checkout attachments' : 'Check-in attachments'}
      subtitle={subtitle}
      icon="paperclip"
      iconColor={T.blue}
      iconBg={T.blueSoft}
    >
      <ImageViewerModal uri={enlarged ? photoUrls[enlarged] ?? null : null} onDismiss={() => setEnlarged(null)} />
      {loading ? (
        <ActivityIndicator color={T.charcoal} style={{ marginVertical: 24 }} />
      ) : (
        <>
          {photos.length ? (
            <View style={styles.photos}>
              {photos.map((path) => (
                <Pressable key={path} onPress={() => setEnlarged(path)} accessibilityRole="button" accessibilityLabel="Photo">
                  <Image source={imageSource(photoUrls[path])} style={styles.photo} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          ) : null}
          {files.map((d) => (
            <Pressable
              key={d.id}
              style={({ pressed }) => [styles.file, pressed && { opacity: 0.85 }]}
              onPress={() => void openFile(d)}
              disabled={opening === d.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${d.name}`}
            >
              <Feather name="file-text" size={16} color={T.inkSoft} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fileName} numberOfLines={1}>
                  {d.name}
                </Text>
                <Text style={styles.fileMeta}>tap to open</Text>
              </View>
              {opening === d.id ? <ActivityIndicator size="small" color={T.charcoal} /> : null}
            </Pressable>
          ))}
          {!photos.length && !files.length ? <Text style={styles.none}>Nothing attached.</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </SheetFrame>
  );
}

const styles = StyleSheet.create({
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  photo: { width: 96, height: 96, borderRadius: 12, backgroundColor: T.soft },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  fileName: { fontFamily: 'Inter_600SemiBold', fontSize: 13.5, color: T.ink },
  fileMeta: { fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute, marginTop: 1 },
  none: { fontFamily: 'Inter_400Regular', fontSize: 14, color: T.mute, marginVertical: 12 },
  error: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.coral, marginTop: 6 },
});
