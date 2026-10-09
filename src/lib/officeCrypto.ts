// ============================================================================
// VEBOSSO EMS — Opening password-protected Excel files
// Office 2010+ "agile" encryption (MS-OFFCRYPTO 2.3.4.10–15): the file is a
// compound document holding EncryptionInfo (XML) and EncryptedPackage (the
// real .xlsx, AES-CBC in 4096-byte segments). The password is stretched with
// the given hash and spin count, unlocks the file key, and the key is checked
// against the stored verifier before anything is decrypted. Banks (e.g. PNB)
// send statements this way, often with an .xls name.
// Everything runs on the device; the password and file never leave it.
// ============================================================================

import { cbc } from '@noble/ciphers/aes';
import { sha1 } from '@noble/hashes/sha1';
import { sha256, sha384, sha512 } from '@noble/hashes/sha2';
import * as XLSX from 'xlsx';

export class PasswordNeededError extends Error {
  /** A password was given, and it was wrong. */
  wrong: boolean;
  constructor(wrong = false) {
    super(wrong ? 'That password didn’t open the file' : 'This file is protected with a password');
    this.wrong = wrong;
  }
}

const HASHES: Record<string, (b: Uint8Array) => Uint8Array> = {
  SHA1: sha1,
  SHA256: sha256,
  SHA384: sha384,
  SHA512: sha512,
};

const BLOCK_VERIFIER_INPUT = new Uint8Array([0xfe, 0xa7, 0xd2, 0x76, 0x3b, 0x4b, 0x9e, 0x79]);
const BLOCK_VERIFIER_VALUE = new Uint8Array([0xd7, 0xaa, 0x0f, 0x6d, 0x30, 0x61, 0x34, 0x4e]);
const BLOCK_KEY = new Uint8Array([0x14, 0x6e, 0x0b, 0xe7, 0xab, 0xac, 0xd0, 0xd6]);

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

const u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf16le(s: string): Uint8Array {
  const out = new Uint8Array(s.length * 2);
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out[i * 2] = c & 0xff;
    out[i * 2 + 1] = c >> 8;
  }
  return out;
}

/** Truncate, or pad with 0x36, to `len` bytes. */
function fit(b: Uint8Array, len: number): Uint8Array {
  if (b.length >= len) return b.slice(0, len);
  const out = new Uint8Array(len).fill(0x36);
  out.set(b);
  return out;
}

const attr = (xml: string, tag: string, name: string): string | null => {
  const el = xml.match(new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>`))?.[0];
  return el?.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
};

/** The file's streams, or null when it isn't an encrypted Office file. */
function encryptedParts(bytes: Uint8Array): { info: Uint8Array; pkg: Uint8Array } | null {
  // Compound documents start D0 CF 11 E0.
  if (bytes.length < 8 || bytes[0] !== 0xd0 || bytes[1] !== 0xcf || bytes[2] !== 0x11 || bytes[3] !== 0xe0) return null;
  try {
    const cfb = XLSX.CFB.read(bytes, { type: 'array' } as any);
    const info = XLSX.CFB.find(cfb, 'EncryptionInfo');
    const pkg = XLSX.CFB.find(cfb, 'EncryptedPackage');
    if (!info?.content || !pkg?.content) return null;
    return { info: new Uint8Array(info.content as any), pkg: new Uint8Array(pkg.content as any) };
  } catch {
    return null;
  }
}

export const isEncryptedOffice = (bytes: Uint8Array) => encryptedParts(bytes) !== null;

/** Decrypt an agile-encrypted Office file; returns the inner .xlsx bytes. */
export function decryptOffice(bytes: Uint8Array, password: string): Uint8Array {
  const parts = encryptedParts(bytes);
  if (!parts) throw new Error('This isn’t a protected Excel file');
  const { info, pkg } = parts;

  const major = info[0] | (info[1] << 8);
  const minor = info[2] | (info[3] << 8);
  if (major !== 4 || minor !== 4) {
    throw new Error('This file uses an older kind of Excel protection the app can’t open. Save it again without a password, or as a newer Excel file.');
  }
  // 4.4: version (4) + reserved (4), then the XML.
  // Plain ASCII; no TextDecoder (not on every phone's JS engine).
  let xml = '';
  for (let i = 8; i < info.length; i++) xml += String.fromCharCode(info[i]);

  const keyHash = HASHES[(attr(xml, 'keyData', 'hashAlgorithm') ?? '').toUpperCase()];
  const keySalt = b64ToBytes(attr(xml, 'keyData', 'saltValue') ?? '');
  const blockSize = Number(attr(xml, 'keyData', 'blockSize') ?? 16);

  const pwHash = HASHES[(attr(xml, 'encryptedKey', 'hashAlgorithm') ?? '').toUpperCase()];
  const pwSalt = b64ToBytes(attr(xml, 'encryptedKey', 'saltValue') ?? '');
  const spin = Number(attr(xml, 'encryptedKey', 'spinCount') ?? 100000);
  const keyBytes = Number(attr(xml, 'encryptedKey', 'keyBits') ?? 256) / 8;
  const hashSize = Number(attr(xml, 'encryptedKey', 'hashSize') ?? 20);
  const cipher = `${attr(xml, 'encryptedKey', 'cipherAlgorithm')}/${attr(xml, 'encryptedKey', 'cipherChaining')}`;
  if (!keyHash || !pwHash || cipher !== 'AES/ChainingModeCBC') {
    throw new Error('This file uses a kind of protection the app can’t open yet.');
  }

  // Stretch the password.
  let h = pwHash(concat(pwSalt, utf16le(password)));
  for (let i = 0; i < spin; i++) h = pwHash(concat(u32(i), h));
  const keyFor = (block: Uint8Array) => fit(pwHash(concat(h, block)), keyBytes);
  const dec = (key: Uint8Array, iv: Uint8Array, data: Uint8Array) =>
    cbc(key, fit(iv, blockSize), { disablePadding: true }).decrypt(data);

  // Right password? The verifier's hash must match.
  const verifierInput = dec(
    keyFor(BLOCK_VERIFIER_INPUT),
    pwSalt,
    b64ToBytes(attr(xml, 'encryptedKey', 'encryptedVerifierHashInput') ?? ''),
  ).slice(0, pwSalt.length);
  const verifierHash = dec(
    keyFor(BLOCK_VERIFIER_VALUE),
    pwSalt,
    b64ToBytes(attr(xml, 'encryptedKey', 'encryptedVerifierHashValue') ?? ''),
  ).slice(0, hashSize);
  const expected = pwHash(verifierInput).slice(0, hashSize);
  if (expected.some((b, i) => b !== verifierHash[i])) throw new PasswordNeededError(true);

  const fileKey = dec(keyFor(BLOCK_KEY), pwSalt, b64ToBytes(attr(xml, 'encryptedKey', 'encryptedKeyValue') ?? '')).slice(
    0,
    keyBytes,
  );

  // The package: 8-byte size, then 4096-byte segments, each with its own IV.
  const size = pkg[0] + pkg[1] * 2 ** 8 + pkg[2] * 2 ** 16 + pkg[3] * 2 ** 24 + pkg[4] * 2 ** 32;
  const body = pkg.slice(8);
  const SEG = 4096;
  const out = new Uint8Array(Math.ceil(body.length / SEG) * SEG);
  for (let i = 0, at = 0; at < body.length; i++, at += SEG) {
    let chunk: Uint8Array = body.slice(at, at + SEG);
    // AES needs whole blocks.
    if (chunk.length % 16) chunk = concat(chunk, new Uint8Array(16 - (chunk.length % 16)));
    const iv = keyHash(concat(keySalt, u32(i)));
    out.set(dec(fileKey, iv, chunk), at);
  }
  return out.slice(0, size);
}
