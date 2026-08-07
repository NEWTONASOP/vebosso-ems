// ============================================================================
// VEBOSSO EMS — Check-Out Modal
// ============================================================================

import { useCallback, useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AppTheme, AppRadius, appShadow, appSoftShadow } from '../constants/theme';
import { PaperOutlinedField } from './PaperOutlinedField';

interface CheckOutModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (report: string, photoUris: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function CheckOutModal({ visible, onDismiss, onSubmit, isLoading }: CheckOutModalProps) {
  const reportRef = useRef('');
  const [charCount, setCharCount] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');

  const handleChangeReport = useCallback((text: string) => {
    reportRef.current = text;
    setCharCount(text.length);
    setError((prev) => (prev ? '' : prev));
  }, []);

  const pickImage = async () => {
    if (photos.length >= 3) {
      setError('You can upload a maximum of 3 photos');
      return;
    }
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access library is required!');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos([...photos, result.assets[0].uri]);
        if (error) setError('');
      }
    } catch (err: any) {
      setError('Failed to pick image');
    }
  };

  const takePhoto = async () => {
    if (photos.length >= 3) {
      setError('You can upload a maximum of 3 photos');
      return;
    }
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setError('Permission to access camera is required!');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setPhotos([...photos, result.assets[0].uri]);
        if (error) setError('');
      }
    } catch (err: any) {
      setError('Failed to capture photo');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
    if (error) setError('');
  };

  const handleSubmit = async () => {
    const report = reportRef.current;
    if (!report.trim()) {
      setError('Please provide a day report');
      return;
    }

    setError('');
    await onSubmit(report.trim().slice(0, 1000), photos);
  };

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Feather name="moon" size={22} color={AppTheme.charcoal} />
              </View>
              <Text style={styles.title}>End Your Day</Text>
              <Text style={styles.subtitle}>
                Summarize what you accomplished today
              </Text>
            </View>

            <PaperOutlinedField
              label="Day Report"
              placeholder="Write a summary of your work today..."
              defaultValue=""
              onChangeText={handleChangeReport}
              multiline
              maxLength={3000}
              editable={!isLoading}
            />

            <View style={styles.charCountRow}>
              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : (
                <Text style={styles.charCount}>{charCount} / 3000</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Attach Photos (Optional, Max 3)</Text>
            <View style={styles.photoActions}>
              <Button
                mode="contained"
                onPress={takePhoto}
                disabled={isLoading || photos.length >= 3}
                icon="camera"
                style={styles.photoButton}
                buttonColor={AppTheme.soft}
                textColor={AppTheme.inkSoft}
              >
                Camera
              </Button>
              <Button
                mode="contained"
                onPress={pickImage}
                disabled={isLoading || photos.length >= 3}
                icon="image"
                style={styles.photoButton}
                buttonColor={AppTheme.soft}
                textColor={AppTheme.inkSoft}
              >
                Gallery
              </Button>
            </View>

            {photos.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
                <View style={styles.previewContainer}>
                  {photos.map((uri, index) => (
                    <View key={index} style={styles.thumbnailWrapper}>
                      <Image source={{ uri }} style={styles.thumbnail} />
                      <TouchableOpacity
                        style={styles.removeBadge}
                        onPress={() => removePhoto(index)}
                        disabled={isLoading}
                        accessibilityLabel="Remove photo"
                      >
                        <Feather name="x" size={12} color={AppTheme.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            <View style={styles.actions}>
              <Button
                mode="contained"
                onPress={onDismiss}
                style={styles.cancelButton}
                buttonColor={AppTheme.soft2}
                textColor={AppTheme.inkSoft}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={isLoading}
                disabled={isLoading}
                style={styles.submitButton}
                buttonColor={AppTheme.charcoal}
                textColor={AppTheme.white}
              >
                End Day
              </Button>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: AppTheme.card,
    margin: 20,
    borderRadius: AppRadius.sheet,
    padding: 24,
    maxHeight: '90%',
    ...appShadow,
  },
  scroll: {
    flexGrow: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: AppTheme.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    ...appSoftShadow,
  },
  title: {
    fontSize: 20,
    fontFamily: 'Inter_700Bold',
    color: AppTheme.ink,
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
    textAlign: 'center',
  },
  errorText: {
    color: AppTheme.coral,
    fontFamily: 'Inter_500Medium',
  },
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: AppTheme.ink,
    marginTop: 8,
    marginBottom: 10,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  photoButton: {
    flex: 1,
    borderRadius: 24,
    ...appSoftShadow,
  },
  previewScroll: {
    maxHeight: 90,
    marginBottom: 12,
  },
  previewContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 4,
  },
  thumbnailWrapper: {
    position: 'relative',
    width: 80,
    height: 80,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: AppRadius.chip,
    backgroundColor: AppTheme.soft,
  },
  removeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: AppTheme.coral,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...appSoftShadow,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    borderRadius: 24,
    ...appSoftShadow,
  },
  submitButton: {
    borderRadius: 24,
    ...appSoftShadow,
  },
});
