// ============================================================================
// VEBOSSO EMS — Check-In Modal
// ============================================================================

import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Button, HelperText, Modal, Portal, Text } from 'react-native-paper';
import { AppTheme, AppRadius, appShadow, appSoftShadow } from '../constants/theme';
import { PaperOutlinedField } from './PaperOutlinedField';

const MAX_PHOTOS = 3;

interface CheckInModalProps {
  visible: boolean;
  onDismiss: () => void;
  /** Photos are only collected when starting the day, not when editing the plan. */
  onSubmit: (plan: string, photoUris?: string[]) => Promise<void>;
  isLoading?: boolean;
  /** Pre-fill the plan field (used when updating an existing plan) */
  initialPlan?: string;
  /** 'checkin' = start day, 'edit' = update existing plan */
  mode?: 'checkin' | 'edit';
}

export function CheckInModal({
  visible,
  onDismiss,
  onSubmit,
  isLoading,
  initialPlan = '',
  mode = 'checkin',
}: CheckInModalProps) {
  const planRef = useRef('');
  const [charCount, setCharCount] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');
  const isEditMode = mode === 'edit';

  useEffect(() => {
    if (!visible) return;
    const seed = isEditMode ? initialPlan : '';
    planRef.current = seed;
    setCharCount(seed.length);
    setPhotos([]);
    setError('');
  }, [visible, isEditMode, initialPlan]);

  const handleChangeText = useCallback((text: string) => {
    planRef.current = text;
    setCharCount(text.length);
    setError((prev) => (prev ? '' : prev));
  }, []);

  const pickImage = async () => {
    if (photos.length >= MAX_PHOTOS) {
      setError(`You can upload a maximum of ${MAX_PHOTOS} photos`);
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
      if (!result.canceled && result.assets?.[0]) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);
        setError('');
      }
    } catch {
      setError('Failed to pick image');
    }
  };

  const takePhoto = async () => {
    if (photos.length >= MAX_PHOTOS) {
      setError(`You can upload a maximum of ${MAX_PHOTOS} photos`);
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
      if (!result.canceled && result.assets?.[0]) {
        setPhotos((prev) => [...prev, result.assets[0].uri]);
        setError('');
      }
    } catch {
      setError('Failed to capture photo');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setError('');
  };

  const handleSubmit = useCallback(async () => {
    const plan = planRef.current;
    if (!plan.trim()) {
      setError('Please enter your plan for today');
      return;
    }

    setError('');
    await onSubmit(plan.trim().slice(0, 1000), isEditMode ? undefined : photos);
  }, [onSubmit, isEditMode, photos]);

  if (!visible) return null;

  return (
    <Portal>
      <Modal
        visible
        onDismiss={onDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.scroll}
          >
            <View style={styles.header}>
              <View style={styles.iconCircle}>
                <Feather
                  name={isEditMode ? 'edit-3' : 'sunrise'}
                  size={22}
                  color={AppTheme.charcoal}
                />
              </View>
              <Text style={styles.title}>
                {isEditMode ? "Update Today's Plan" : 'Start Your Day'}
              </Text>
              <Text style={styles.subtitle}>
                {isEditMode
                  ? 'Add or revise what you are working on today'
                  : 'What will you work on today?'}
              </Text>
            </View>

            <PaperOutlinedField
              key={isEditMode ? `edit-${initialPlan}` : 'checkin'}
              label="Today's Plan"
              placeholder="Describe what you'll be working on today..."
              defaultValue={isEditMode ? initialPlan : ''}
              onChangeText={handleChangeText}
              multiline
              maxLength={2000}
              editable={!isLoading}
            />

            <View style={styles.charCountRow}>
              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : (
                <Text style={[styles.charCount, charCount > 0 && styles.charCountValid]}>
                  {charCount} / 2000
                </Text>
              )}
            </View>

            {!isEditMode ? (
              <>
                <Text style={styles.sectionTitle}>
                  Attach Photos (Optional, Max {MAX_PHOTOS})
                </Text>
                <View style={styles.photoActions}>
                  <Button
                    mode="contained"
                    onPress={takePhoto}
                    disabled={isLoading || photos.length >= MAX_PHOTOS}
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
                    disabled={isLoading || photos.length >= MAX_PHOTOS}
                    icon="image"
                    style={styles.photoButton}
                    buttonColor={AppTheme.soft}
                    textColor={AppTheme.inkSoft}
                  >
                    Gallery
                  </Button>
                </View>

                {photos.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.previewScroll}
                  >
                    <View style={styles.previewContainer}>
                      {photos.map((uri, index) => (
                        <View key={uri} style={styles.thumbnailWrapper}>
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
                ) : null}
              </>
            ) : null}

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
                {isEditMode ? 'Save Plan' : 'Check In'}
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
  charCountRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
    marginBottom: 8,
    minHeight: 20,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: AppTheme.mute,
  },
  charCountValid: {
    color: AppTheme.green,
  },
  errorText: {
    color: AppTheme.coral,
    fontFamily: 'Inter_500Medium',
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
