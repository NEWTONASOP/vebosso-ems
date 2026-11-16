// ============================================================================
// VEBOSSO EMS — Bill photos laid out on A4 pages
// Up to 4 photos share a page, in rows: each row is as tall as it needs to be
// for its photos to fill the width exactly (no cropping, no stretching). A
// page only takes more photos when every one of them stays big enough to look
// right; otherwise fewer go on it. Sizes are CSS px on the bill's A4 page.
// ============================================================================

/** The width of the bill's content (A4 794px − 40px padding each side). */
export const PAGE_W = 714;
/** Height a page of photos may use (A4 1123px − margins − "Images" heading, with room to spare). */
export const PAGE_H = 930;
const GAP = 12;
/** A photo sharing a page must keep at least this on its shorter side (~6 cm). */
const MIN_SIDE = 230;
const MAX_PER_PAGE = 4;

export interface Pic {
  src: string;
  caption: string;
  /** width / height; null when it couldn't be read (the photo gets a page of its own). */
  ratio: number | null;
}

export interface PlacedPic extends Pic {
  w: number;
  h: number;
}

export interface PhotoRow {
  pics: PlacedPic[];
  /** Height kept under the photos for their captions. */
  captionH: number;
}

export type PhotoPage = PhotoRow[];

// ---------------------------------------------------------------------------
// Reading a photo's size from its data URI

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** The first `max` bytes of a base64 string. */
function decodePrefix(b64: string, max: number): Uint8Array {
  const chars = b64.slice(0, Math.ceil((max * 4) / 3) + 4).replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((chars.length * 3) / 4));
  let o = 0;
  for (let i = 0; i + 3 < chars.length; i += 4) {
    const n =
      (B64.indexOf(chars[i]) << 18) |
      (B64.indexOf(chars[i + 1]) << 12) |
      (B64.indexOf(chars[i + 2]) << 6) |
      B64.indexOf(chars[i + 3]);
    out[o++] = (n >> 16) & 255;
    out[o++] = (n >> 8) & 255;
    out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

/** EXIF orientation 5–8 means the photo is stored on its side. */
function exifTurned(d: Uint8Array, start: number, end: number): boolean {
  // "Exif\0\0" then a TIFF header.
  if (d[start] !== 0x45 || d[start + 1] !== 0x78 || d[start + 2] !== 0x69 || d[start + 3] !== 0x66) return false;
  const t = start + 6;
  const le = d[t] === 0x49;
  const u16 = (p: number) => (le ? d[p] | (d[p + 1] << 8) : (d[p] << 8) | d[p + 1]);
  const u32 = (p: number) => (le ? (d[p] | (d[p + 1] << 8) | (d[p + 2] << 16) | (d[p + 3] << 24)) >>> 0 : ((d[p] << 24) | (d[p + 1] << 16) | (d[p + 2] << 8) | d[p + 3]) >>> 0);
  const ifd = t + u32(t + 4);
  if (ifd + 2 > end) return false;
  const count = u16(ifd);
  for (let i = 0; i < count; i++) {
    const e = ifd + 2 + i * 12;
    if (e + 12 > end) break;
    if (u16(e) === 0x0112) return u16(e + 8) >= 5 && u16(e + 8) <= 8;
  }
  return false;
}

/** width / height of a JPEG, PNG or WebP data URI, as it shows on screen; null if unknown. */
export function imageRatio(dataUri: string): number | null {
  const comma = dataUri.indexOf(',');
  if (comma < 0) return null;
  const d = decodePrefix(dataUri.slice(comma + 1), 96 * 1024);
  // PNG: IHDR right after the signature.
  if (d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4e && d[3] === 0x47 && d.length >= 24) {
    const w = (d[16] << 24) | (d[17] << 16) | (d[18] << 8) | d[19];
    const h = (d[20] << 24) | (d[21] << 16) | (d[22] << 8) | d[23];
    return w > 0 && h > 0 ? w / h : null;
  }
  // WebP (VP8 / VP8L / VP8X).
  if (d[0] === 0x52 && d[1] === 0x49 && d[8] === 0x57 && d[9] === 0x45 && d.length >= 30) {
    const kind = String.fromCharCode(d[12], d[13], d[14], d[15]);
    let w = 0;
    let h = 0;
    if (kind === 'VP8 ') {
      w = (d[26] | (d[27] << 8)) & 0x3fff;
      h = (d[28] | (d[29] << 8)) & 0x3fff;
    } else if (kind === 'VP8L') {
      const b = d[21] | (d[22] << 8) | (d[23] << 16) | (d[24] << 24);
      w = (b & 0x3fff) + 1;
      h = ((b >> 14) & 0x3fff) + 1;
    } else if (kind === 'VP8X') {
      w = 1 + (d[24] | (d[25] << 8) | (d[26] << 16));
      h = 1 + (d[27] | (d[28] << 8) | (d[29] << 16));
    }
    return w > 0 && h > 0 ? w / h : null;
  }
  // JPEG: walk the markers to the frame header (SOF), noting EXIF orientation.
  if (d[0] === 0xff && d[1] === 0xd8) {
    let p = 2;
    let turned = false;
    while (p + 9 < d.length) {
      if (d[p] !== 0xff) {
        p++;
        continue;
      }
      const m = d[p + 1];
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
        p += 2;
        continue;
      }
      const len = (d[p + 2] << 8) | d[p + 3];
      if (m === 0xe1) turned = exifTurned(d, p + 4, Math.min(d.length, p + 2 + len)) || turned;
      const isSof = m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc;
      if (isSof) {
        const h = (d[p + 5] << 8) | d[p + 6];
        const w = (d[p + 7] << 8) | d[p + 8];
        if (!(w > 0 && h > 0)) return null;
        return turned ? h / w : w / h;
      }
      p += 2 + len;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Planning the pages

/** Space a caption needs under a photo this wide (≈11.5px text, 1.4 line height). */
function captionHeight(caption: string, width: number): number {
  if (!caption) return 0;
  const perLine = Math.max(8, Math.floor(width / 6.4));
  const lines = caption.split('\n').reduce((n, part) => n + Math.max(1, Math.ceil(part.length / perLine)), 0);
  return 6 + lines * 16;
}

/** Lay these photos out as rows (`split` = how many per row); null if they don't all stay big enough. */
function tryRows(pics: Pic[], split: number[]): { page: PhotoPage; area: number } | null {
  // Row heights that make each row fill the width exactly.
  let at = 0;
  const raw = split.map((n) => {
    const row = pics.slice(at, at + n);
    at += n;
    const ratios = row.reduce((s, p) => s + (p.ratio ?? 1), 0);
    return { row, h: (PAGE_W - GAP * (n - 1)) / ratios };
  });
  // Too tall for the page: shrink every row by the same amount (rows get narrower, centred).
  const fixed = GAP * (raw.length - 1);
  const capOf = (r: { row: Pic[]; h: number }, scale: number) =>
    Math.max(...r.row.map((p) => captionHeight(p.caption, (p.ratio ?? 1) * r.h * scale)));
  let scale = 1;
  for (let i = 0; i < 3; i++) {
    const caps = raw.reduce((s, r) => s + capOf(r, scale), 0);
    const photos = raw.reduce((s, r) => s + r.h, 0);
    scale = Math.min(1, (PAGE_H - fixed - caps) / photos);
  }
  if (scale <= 0) return null;

  let area = 0;
  const page: PhotoPage = raw.map((r) => {
    const h = Math.floor(r.h * scale);
    const placed = r.row.map((p) => ({ ...p, w: Math.floor((p.ratio ?? 1) * h), h }));
    for (const p of placed) area += p.w * p.h;
    return { pics: placed, captionH: capOf(r, scale) };
  });
  if (pics.length > 1 && page.some((r) => r.pics.some((p) => Math.min(p.w, p.h) < MIN_SIDE))) return null;
  return { page, area };
}

/** Every way to cut n photos (in order) into rows: 3 → [3], [1,2], [2,1], [1,1,1]. */
function splits(n: number): number[][] {
  if (n === 1) return [[1]];
  const out: number[][] = [];
  for (let first = 1; first <= n; first++) {
    if (first === n) out.push([n]);
    else for (const rest of splits(n - first)) out.push([first, ...rest]);
  }
  return out;
}

/**
 * The photos, in their order, on as few pages as looks right: each page takes
 * the most photos (up to 4) that can all stay big, in the row arrangement that
 * shows them largest. A photo whose shape is unknown gets a page to itself.
 */
export function planPhotoPages(pics: Pic[]): PhotoPage[] {
  const pages: PhotoPage[] = [];
  let i = 0;
  while (i < pics.length) {
    let best: { page: PhotoPage; area: number; count: number } | null = null;
    for (let k = Math.min(MAX_PER_PAGE, pics.length - i); k >= 1 && !best; k--) {
      const group = pics.slice(i, i + k);
      if (k > 1 && group.some((p) => p.ratio === null)) continue;
      for (const split of splits(k)) {
        const r = tryRows(group, split);
        if (r && (!best || r.area > best.area)) best = { ...r, count: k };
      }
    }
    // A single photo always fits (it is just shrunk to the page).
    const used = best ?? { page: tryRows([pics[i]], [1])!.page, area: 0, count: 1 };
    pages.push(used.page);
    i += used.count;
  }
  return pages;
}
