// ============================================================================
// VEBOSSO EMS — One bill photo, opened from the photo grid
// The photo big, with the line shown under it on the bill, and Crop.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { AppTheme as T, appSoftShadow } from '../constants/theme';
import { imageSource } from '../lib/imageSource';
import { useDialogLift } from '../lib/useKeyboardHeight';
import { SmoothTextInput as TextInput } from './SmoothTextInput';

export function BillImageEditor({
  uri,
  caption,
  onCaption,
  onCrop,
  onDismiss,
  cropDisabled,
}: {
  /** The photo open; null closes the popup. */
  uri: string | null;
  caption: string;
  onCaption: (text: string) => void;
  onCrop: () => void;
  onDismiss: () => void;
  cropDisabled?: boolean;
}) {
  const lifted = useDialogLift();
  const { height } = useWindowDimensions();

  return (
    <Portal>
      <Modal visible={!!uri} onDismiss={onDismiss} contentContainerStyle={[styles.container, lifted]}>
        {uri ? (
          <>
            <Image
              source={imageSource(uri)}
              style={[styles.photo, { height: Math.min(380, Math.round(height * 0.42)) }]}
              contentFit="contain"
            />
            <Text style={styles.label}>Shown under the photo on the bill</Text>
            <TextInput
              value={caption}
              onChangeText={onCaption}
              placeholder="What's in this photo?"
              placeholderTextColor={T.mute}
              style={styles.input}
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <View style={styles.row}>
              <Pressable
                style={[styles.btn, styles.btnSoft, cropDisabled && { opacity: 0.5 }]}
                onPress={onCrop}
                disabled={cropDisabled}
                accessibilityRole="button"
                accessibilityLabel="Crop photo"
              >
                <Feather name="crop" size={16} color={T.ink} />
                <Text style={styles.btnSoftText}>Crop</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDark]} onPress={onDismiss} accessibilityRole="button">
                <Text style={styles.btnDarkText}>Done</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: T.card,
    margin: 20,
    borderRadius: 24,
    padding: 16,
    ...appSoftShadow,
  },
  photo: { width: '100%', borderRadius: 14, backgroundColor: T.soft },
  label: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, color: T.inkSoft, marginTop: 14, marginBottom: 6 },
  input: {
    minHeight: 64,
    maxHeight: 140,
    borderRadius: 14,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontFamily: 'Inter_500Medium',
    fontSize: 14,
    color: T.ink,
  },
  row: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: {
    flex: 1,
    height: 46,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSoft: { backgroundColor: T.soft },
  btnSoftText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.ink },
  btnDark: { backgroundColor: T.charcoal },
  btnDarkText: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.white },
});
