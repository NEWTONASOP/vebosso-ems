// ============================================================================
// VEBOSSO EMS — Sending notifications to browsers (Web Push)
// ============================================================================
// The standard way: VAPID (RFC 8292) proves the message is from us, and the
// message is encrypted for that one browser (RFC 8291, aes128gcm). Only Web
// Crypto is used, so it runs as-is in Supabase Edge Functions — no packages.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   — the same key the web app subscribes with
//   VAPID_PRIVATE_KEY  — never leaves Supabase
//   VAPID_SUBJECT      — optional; defaults to the web app's address
// Browsers that are gone (404 / 410) are removed from the table.
// ============================================================================

// deno-lint-ignore-file no-explicit-any

export interface WebPushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface Subscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

const enc = new TextEncoder();

function b64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < b.length; i++) bin += String.fromCharCode(b[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, bytes * 8));
}

// ---- VAPID ------------------------------------------------------------------

let signingKey: Promise<CryptoKey> | null = null;

function vapidKey(publicKey: string, privateKey: string): Promise<CryptoKey> {
  signingKey ??= (() => {
    const pub = b64urlToBytes(publicKey);
    const jwk = {
      kty: 'EC',
      crv: 'P-256',
      d: privateKey,
      x: bytesToB64url(pub.slice(1, 33)),
      y: bytesToB64url(pub.slice(33, 65)),
      ext: true,
    };
    return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  })();
  return signingKey;
}

/** The Authorization header for one push service (its origin). */
export async function vapidAuth(endpoint: string, publicKey: string, privateKey: string, subject: string): Promise<string> {
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64url(
    enc.encode(
      JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }),
    ),
  );
  const unsigned = `${header}.${claims}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await vapidKey(publicKey, privateKey), enc.encode(unsigned)),
  );
  return `vapid t=${unsigned}.${bytesToB64url(sig)}, k=${publicKey}`;
}

// ---- Encryption (aes128gcm) ---------------------------------------------------

/** Encrypts `payload` for one browser; the result is the request body. */
export async function encryptPayload(sub: { p256dh: string; auth: string }, payload: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(sub.p256dh);
  const authSecret = b64urlToBytes(sub.auth);

  const local = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', local.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey } as any, local.privateKey, 256));

  const ikm = await hkdf(authSecret, shared, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12);

  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // One record: the payload, then 0x02 (last record), no padding.
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))),
  );

  const rs = new Uint8Array([0, 0, 0x10, 0]); // record size 4096
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, cipher);
}

// ---- Sending ------------------------------------------------------------------

/** 'sent', 'gone' (remove it) or 'failed'. */
export async function sendOne(
  sub: Subscription,
  message: WebPushMessage,
  opts: { publicKey: string; privateKey: string; subject: string; ttl: number },
): Promise<'sent' | 'gone' | 'failed'> {
  try {
    // Push services take up to 4 KB; keep well inside it.
    const payload = enc.encode(
      JSON.stringify({ title: message.title.slice(0, 200), body: message.body.slice(0, 1000), data: message.data ?? {} }),
    );
    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        Authorization: await vapidAuth(sub.endpoint, opts.publicKey, opts.privateKey, opts.subject),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: String(opts.ttl),
        Urgency: 'high',
      },
      body: await encryptPayload(sub, payload),
    });
    if (res.status === 404 || res.status === 410) return 'gone';
    if (!res.ok) {
      console.warn(`Web push ${res.status} from ${new URL(sub.endpoint).host}: ${(await res.text()).slice(0, 200)}`);
      return 'failed';
    }
    return 'sent';
  } catch (e) {
    console.warn('Web push error:', e);
    return 'failed';
  }
}

/**
 * Sends to every browser of these people. One message for everyone, or a
 * function giving each person theirs. Never throws — web push is extra; the
 * phone push and the in-app list don't depend on it.
 */
export async function sendWebPush(
  adminClient: any,
  userIds: string[],
  message: WebPushMessage | ((userId: string) => WebPushMessage | null),
  ttl = 4 * 24 * 3600,
): Promise<number> {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!publicKey || !privateKey || userIds.length === 0) return 0;
  const subject = Deno.env.get('VAPID_SUBJECT') || 'https://ems.vebosso.com';

  try {
    const { data, error } = await adminClient
      .from('web_push_subscriptions')
      .select('user_id, endpoint, p256dh, auth')
      .in('user_id', [...new Set(userIds)]);
    if (error || !data?.length) return 0;

    const gone: string[] = [];
    let sent = 0;
    await Promise.all(
      (data as (Subscription & { user_id: string })[]).map(async (sub) => {
        const msg = typeof message === 'function' ? message(sub.user_id) : message;
        if (!msg) return;
        const r = await sendOne(sub, msg, { publicKey, privateKey, subject, ttl });
        if (r === 'gone') gone.push(sub.endpoint);
        if (r === 'sent') sent++;
      }),
    );
    if (gone.length) await adminClient.from('web_push_subscriptions').delete().in('endpoint', gone);
    return sent;
  } catch (e) {
    console.warn('Web push skipped:', e);
    return 0;
  }
}

/** The in-app notification rows just written, sent to those people's browsers too. */
export function sendWebPushForRows(
  adminClient: any,
  rows: { user_id: string; title: string; body: string; data?: Record<string, unknown> }[],
  ttl?: number,
): Promise<number> {
  const byUser = new Map(rows.map((r) => [r.user_id, { title: r.title, body: r.body, data: r.data }]));
  return sendWebPush(adminClient, [...byUser.keys()], (id) => byUser.get(id) ?? null, ttl);
}
