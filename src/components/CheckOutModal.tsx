// ============================================================================
// VEBOSSO EMS — Check-Out Modal
// ============================================================================

import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Button, HelperText, Modal, Portal, Text, TextInput } from 'react-native-paper';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../constants/colors';

interface CheckOutModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubmit: (report: string, photoUris: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function CheckOutModal({ visible, onDismiss, onSubmit, isLoading }: CheckOutModalProps) {
  const [report, setReport] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [error, setError] = useState('');

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
    if (report.trim().length === 0) {
      setError('Please provide a day report');
      return;
    }
    
    const sanitized = report.trim().slice(0, 1000); // Max 1000 chars
    
    setError('');
    await onSubmit(sanitized, photos);
    setReport('');
    setPhotos([]);
  };

  const handleDismiss = () => {
    setReport('');
    setPhotos([]);
    setError('');
    onDismiss();
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={handleDismiss}
        contentContainerStyle={styles.container}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.scroll}>
            <View style={styles.header}>
              <Text style={styles.emoji}>🌙</Text>
              <Text style={styles.title}>End Your Day</Text>
              <Text style={styles.subtitle}>
                Summarize what you accomplished today
              </Text>
            </View>

            <TextInput
              mode="outlined"
              label="Day Report"
              placeholder="Write a summary of your work today..."
              value={report}
              onChangeText={(text) => {
                setReport(text);
                if (error) setError('');
              }}
              multiline
              numberOfLines={5}
              maxLength={3000}
              style={styles.input}
              outlineColor={Colors.border}
              activeOutlineColor={Colors.accent}
              textColor={Colors.text}
              placeholderTextColor={Colors.placeholder}
              theme={{
                colors: {
                  onSurfaceVariant: Colors.textTertiary,
                  surface: Colors.inputBackground,
                },
              }}
            />

            <View style={styles.charCountRow}>
              {error ? (
                <HelperText type="error" visible={!!error} style={styles.errorText}>
                  {error}
                </HelperText>
              ) : (
                <Text style={styles.charCount}>{report.length} / 3000</Text>
              )}
            </View>

            <Text style={styles.sectionTitle}>Attach Photos (Optional, Max 3)</Text>
            <View style={styles.photoActions}>
              <Button
                mode="outlined"
                onPress={takePhoto}
                disabled={isLoading || photos.length >= 3}
                icon="camera"
                style={[styles.photoButton, { borderColor: Colors.border }]}
                textColor={Colors.textSecondary}
              >
                Camera
              </Button>
              <Button
                mode="outlined"
                onPress={pickImage}
                disabled={isLoading || photos.length >= 3}
                icon="image"
                style={[styles.photoButton, { borderColor: Colors.border }]}
                textColor={Colors.textSecondary}
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
                      >
                        <Feather name="x" size={12} color={Colors.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </ScrollView>
            )}

            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={handleDismiss}
                style={styles.cancelButton}
                textColor={Colors.textSecondary}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={isLoading}
                disabled={isLoading || report.trim().length === 0}
                style={styles.submitButton}
                buttonColor={Colors.accent}
                textColor={Colors.white}
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
    backgroundColor: Colors.surface,
    margin: 20,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
    maxHeight: '90%',
    ...Colors.shadowHeavy,
  },
  scroll: {
    flexGrow: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  emoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_800ExtraBold',
    color: Colors.text,
    marginBottom: 4,
    letterSpacing: -0.7,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  input: {
    backgroundColor: Colors.inputBackground,
    minHeight: 120,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: Colors.error,
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
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textSecondary,
    marginTop: 8,
    marginBottom: 8,
  },
  photoActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  photoButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
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
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    ...Colors.shadow,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    borderColor: Colors.border,
    borderRadius: 12,
  },
  submitButton: {
    borderRadius: 12,
  },
});
