// ============================================================================
// VEBOSSO EMS — Video popup
// A bill video played big over whatever is behind it. Tap the X or the dark
// area to close.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { useEvent } from 'expo';
import { VideoView, useVideoPlayer } from 'expo-video';
import { ActivityIndicator, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Modal, Portal, Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';

function Player({ uri }: { uri: string }) {
  const { height } = useWindowDimensions();
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });
  // Say what is happening: a spinner while it loads, a message if it can't play.
  const { status, error } = useEvent(player, 'statusChange', { status: player.status });
  return (
    <View>
      <VideoView
        player={player}
        style={[styles.video, { height: Math.round(height * 0.6) }]}
        contentFit="contain"
        nativeControls
        // Android's default surface can stay black inside a popup.
        surfaceType={Platform.OS === 'android' ? 'textureView' : undefined}
      />
      {status === 'loading' ? (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator color={T.white} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.overlay} pointerEvents="none">
          <Text style={styles.errorText}>
            {"This video can't play here."}
            {error?.message ? `
${error.message}` : ''}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function VideoPlayerModal({
  uri,
  title,
  onDismiss,
}: {
  /** Shown while set; null closes it. */
  uri: string | null;
  title?: string;
  onDismiss: () => void;
}) {
  return (
    <Portal>
      <Modal visible={!!uri} onDismiss={onDismiss} contentContainerStyle={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title} numberOfLines={1}>{title ?? ''}</Text>
          <Pressable style={styles.close} onPress={onDismiss} hitSlop={8} accessibilityLabel="Close video">
            <Feather name="x" size={18} color={T.white} />
          </Pressable>
        </View>
        {uri ? <Player uri={uri} /> : null}
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    borderRadius: 20,
    backgroundColor: T.charcoalDeep,
    padding: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10, paddingLeft: 4 },
  title: { flex: 1, fontFamily: 'Inter_600SemiBold', fontSize: 14, color: T.white },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  video: { width: '100%', borderRadius: 12, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 20 },
  errorText: { fontFamily: 'Inter_500Medium', fontSize: 13, color: T.white, textAlign: 'center' },
});
