// ============================================================================
// VEBOSSO EMS — Cloudinary video upload
// Bill videos go to Cloudinary through an UNSIGNED upload preset, so no secret
// is ever in the app. The preset can only add files, and only into its own
// folder (vebosso-bills) — the app never lists, changes or deletes anything in
// the account. Taking a video off a bill leaves the file in Cloudinary.
// ============================================================================

import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { BillVideo } from '../types/database';

export const CLOUD_NAME = 'kdp5koc8';
export const UPLOAD_PRESET = 'vebosso_bills_videos';

/** Cloudinary's free plan refuses video files bigger than this. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

type Result<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Shrink on the phone first (about 720p, like WhatsApp does) so uploads are
 * quick and Cloudinary's free space lasts. If that fails (or on web), the original goes up.
 */
async function shrink(uri: string): Promise<string> {
  // Phone only; loaded here because the library touches native code as soon as it is imported.
  if (Platform.OS === 'web') return uri;
  try {
    const { Video } = await import('react-native-compressor');
    return await Video.compress(uri, { compressionMethod: 'auto', maxSize: 1280 });
  } catch {
    return uri;
  }
}

/** Upload one video from the phone; returns the entry the bill keeps. */
export async function uploadBillVideo(
  uri: string,
  info: { name?: string | null; bytes?: number | null; duration?: number | null } = {},
  onStatus?: (status: 'compressing' | 'uploading') => void,
): Promise<Result<BillVideo>> {
  try {
    onStatus?.('compressing');
    const small = await shrink(uri);
    let bytes = info.bytes ?? null;
    try {
      const f = await FileSystem.getInfoAsync(small);
      if (f.exists && typeof f.size === 'number') bytes = f.size;
    } catch {}
    if (bytes && bytes > MAX_VIDEO_BYTES) {
      return { success: false, error: 'That video is still over 100 MB after shrinking — trim it or pick a shorter one' };
    }
    onStatus?.('uploading');
    const name = info.name || `video-${Date.now()}.mp4`;
    const form = new FormData();
    form.append('file', { uri: small, name, type: 'video/mp4' } as any);
    form.append('upload_preset', UPLOAD_PRESET);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, {
      method: 'POST',
      body: form,
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok || !json?.secure_url) {
      return { success: false, error: json?.error?.message || 'Could not upload the video' };
    }
    return {
      success: true,
      data: {
        url: json.secure_url,
        public_id: json.public_id,
        name,
        bytes: typeof json.bytes === 'number' ? json.bytes : bytes,
        // Cloudinary measures it; the phone's figure (ms) is the fallback.
        duration: typeof json.duration === 'number' ? json.duration : info.duration ? info.duration / 1000 : null,
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not upload the video' };
  }
}

/** A still frame from the video, as a small square picture. */
export const videoThumb = (v: BillVideo, size = 240) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_0,w_${size},h_${size},c_fill,f_jpg/${v.public_id}.jpg`;

/** "1:05" */
export function videoLength(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
