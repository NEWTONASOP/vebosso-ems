// ============================================================================
// VEBOSSO EMS — Voice notes
// Recorded with expo-audio, stored in the private `voice-notes` bucket
// (migration 033):  chat/<member_id>/…  for chats, task/<assignee_id>/…  for
// tasks. Played back through short-lived signed links.
// ============================================================================

import { Platform } from 'react-native';
import { RecordingOptions, RecordingPresets } from 'expo-audio';
import { uploadCheckoutPhoto } from '../store/workStore';
import { parseSupabaseError } from './errors';
import { supabase } from './supabase';

export const VOICE_BUCKET = 'voice-notes';
/** Longest voice note, so files stay small. */
export const VOICE_MAX_MS = 3 * 60 * 1000;

/** AAC in .m4a (plays on phones and in browsers), mono and light for speech. */
export const VOICE_RECORDING: RecordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  sampleRate: 22050,
  bitRate: 48000,
};

export interface VoiceClip {
  uri: string;
  durationMs: number;
}

type Result<T> = { success: true; data: T } | { success: false; error: string };

/** "0:07", "2:15" */
export function clipTime(ms: number | null | undefined): string {
  const total = Math.max(0, Math.round((ms ?? 0) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Upload a recorded clip; returns its path in the bucket. */
export async function uploadVoiceNote(
  kind: 'chat' | 'task',
  personId: string,
  clip: VoiceClip,
): Promise<Result<string>> {
  try {
    // Browsers record WebM/Opus (blob: links); phones record .m4a files.
    const fromExt = clip.uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    const ext = Platform.OS === 'web' || clip.uri.startsWith('blob:') ? 'webm' : fromExt === 'm4a' ? 'm4a' : fromExt || 'm4a';
    const mime = ext === 'webm' ? 'audio/webm' : ext === 'm4a' || ext === 'mp4' ? 'audio/mp4' : `audio/${ext}`;
    const path = `${kind}/${personId}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;
    await uploadCheckoutPhoto(path, clip.uri, ext, VOICE_BUCKET, false, mime);
    return { success: true, data: path };
  } catch (err) {
    return { success: false, error: parseSupabaseError(err) };
  }
}

export async function signVoiceNote(path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(VOICE_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
