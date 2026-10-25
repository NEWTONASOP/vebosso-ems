// ============================================================================
// VEBOSSO EMS — Image source for expo-image
// A Supabase signed link carries a fresh ?token= every time it is made, so the
// image cache would see a new picture and download it again on every open.
// Keying the cache on the link without its token keeps the photo on disk.
// ============================================================================

import { ImageSource } from 'expo-image';

export function imageSource(uri: string): ImageSource {
  const signed = uri.includes('/object/sign/');
  return signed ? { uri, cacheKey: uri.split('?')[0] } : { uri };
}
