// ============================================================================
// VEBOSSO EMS — Bill video thumbnails
// A bill's videos as a row of thumbnails: tap one to play it. Remove (X, while
// editing) and Send (WhatsApp, on the saved bill) sit on each thumbnail.
// ============================================================================

import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { videoLength, videoThumb } from '../lib/cloudinary';
import { BillVideo } from '../types/database';

export function BillVideoStrip({
  videos,
  onPlay,
  onRemove,
  onSend,
  sendingId,
}: {
  videos: BillVideo[];
  onPlay: (v: BillVideo) => void;
  onRemove?: (v: BillVideo) => void;
  onSend?: (v: BillVideo) => void;
  /** public_id of the video being sent right now. */
  sendingId?: string | null;
}) {
  return (
    <>
      {videos.map((v) => (
        <View key={v.public_id}>
          <Pressable onPress={() => onPlay(v)} accessibilityLabel="Play video">
            <Image source={{ uri: videoThumb(v) }} style={styles.thumb} contentFit="cover" />
            <View style={styles.playWrap} pointerEvents="none">
              <View style={styles.play}>
                <Feather name="play" size={16} color={T.white} />
              </View>
            </View>
            {videoLength(v.duration) ? (
              <View style={styles.len} pointerEvents="none">
                <Text style={styles.lenText}>{videoLength(v.duration)}</Text>
              </View>
            ) : null}
          </Pressable>
          {onRemove ? (
            <Pressable style={styles.x} onPress={() => onRemove(v)} hitSlop={6} accessibilityLabel="Remove video">
              <Feather name="x" size={12} color={T.white} />
            </Pressable>
          ) : null}
          {onSend ? (
            <Pressable
              style={styles.send}
              onPress={() => onSend(v)}
              disabled={!!sendingId}
              hitSlop={6}
              accessibilityLabel="Send video on WhatsApp"
            >
              {sendingId === v.public_id ? (
                <ActivityIndicator size="small" color={T.white} />
              ) : (
                <Feather name="send" size={13} color={T.white} />
              )}
            </Pressable>
          ) : null}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 76, height: 76, borderRadius: 12, backgroundColor: T.soft2 },
  playWrap: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  len: {
    position: 'absolute',
    left: 4,
    bottom: 4,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  lenText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: T.white },
  x: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: T.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  send: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: T.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
