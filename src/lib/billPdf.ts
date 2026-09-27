// ============================================================================
// VEBOSSO EMS — Bill PDF
// Builds the printable bill, shares it, or sends it straight to the number on
// the bill over WhatsApp as the PDF itself. Each bill wears its brand's logo
// and watermark (VEBOSSO / Navgrah); client bills also get the brand colours
// as a gradient border, estimates stay neutral with an "Event Booking
// Estimate" badge. A bill changed after saving shows when it was revised.
// ============================================================================

import { format, parseISO } from 'date-fns';
import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { Bill, BillBrand, BillSettings } from '../types/database';
import { money } from './accounts';
import { Alert } from './alert';
import { BRANDS, brandOf } from './billBrands';
import { billTotals, signBillImages } from './bills';
import { printHtmlOnWeb } from './webPrint';
import * as WhatsApp from '../../modules/whatsapp-share';

const esc = (s: string | null | undefined) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const nl = (s: string | null | undefined) => esc(s).replace(/\n/g, '<br/>');

export function billFileName(b: Bill) {
  const who = (b.client_name ?? '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 40);
  return `${who || BRANDS[brandOf(b)].label}${b.number ? ` - ${b.number}` : ''}.pdf`;
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

const assetCache = new Map<number, string | null>();
async function assetDataUri(moduleId: number): Promise<string | null> {
  if (assetCache.has(moduleId)) return assetCache.get(moduleId) ?? null;
  const asset = Asset.fromModule(moduleId);
  await asset.downloadAsync();
  const uri = await toDataUri(asset.localUri ?? asset.uri, 'image/png');
  assetCache.set(moduleId, uri);
  return uri;
}

const logoFor = (brand: BillBrand) =>
  brand === 'navgrah'
    ? assetDataUri(require('../../assets/images/navgrah-logo.png'))
    : assetDataUri(require('../../assets/images/vebosso-logo.png'));

/** VEBOSSO: the lettering alone, as flat grey. Navgrah: its logo, faded. */
const watermarkFor = (brand: BillBrand) =>
  brand === 'navgrah'
    ? assetDataUri(require('../../assets/images/navgrah-logo.png'))
    : assetDataUri(require('../../assets/images/vebosso-wordmark.png'));

// ---------------------------------------------------------------------------
// Amount in words (Indian system: thousand, lakh, crore)

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function underHundred(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ''}`;
}

function underThousand(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : '', rest ? underHundred(rest) : ''].filter(Boolean).join(' ');
}

export function rupeesInWords(amount: number): string {
  let n = Math.floor(Math.abs(amount));
  if (n === 0) return 'Rupees Zero Only';
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underHundred(lakh)} Lakh`);
  if (thousand) parts.push(`${underHundred(thousand)} Thousand`);
  if (n) parts.push(underThousand(n));
  return `Rupees ${parts.join(' ')} Only`;
}

// ---------------------------------------------------------------------------
// HTML

/*
 * Page margins. The page itself has none (@page margin 0): a web browser
 * would print its own header/footer (address, date, title) in any margin, and
 * the client-bill border has to sit on the paper's edge. Space at the top and
 * bottom of every page comes from .sheet's padding, repeated on each printed
 * page (box-decoration-break: clone); page 1's header pulls up into it.
 */
const PAGE_GAP = '14mm';

/** Colours for one bill: its brand's on client bills, neutral on estimates. */
function paletteFor(b: Bill) {
  const brand = brandOf(b);
  const t = BRANDS[brand];
  const client = b.kind === 'client';
  const [c0, c1, c2] = t.colors;
  const gradient = `linear-gradient(135deg, ${c0} 0%, ${c1} 55%, ${c2} 100%)`;
  const dark = t.logoOnDark;
  return {
    brand,
    client,
    colors: t.colors,
    gradient: client ? gradient : null,
    /** Headings, table head, balance bar. */
    ink: client ? t.primary : '#1B1E24',
    // VEBOSSO keeps its original charcoal header on every bill.
    headBg: dark ? '#1B1E24' : '#FFFFFF',
    headInk: dark ? '#FFFFFF' : '#1B1E24',
    headMute: dark ? 'rgba(255,255,255,.66)' : '#8A8398',
    numberInk: client ? (dark ? t.accent : t.primary) : dark ? '#FFFFFF' : '#1B1E24',
    kindBg: dark ? 'rgba(255,255,255,.14)' : '#F1EFF4',
    kindInk: dark ? '#FFFFFF' : '#4A4556',
    revisedInk: dark ? '#F0C987' : '#B7791F',
    contactInk: dark ? '#DCD0EE' : '#4A4556',
    contactRule: dark ? 'rgba(255,255,255,.16)' : '#ECE8F3',
    balanceInk: client ? (dark ? t.accent : '#FFE3F1') : '#FFFFFF',
    logoHeight: dark ? 58 : 86,
  };
}

export async function buildBillHtml(b: Bill, s: BillSettings): Promise<string> {
  const p = paletteFor(b);
  const [logo, watermark] = await Promise.all([logoFor(p.brand), watermarkFor(p.brand)]);
  const signed = await signBillImages(b.images ?? []);
  const images = (await Promise.all((b.images ?? []).map((x) => (signed[x] ? toDataUri(signed[x]) : null)))).filter(
    (x): x is string => !!x
  );
  const t = billTotals(b);
  const items = (b.items ?? []).filter((i) => i.description?.trim());
  const date = b.function_date ? format(parseISO(b.function_date), 'EEE, d MMM yyyy') : '';

  const kv = (label: string, value: string | null | undefined) =>
    value ? `<div class="kv"><span>${label}</span><b>${nl(value)}</b></div>` : '';

  // Business details: a line of their own along the bottom of the header.
  const contact = [
    s.address ? esc(s.address).replace(/\n/g, ' ') : null,
    s.phone ? esc(s.phone) : null,
    s.email ? esc(s.email) : null,
    s.website ? esc(s.website) : null,
  ].filter(Boolean) as string[];

  const eventRows = [
    kv('Venue', b.venue),
    kv('Hall / Floor', b.hall_floor),
    kv('Date', date),
    kv('Timing', b.timing),
    kv('Event type', b.event_type),
    kv('Guests', b.guests),
  ].join('');

  const clientRows = [kv('Phone', b.phone), kv('Alternate', b.alt_phone), kv('Address', b.address)].join('');

  return `<!doctype html><html><head><meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  body { position: relative; margin: 0; font-family: -apple-system, Roboto, 'Segoe UI', Arial, sans-serif; color: #1B1E24;
    font-size: 12px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .sheet { padding: ${PAGE_GAP} 0; -webkit-box-decoration-break: clone; box-decoration-break: clone; }
  .sheet > .head { margin-top: -${PAGE_GAP}; }

  /* Client bills: the brand colours as a border round every page — four
     gradient bars whose colours meet at the corners (border-image on a
     repeated print element draws only partly in Chrome). */
  .frame { position: absolute; inset: 0; pointer-events: none; z-index: 6; }
  .frame i { position: absolute; display: block; }
  .frame .t { top: 0; left: 0; right: 0; height: 7px; background: linear-gradient(90deg, ${p.colors.join(', ')}); }
  .frame .r { top: 0; right: 0; bottom: 0; width: 7px; background: linear-gradient(180deg, ${[...p.colors].reverse().join(', ')}); }
  .frame .b { left: 0; right: 0; bottom: 0; height: 7px; background: linear-gradient(90deg, ${[...p.colors].reverse().join(', ')}); }
  .frame .l { top: 0; left: 0; bottom: 0; width: 7px; background: linear-gradient(180deg, ${p.colors.join(', ')}); }
  /* Watermark on top of everything (tinted rows can't hide it), very faint. */
  .wm { position: absolute; left: 50%; top: 560px; transform: translate(-50%, -50%); pointer-events: none; z-index: 5; }
  .wm.vebosso { width: 86%; transform: translate(-50%, -50%) rotate(-28deg); filter: grayscale(1) brightness(0); opacity: .06; }
  .wm.navgrah { width: 60%; opacity: .07; }
  @media print { .frame, .wm { position: fixed; } .wm { top: 50%; } }

  .head { padding: 20px 40px 0; background: ${p.headBg}; color: ${p.headInk}; }
  .head .top { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding-bottom: 14px; }
  .head .logo { height: ${p.logoHeight}px; display: block; }
  .head .brandname { font-size: 24px; font-weight: 800; letter-spacing: 1px; }
  .doc { text-align: right; }
  .doc .kind { display: inline-block; font-size: 9.5px; font-weight: 800; letter-spacing: 1.8px; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px; background: ${p.kindBg}; color: ${p.kindInk}; margin-bottom: 8px; }
  .doc .no { font-size: 22px; font-weight: 800; letter-spacing: 1px; color: ${p.numberInk}; }
  .doc .meta { font-size: 11px; margin-top: 3px; color: ${p.headMute}; }
  .doc .rev { font-size: 10.5px; margin-top: 3px; font-weight: 600; color: ${p.revisedInk}; }
  .band { height: ${p.gradient ? '5px' : p.headBg === '#FFFFFF' ? '1px' : '0'}; background: ${p.gradient ?? '#E7E4EE'}; }
  .biz { display: flex; flex-wrap: wrap; justify-content: center; gap: 2px 0; padding: 8px 0 10px;
    border-top: 1px solid ${p.contactRule}; font-size: 10.5px; color: ${p.contactInk}; }
  .biz span { white-space: nowrap; }
  .biz span + span::before { content: '•'; margin: 0 10px; opacity: .5; }

  .wrap { padding: 18px 40px 22px; }
  .cards { display: flex; gap: 14px; }
  .card { flex: 1; border: 1px solid #E7E4EE; border-radius: 12px; padding: 12px 14px; background: #fff; }
  .card h4 { margin: 0 0 8px; font-size: 9.5px; letter-spacing: 1.3px; text-transform: uppercase; color: ${p.ink}; }
  .client { font-size: 18px; font-weight: 800; margin: 0 0 6px; line-height: 1.25; }
  .kv { display: flex; gap: 10px; padding: 2.5px 0; font-size: 11.5px; line-height: 1.4; }
  .kv span { width: 76px; flex-shrink: 0; color: #8A8398; }
  .kv b { font-weight: 600; }
  h3 { display: flex; align-items: center; gap: 10px; font-size: 10.5px; letter-spacing: 1.3px; text-transform: uppercase;
    color: ${p.ink}; margin: 18px 0 8px; }
  h3::after { content: ''; flex: 1; height: 1px; background: #ECE8F3; }

  table { width: 100%; border-collapse: separate; border-spacing: 0; border: 1px solid #E7E4EE; border-radius: 12px; overflow: hidden; }
  th { text-align: left; font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: #fff; background: ${p.ink}; padding: 9px 12px; }
  td { padding: 7px 12px; border-top: 1px solid #F0EDF5; vertical-align: top; font-size: 12px; line-height: 1.45; background: #fff; }
  tbody tr:first-child td { border-top: 0; }
  tbody tr:nth-child(even) td { background: #FAF9FC; }
  td.no { width: 44px; color: #8A8398; font-weight: 700; }
  .empty { color: #8A8398; text-align: center; }

  .money { display: flex; gap: 14px; margin-top: 14px; align-items: stretch; }
  .words { flex: 1; border: 1px dashed #D8D2E2; border-radius: 12px; padding: 12px 14px; font-size: 11.5px; line-height: 1.5; background: #fff; }
  .words span { display: block; font-size: 9.5px; letter-spacing: 1.2px; text-transform: uppercase; color: #8A8398; margin-bottom: 4px; }
  .sum { width: 44%; border: 1px solid #E7E4EE; border-radius: 12px; overflow: hidden; background: #fff; }
  .sum .row { display: flex; justify-content: space-between; padding: 8px 14px; font-size: 12.5px; }
  .sum .row + .row { border-top: 1px solid #F0EDF5; }
  .sum .bal { background: ${p.ink}; color: #fff; font-weight: 800; font-size: 14px; padding: 11px 14px; }
  .sum .bal b { color: ${p.balanceInk}; }

  .terms { font-size: 10.5px; color: #4A4556; line-height: 1.65; border: 1px solid #E7E4EE; border-radius: 12px; padding: 12px 14px; background: #fff; }

  .signs { display: flex; justify-content: space-between; gap: 48px; margin-top: 30px; }
  .sig { flex: 1; max-width: 45%; }
  .sig .line { border-top: 1px solid #1B1E24; padding-top: 6px; font-size: 10.5px; color: #8A8398; }
  .sig.r { text-align: right; }
  .sig .name { font-size: 12px; font-weight: 700; color: #1B1E24; margin-bottom: 6px; min-height: 16px; }

  .imgs { break-before: page; page-break-before: always; }
  .imgs img { display: block; max-width: 100%; max-height: 240mm; width: auto; height: auto; margin: 0 auto 14px;
    border-radius: 10px; break-inside: avoid; page-break-inside: avoid; }

  tr, .kv, .card, .money, .terms, .signs { break-inside: avoid; page-break-inside: avoid; }
</style></head><body>
  ${p.gradient ? '<div class="frame"><i class="t"></i><i class="r"></i><i class="b"></i><i class="l"></i></div>' : ''}
  ${watermark ? `<img class="wm ${p.brand}" src="${watermark}" alt="" />` : ''}
  <div class="sheet">
  <div class="head">
    <div class="top">
    ${logo ? `<img class="logo" src="${logo}" alt="" />` : `<div class="brandname">${esc(s.business_name)}</div>`}
    <div class="doc">
      ${b.kind === 'estimate' ? '<div class="kind">Event Booking Estimate</div>' : ''}
      <div class="no">${esc(b.number ?? '')}</div>
      <div class="meta">Date ${format(new Date(), 'd MMM yyyy')}</div>
      ${b.edited_at ? `<div class="rev">Revised ${format(new Date(b.edited_at), 'd MMM yyyy, h:mm a')}</div>` : ''}
    </div>
    </div>
    ${contact.length ? `<div class="biz">${contact.map((c) => `<span>${c}</span>`).join('')}</div>` : ''}
  </div>
  <div class="band"></div>

  <div class="wrap">
    <div class="cards">
      <div class="card">
        <h4>Prepared for</h4>
        <div class="client">${esc(b.client_name || '—')}</div>
        ${clientRows}
      </div>
      <div class="card">
        <h4>Event</h4>
        ${eventRows || '<div class="kv"><span>—</span></div>'}
      </div>
    </div>

    <h3>Services by ${esc(s.business_name)}</h3>
    <table>
      <thead><tr><th style="width:44px">#</th><th>Service</th></tr></thead>
      <tbody>
        ${
          items.length
            ? items.map((i, n) => `<tr><td class="no">${String(n + 1).padStart(2, '0')}</td><td>${nl(i.description)}</td></tr>`).join('')
            : '<tr><td colspan="2" class="empty">—</td></tr>'
        }
      </tbody>
    </table>

    <div class="money">
      <div class="words"><span>Total in words</span>${esc(rupeesInWords(t.total))}</div>
      <div class="sum">
        <div class="row"><span>Total</span><span>₹${money(t.total)}</span></div>
        <div class="row"><span>Advance</span><span>₹${money(t.advance)}</span></div>
        <div class="row bal"><span>Balance</span><b>₹${money(t.balance)}</b></div>
      </div>
    </div>

    ${b.terms ? `<h3>Terms &amp; conditions</h3><div class="terms">${nl(b.terms)}</div>` : ''}

    <div class="signs">
      <div class="sig"><div class="name"></div><div class="line">Customer signature</div></div>
      <div class="sig r">
        <div class="name">${esc(b.prepared_by || '')}</div>
        <div class="line">For ${esc(s.business_name)}</div>
      </div>
    </div>

    ${images.length ? `<div class="imgs"><h3>Images</h3>${images.map((src) => `<img src="${src}" alt="" />`).join('')}</div>` : ''}
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

/** WhatsApp apps on this phone, normal first. */
function installedWhatsApps(): string[] {
  return [WhatsApp.WHATSAPP, WhatsApp.WHATSAPP_BUSINESS].filter((pkg) => WhatsApp.isInstalled(pkg));
}

const askWhich = () =>
  new Promise<string | null>((resolve) =>
    Alert.alert('Send with', undefined, [
      { text: 'WhatsApp', onPress: () => resolve(WhatsApp.WHATSAPP) },
      { text: 'WhatsApp Business', onPress: () => resolve(WhatsApp.WHATSAPP_BUSINESS) },
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
  if (!WhatsApp.isAvailable()) throw new Error('Sending on WhatsApp needs the installed app (not Expo Go)');

  const apps = installedWhatsApps();
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

  // WhatsApp needs a content:// link it is allowed to read.
  const contentUri = await FileSystem.getContentUriAsync(uri);
  await WhatsApp.sendFile(app, to, contentUri, 'application/pdf', message);
}
