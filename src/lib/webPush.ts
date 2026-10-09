// ============================================================================
// VEBOSSO EMS — Notifications on the web (migration 057)
// A browser that turns them on gets every notice the phone app gets, even
// with the tab closed (public/sw.js shows them). The subscription is saved
// for whoever is signed in; signing out removes it from this browser.
// On iPhone / iPad this only works once the site is added to the Home Screen.
// ============================================================================

import { Platform } from 'react-native';
import { supabase } from './supabase';

/** Public half of the VAPID key pair; the private half is a Supabase secret. */
const VAPID_PUBLIC_KEY = 'BN0VCoH23YWvFVab7q_I7wzR3X-XFNPJV6L5ZCYZreOvZNBKUXla71ZRPk1LJsNdYtVY6134aPMBk4y0bd6Drqg';

export type WebPushState = 'unsupported' | 'off' | 'on' | 'blocked';

export function webPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function keyBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function worker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/sw.js', { scope: '/' }).then(() => navigator.serviceWorker.ready);
}

async function save(sub: PushSubscription): Promise<boolean> {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;
  const { error } = await supabase.rpc('save_web_push', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys.p256dh,
    p_auth: json.keys.auth,
    p_user_agent: navigator.userAgent,
  });
  return !error;
}

export async function webPushState(): Promise<WebPushState> {
  if (!webPushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  if (Notification.permission !== 'granted') return 'off';
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ? 'on' : 'off';
}

/**
 * Asks the browser (call from a tap), subscribes, saves. 'on' once this
 * browser is subscribed — a failed save is retried on the next app open, so
 * it never holds anyone at the gate. Throws when the browser can't subscribe.
 */
export async function enableWebPush(): Promise<WebPushState> {
  if (!webPushSupported()) return 'unsupported';
  const permission = await Notification.requestPermission();
  if (permission === 'denied') return 'blocked';
  if (permission !== 'granted') return 'off';
  const reg = await worker();
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  if (!(await save(sub)) && __DEV__) console.warn('Web push: subscribed, but saving it failed');
  return 'on';
}

/**
 * On sign-in / app open: if this browser already allowed notifications,
 * make sure its subscription is saved for the person signed in now.
 */
export async function syncWebPush(): Promise<void> {
  try {
    if (!webPushSupported() || Notification.permission !== 'granted') return;
    const reg = await worker();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) as BufferSource,
      }));
    await save(sub);
  } catch (e) {
    if (__DEV__) console.warn('Web push sync failed:', e);
  }
}

const ASKED_KEY = 'vebosso.webPushAskedAt';
const ASK_AGAIN_MS = 24 * 3600 * 1000;

/**
 * The browser's own "Allow notifications?" pop-up, on the first click
 * anywhere (browsers only show it right after one). Optional — Allow or
 * Block, the app carries on. Someone who closes it without choosing is asked
 * again a day later, not on every click. Allowed → subscribed and saved
 * (if they aren't signed in yet, the sign-in sync saves it).
 */
export function askWebPushOnFirstClick(): () => void {
  if (!webPushSupported() || Notification.permission !== 'default') return () => {};
  try {
    if (Date.now() - Number(localStorage.getItem(ASKED_KEY) || 0) < ASK_AGAIN_MS) return () => {};
  } catch {
    // no storage — just ask
  }
  const onClick = () => {
    document.removeEventListener('click', onClick, true);
    if (Notification.permission !== 'default') return;
    try {
      localStorage.setItem(ASKED_KEY, String(Date.now()));
    } catch {
      // fine
    }
    void Notification.requestPermission().then((p) => {
      if (p === 'granted') void syncWebPush();
    });
  };
  document.addEventListener('click', onClick, true);
  return () => document.removeEventListener('click', onClick, true);
}

/** Signing out / turning off: this browser stops getting them. */
export async function disableWebPush(): Promise<void> {
  try {
    if (!webPushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration('/');
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    await supabase.rpc('remove_web_push', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  } catch (e) {
    if (__DEV__) console.warn('Web push off failed:', e);
  }
}
