// ============================================================================
// VEBOSSO EMS — Voice notes: record and play
//   useVoiceRecorder — start / stop / cancel a recording (asks for the mic)
//   RecordingBar     — shown in place of a message box while recording
//   VoiceNote        — plays a stored voice note (signs its own link)
// ============================================================================

import { Feather } from '@expo/vector-icons';
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { AppTheme as T } from '../constants/theme';
import { clipTime, signVoiceNote, VOICE_MAX_MS, VOICE_RECORDING, VoiceClip } from '../lib/voice';

// ----------------------------------------------------------------------------

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(VOICE_RECORDING);
  const state = useAudioRecorderState(recorder, 200);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState('');
  const limitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLimit = () => {
    if (limitTimer.current) clearTimeout(limitTimer.current);
    limitTimer.current = null;
  };

  // Don't leave the timer running if the screen closes mid-recording.
  useEffect(() => clearLimit, []);

  /** @param onLimit called when the recording reaches VOICE_MAX_MS. */
  const start = async (onLimit?: () => void) => {
    setError('');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Allow the microphone to record a voice message');
        return false;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecording(true);
      clearLimit();
      if (onLimit) limitTimer.current = setTimeout(onLimit, VOICE_MAX_MS);
      return true;
    } catch {
      setError('Could not start recording');
      return false;
    }
  };

  /** Stops and returns the clip (null if it was too short to keep). */
  const stop = async (): Promise<VoiceClip | null> => {
    clearLimit();
    // Read the recorder itself: this may run from the limit timer, where the
    // last rendered state is stale.
    let durationMs = 0;
    try {
      durationMs = recorder.getStatus().durationMillis;
    } catch {
      durationMs = state.durationMillis;
    }
    try {
      await recorder.stop();
    } catch {
      // already stopped
    }
    setRecording(false);
    await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    const uri = recorder.uri;
    return uri && durationMs >= 700 ? { uri, durationMs } : null;
  };

  return {
    recording,
    durationMs: state.durationMillis,
    error,
    start,
    stop,
    cancel: async () => {
      await stop();
    },
  };
}

// ----------------------------------------------------------------------------

/** In place of the message box while recording: time, cancel, send. */
export function RecordingBar({
  durationMs,
  sending,
  onCancel,
  onSend,
}: {
  durationMs: number;
  sending?: boolean;
  onCancel: () => void;
  onSend: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable style={styles.barCancel} onPress={onCancel} disabled={sending} accessibilityLabel="Discard recording">
        <Feather name="trash-2" size={17} color={T.coral} />
      </Pressable>
      <View style={styles.barMiddle}>
        <View style={styles.redDot} />
        <Text style={styles.barTime}>{clipTime(durationMs)}</Text>
        <Text style={styles.barHint} numberOfLines={1}>
          {sending ? 'Sending…' : `Recording · up to ${clipTime(VOICE_MAX_MS)}`}
        </Text>
      </View>
      <Pressable style={styles.barSend} onPress={onSend} disabled={sending} accessibilityLabel="Send voice message">
        {sending ? <ActivityIndicator size="small" color={T.white} /> : <Feather name="send" size={17} color={T.white} />}
      </Pressable>
    </View>
  );
}

// ----------------------------------------------------------------------------

/** Plays a stored voice note. `dark` for use on a dark background. */
export function VoiceNote({ path, durationMs, dark }: { path: string; durationMs?: number | null; dark?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    signVoiceNote(path).then((u) => {
      if (!active) return;
      if (u) setUrl(u);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [path]);

  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);

  // Back to the start once it has played through.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [status.didJustFinish, player]);

  const totalMs = status.duration > 0 ? status.duration * 1000 : durationMs ?? 0;
  const progress = totalMs ? Math.min(1, (status.currentTime * 1000) / totalMs) : 0;
  const ready = !!url && status.isLoaded;
  const ink = dark ? T.white : T.ink;
  const track = dark ? 'rgba(255,255,255,0.3)' : T.soft2;

  const toggle = () => {
    if (!ready) return;
    if (status.playing) player.pause();
    else player.play();
  };

  return (
    <View style={styles.note}>
      <Pressable
        onPress={toggle}
        style={[styles.play, { backgroundColor: dark ? 'rgba(255,255,255,0.18)' : T.soft }]}
        disabled={!ready}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
      >
        {failed ? (
          <Feather name="alert-circle" size={16} color={ink} />
        ) : !ready ? (
          <ActivityIndicator size="small" color={ink} />
        ) : (
          <Feather name={status.playing ? 'pause' : 'play'} size={16} color={ink} />
        )}
      </Pressable>
      <View style={[styles.track, { backgroundColor: track }]}>
        <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: ink }]} />
      </View>
      <Text style={[styles.time, { color: dark ? 'rgba(255,255,255,0.8)' : T.inkSoft }]}>
        {clipTime(status.playing || status.currentTime > 0 ? status.currentTime * 1000 : totalMs)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  barCancel: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.coralSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barMiddle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.soft,
    paddingHorizontal: 14,
  },
  redDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: T.coral },
  barTime: { fontFamily: 'Inter_700Bold', fontSize: 14, color: T.ink },
  barHint: { flex: 1, fontFamily: 'Inter_400Regular', fontSize: 12, color: T.mute },
  barSend: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: T.charcoal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 200, paddingVertical: 2 },
  play: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  track: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  time: { fontFamily: 'Inter_600SemiBold', fontSize: 12, minWidth: 34, textAlign: 'right' },
});
