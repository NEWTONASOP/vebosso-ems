// ============================================================================
// VEBOSSO EMS — Cloudinary uploads
// Bill videos and venue pictures go to Cloudinary through UNSIGNED upload
// presets, so no secret is ever in the app. Each preset can only add files, and
// only into its own folder (vebosso-bills, vebosso-venues) — the app never
// lists, changes or deletes anything in the account. Taking a video or picture
// off something leaves the file in Cloudinary.
// ============================================================================

import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';
import { BillVideo, CloudImage } from '../types/database';

export const CLOUD_NAME = 'kdp5koc8';
export const UPLOAD_PRESET = 'vebosso_bills_videos';
/** Unsigned preset for venue photos and permission screenshots (folder vebosso-venues). */
export const VENUE_IMAGE_PRESET = 'vebosso_venue_images';

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
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`;

    let ok: boolean;
    let json: any;
    if (Platform.OS === 'web') {
      // A browser file object (the picker's link is a blob: address).
      const blob = await (await fetch(small)).blob();
      const form = new FormData();
      form.append('file', blob, name);
      form.append('upload_preset', UPLOAD_PRESET);
      const res = await fetch(endpoint, { method: 'POST', body: form });
      ok = res.ok;
      json = await res.json().catch(() => ({}));
    } else {
      // Streams the file from storage. (The old { uri, name, type } FormData part is
      // refused by this Expo version's fetch: "unsupported FormDataPart".)
      const res = await FileSystem.uploadAsync(endpoint, small, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'video/mp4',
        parameters: { upload_preset: UPLOAD_PRESET },
      });
      ok = res.status >= 200 && res.status < 300;
      try {
        json = JSON.parse(res.body);
      } catch {
        json = {};
      }
    }
    if (!ok || !json?.secure_url) {
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

/**
 * Upload one picture from the phone (or browser). Shrunk to 1600px wide JPEG
 * first, like bill photos, so it uploads fast and the free space lasts.
 */
export async function uploadImage(uri: string, addedByName: string | null, preset = VENUE_IMAGE_PRESET): Promise<Result<CloudImage>> {
  try {
    const small = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1600 } }], {
      compress: 0.7,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
    let ok: boolean;
    let json: any;
    if (Platform.OS === 'web') {
      const blob = await (await fetch(small.uri)).blob();
      const form = new FormData();
      form.append('file', blob, `photo-${Date.now()}.jpg`);
      form.append('upload_preset', preset);
      const res = await fetch(endpoint, { method: 'POST', body: form });
      ok = res.ok;
      json = await res.json().catch(() => ({}));
    } else {
      const res = await FileSystem.uploadAsync(endpoint, small.uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.MULTIPART,
        fieldName: 'file',
        mimeType: 'image/jpeg',
        parameters: { upload_preset: preset },
      });
      ok = res.status >= 200 && res.status < 300;
      try {
        json = JSON.parse(res.body);
      } catch {
        json = {};
      }
    }
    if (!ok || !json?.secure_url) {
      return { success: false, error: json?.error?.message || 'Could not upload the picture' };
    }
    return {
      success: true,
      data: {
        url: json.secure_url,
        public_id: json.public_id,
        width: typeof json.width === 'number' ? json.width : null,
        height: typeof json.height === 'number' ? json.height : null,
        bytes: typeof json.bytes === 'number' ? json.bytes : null,
        added_at: new Date().toISOString(),
        added_by_name: addedByName,
      },
    };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Could not upload the picture' };
  }
}

/** A small square version of a picture, for lists. */
export const imageThumb = (img: CloudImage, size = 240) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/w_${size},h_${size},c_fill,q_auto,f_auto/${img.public_id}`;

/** A still frame from the video, as a small square picture. */
export const videoThumb = (v: BillVideo, size = 240) =>
  `https://res.cloudinary.com/${CLOUD_NAME}/video/upload/so_0,w_${size},h_${size},c_fill,f_jpg/${v.public_id}.jpg`;

/** "1:05" */
export function videoLength(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return '';
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
