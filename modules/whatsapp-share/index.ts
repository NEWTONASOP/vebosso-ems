// ============================================================================
// VEBOSSO EMS — WhatsApp file send (local native module, Android only)
// Opens one WhatsApp chat with a file attached, in a single step.
// ============================================================================

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type WhatsappShareModule = {
  isInstalled(packageName: string): boolean;
  sendFile(packageName: string, phone: string, contentUri: string, mimeType: string, text: string | null): Promise<void>;
};

// Missing in Expo Go and on web — callers get null and say so.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<WhatsappShareModule>('WhatsappShare') : null;

export const WHATSAPP = 'com.whatsapp';
export const WHATSAPP_BUSINESS = 'com.whatsapp.w4b';

export const isAvailable = () => native !== null;

export const isInstalled = (packageName: string) => native?.isInstalled(packageName) ?? false;

/**
 * @param phone digits with country code, e.g. "919876543210"
 * @param contentUri a content:// URI (FileSystem.getContentUriAsync)
 */
export async function sendFile(
  packageName: string,
  phone: string,
  contentUri: string,
  mimeType: string,
  text?: string,
): Promise<void> {
  if (!native) throw new Error('Sending on WhatsApp needs the installed app (not Expo Go)');
  await native.sendFile(packageName, phone, contentUri, mimeType, text ?? null);
}
