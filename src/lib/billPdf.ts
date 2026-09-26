// ============================================================================
// VEBOSSO EMS — Bill PDF
// Builds the printable bill, shares it, or sends it straight to the number on
// the bill over WhatsApp as the PDF itself. Nothing the client sees says whether it's
// an estimate or a client bill.
// ============================================================================

import { format, parseISO } from 'date-fns';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { Social as SocialApp } from 'react-native-share';
import { Bill, BillSettings } from '../types/database';
import { money } from './accounts';
import { Alert } from './alert';
import { billTotals, signBillImages } from './bills';
import { printHtmlOnWeb } from './webPrint';

const esc = (s: string | null | undefined) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl = (s: string | null | undefined) => esc(s).replace(/\n/g, '<br/>');

export function billFileName(b: Bill) {
  const who = (b.client_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40);
  return `${who || 'VEBOSSO'}${b.number ? ` - ${b.number}` : ''}.pdf`;
}

// ---------------------------------------------------------------------------
// Images → data URIs, so the PDF never depends on a link that expires.

async function toDataUri(url: string, mime = 'image/jpeg'): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      const blob = await (await fetch(url)).blob();
      return await new Promise((resolve) => {
        const r = new FileReader();
        r.onloadend = () => resolve(typeof r.result === 'string' ? r.result : null);
        r.readAsDataURL(blob);
      });
    }
    let local = url;
    if (/^https?:/.test(url)) {
      const target = `${FileSystem.cacheDirectory}bill_${Math.random().toString(36).slice(2)}`;
      local = (await FileSystem.downloadAsync(url, target)).uri;
    }
    const b64 = await FileSystem.readAsStringAsync(local, { encoding: FileSystem.EncodingType.Base64 });
    return `data:${mime};base64,${b64}`;
  } catch {
    return null;
  }
}

let logoCache: string | null = null;
async function logoDataUri(): Promise<string | null> {
  if (logoCache) return logoCache;
  const asset = Asset.fromModule(require('../../assets/images/vebosso-logo.png'));
  await asset.downloadAsync();
  logoCache = await toDataUri(asset.localUri ?? asset.uri, 'image/png');
  return logoCache;
}

// ---------------------------------------------------------------------------
// HTML

export async function buildBillHtml(b: Bill, s: BillSettings): Promise<string> {
  const logo = await logoDataUri();
  const signed = await signBillImages(b.images ?? []);
  const images = (await Promise.all((b.images ?? []).map((p) => (signed[p] ? toDataUri(signed[p]) : null)))).filter(
    (x): x is string => !!x
  );
  const t = billTotals(b);
  const items = (b.items ?? []).filter((i) => i.description?.trim());
  const date = b.function_date ? format(parseISO(b.function_date), 'EEE, d MMM yyyy') : '';

  const detail = (label: string, value: string | null | undefined) =>
    value ? `<div class="d"><span>${label}</span><b>${nl(value)}</b></div>` : '';

  // Your business details sit in the header, under the bill number.
  const contactLines = [
    s.address ? nl(s.address) : null,
    s.phone ? `☎ ${esc(s.phone)}` : null,
    s.email ? `✉ ${esc(s.email)}` : null,
    s.website ? esc(s.website) : null,
  ].filter(Boolean) as string[];

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { margin: 0; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; color: #1B1E24; font-size: 12px;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .head { background: #1B1E24; color: #fff; padding: 22px 32px 20px; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
  .head img { height: 64px; }
  .head .brand { font-size: 22px; font-weight: 800; letter-spacing: 1px; }
  .doc { text-align: right; max-width: 55%; }
  .doc .type { font-size: 20px; font-weight: 800; letter-spacing: 2px; color: #F0A398; }
  .doc .date { font-size: 11px; margin-top: 2px; color: rgba(255,255,255,.6); }
  .doc .biz { margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,.14); font-size: 10.5px; line-height: 1.55; color: #DCD0EE; }
  .wrap { padding: 20px 32px 28px; }
  h3 { font-size: 10.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #8A8398; margin: 18px 0 8px; }
  .client { font-size: 18px; font-weight: 800; margin: 2px 0 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .d span { display: block; font-size: 9.5px; letter-spacing: .6px; text-transform: uppercase; color: #8A8398; }
  .d b { font-size: 12.5px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th { text-align: left; font-size: 10px; letter-spacing: .8px; text-transform: uppercase; color: #fff; background: #3A3450; padding: 8px 10px; }
  th.n, td.n { text-align: right; white-space: nowrap; }
  td { padding: 9px 10px; border-bottom: 1px solid #ECE8F3; vertical-align: top; }
  tr:nth-child(even) td { background: #FAF8FD; }
  .sum { margin-top: 12px; margin-left: auto; width: 55%; }
  .sum div { display: flex; justify-content: space-between; padding: 6px 10px; font-size: 12.5px; }
  .sum .bal { background: #1B1E24; color: #fff; border-radius: 8px; font-weight: 800; font-size: 14px; padding: 10px; margin-top: 4px; }
  .sum .bal b { color: #F0A398; }
  .terms { font-size: 10.5px; color: #4A4556; line-height: 1.55; }
  .imgs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .imgs img { width: 100%; height: 190px; object-fit: cover; border-radius: 8px; }
  .foot { margin-top: 26px; display: flex; justify-content: space-between; align-items: flex-end; border-top: 1px solid #ECE8F3; padding-top: 12px; font-size: 10.5px; color: #8A8398; }
  .sign { text-align: right; }
  .sign b { display: block; color: #1B1E24; font-size: 12.5px; margin-top: 2px; }
  .empty { color: #8A8398; text-align: center; padding: 14px; }
  .imgs, .sum, .terms { page-break-inside: avoid; }
</style></head><body>
  <div class="head">
    ${logo ? `<img src="${logo}" />` : `<div class="brand">${esc(s.business_name)}</div>`}
    <div class="doc">
      <div class="type">${esc(b.number ?? '')}</div>
      <div class="date">${format(new Date(), 'd MMM yyyy')}</div>
      ${contactLines.length ? `<div class="biz">${contactLines.join('<br/>')}</div>` : ''}
    </div>
  </div>
  <div class="wrap">
    <h3>Prepared for</h3>
    <div class="client">${esc(b.client_name || '—')}</div>
    <div class="grid" style="margin-top:8px">
      ${detail('Phone', b.phone)}
      ${detail('Alternate contact', b.alt_phone)}
      ${detail('Address', b.address)}
    </div>

    <h3>Event</h3>
    <div class="grid">
      ${detail('Venue', b.venue)}
      ${detail('Hall / Floor', b.hall_floor)}
      ${detail('Date of function', date)}
      ${detail('Timing', b.timing)}
      ${detail('Event type', b.event_type)}
      ${detail('Guests expected', b.guests)}
    </div>

    <h3>Services by ${esc(s.business_name)}</h3>
    <table>
      <thead><tr><th style="width:36px">#</th><th>Service</th></tr></thead>
      <tbody>
        ${
          items.length
            ? items.map((i, n) => `<tr><td>${n + 1}</td><td>${nl(i.description)}</td></tr>`).join('')
            : '<tr><td colspan="2" class="empty">—</td></tr>'
        }
      </tbody>
    </table>

    <div class="sum">
      <div><span>Total</span><span>₹${money(t.total)}</span></div>
      <div><span>Advance</span><span>₹${money(t.advance)}</span></div>
      <div class="bal"><span>Balance</span><b>₹${money(t.balance)}</b></div>
    </div>

    ${b.terms ? `<h3>Terms &amp; conditions</h3><div class="terms">${nl(b.terms)}</div>` : ''}

    ${images.length ? `<h3>Images</h3><div class="imgs">${images.map((src) => `<img src="${src}" />`).join('')}</div>` : ''}

    <div class="foot">
      <div>${esc(s.business_name)}${s.tagline ? ` — ${esc(s.tagline)}` : ''}</div>
      <div class="sign">Prepared by<b>${esc(b.prepared_by || s.business_name)}</b></div>
    </div>
  </div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Output

/** Render to a named PDF in the cache (native). */
async function renderPdf(b: Bill, s: BillSettings): Promise<string> {
  const html = await buildBillHtml(b, s);
  const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
  const named = `${FileSystem.cacheDirectory}${billFileName(b)}`;
  await FileSystem.deleteAsync(named, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: named });
  return named;
}

/** Share sheet — WhatsApp, email, Drive, Save to files… (print dialog on web). */
export async function shareBillPdf(b: Bill, s: BillSettings) {
  if (Platform.OS === 'web') {
    // The print dialog shows the bill; "Save as PDF" downloads it.
    await printHtmlOnWeb(await buildBillHtml(b, s), billFileName(b));
    return;
  }
  const uri = await renderPdf(b, s);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: billFileName(b) });
}

/** "98765 43210" / "+91-98765-43210" → "919876543210" (India by default). */
export function waNumber(phone: string | null | undefined): string | null {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

// Loaded lazily: the module calls TurboModuleRegistry.getEnforcing on import,
// which crashes the web bundle (react-native-web has no TurboModuleRegistry).
const nativeShare = (): typeof import('react-native-share') => require('react-native-share');

/** WhatsApp apps on this phone, normal first. */
async function installedWhatsApps(): Promise<('whatsapp' | 'whatsappbusiness')[]> {
  const check = async (pkg: string) => {
    try {
      return (await nativeShare().default.isPackageInstalled(pkg)).isInstalled;
    } catch {
      return false;
    }
  };
  const [normal, business] = await Promise.all([check('com.whatsapp'), check('com.whatsapp.w4b')]);
  return [...(normal ? ['whatsapp' as const] : []), ...(business ? ['whatsappbusiness' as const] : [])];
}

const askWhich = () =>
  new Promise<'whatsapp' | 'whatsappbusiness' | null>((resolve) =>
    Alert.alert('Send with', undefined, [
      { text: 'WhatsApp', onPress: () => resolve('whatsapp') },
      { text: 'WhatsApp Business', onPress: () => resolve('whatsappbusiness') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
    ])
  );

/**
 * Open the client's WhatsApp chat with the bill PDF attached, ready to send.
 * Asks which app when both WhatsApp and WhatsApp Business are installed.
 */
export async function sendBillOnWhatsApp(b: Bill, s: BillSettings, phone: string) {
  const to = waNumber(phone);
  if (!to) throw new Error('That phone number doesn’t look right');
  if (Platform.OS !== 'android') throw new Error('Sending to WhatsApp works from the Android app');

  const apps = await installedWhatsApps();
  if (apps.length === 0) throw new Error('WhatsApp isn’t installed on this phone');
  const app = apps.length === 1 ? apps[0] : await askWhich();
  if (!app) return;

  const uri = await renderPdf(b, s);
  const t = billTotals(b);
  const message = [
    `Hello${b.client_name ? ` ${b.client_name}` : ''},`,
    `Here are the details from ${s.business_name}${b.venue ? ` for ${b.venue}` : ''}${
      b.function_date ? ` on ${format(parseISO(b.function_date), 'd MMM yyyy')}` : ''
    }${b.number ? ` (${b.number})` : ''}.`,
    `Total ₹${money(t.total)} · Advance ₹${money(t.advance)} · Balance ₹${money(t.balance)}`,
  ].join('\n');

  // whatsAppNumber opens that chat directly; the library supports it on
  // Android but leaves it out of its types.
  const { default: Share, Social } = nativeShare();
  const social: SocialApp.Whatsapp | SocialApp.Whatsappbusiness =
    app === 'whatsapp' ? Social.Whatsapp : Social.Whatsappbusiness;
  const options = {
    social,
    whatsAppNumber: to,
    url: uri,
    type: 'application/pdf',
    filename: billFileName(b),
    message,
  };
  await Share.shareSingle(options);
}
