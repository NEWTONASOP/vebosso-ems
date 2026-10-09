// ============================================================================
// VEBOSSO EMS — Accounts export / import
// Export: PDF, Excel (.xlsx) or CSV → the system share sheet (or a download on
// web). Columns: Date · Particular · Credit · Debit.
// Import: Excel (.xlsx / .xls), CSV, or a bank statement PDF — password-
// protected Excel and PDF files too (the password is asked for and used only
// on the device). The header row is found by name, dates are read day-first
// (India), and every sheet that looks like a ledger becomes one importable
// account; a PDF statement becomes one, named after the bank ("SBI 5602").
// ============================================================================

import { format, parseISO } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { Account, AccountTransaction } from '../types/database';
import { money, num, Period, periodLabel, TxnInput } from './accounts';
import { parseAmount, parseDate } from './ledgerValues';
import { decryptOffice, isEncryptedOffice } from './officeCrypto';
import { PasswordNeededError } from './passwordError';
import { parsePdfStatement, statementName, type PdfItem } from './statementPdf';
import { printHtmlOnWeb } from './webPrint';

export type ExportFormat = 'pdf' | 'xlsx' | 'csv';

export interface LedgerForExport {
  account: Account;
  /** Newest first, already filtered to the period. */
  txns: AccountTransaction[];
}

const HEAD = ['Date', 'Particular', 'Credit(₹)', 'Debit(₹)'];

const displayDate = (iso: string) => format(parseISO(iso), 'dd-MM-yyyy');

function totals(txns: AccountTransaction[]) {
  let credit = 0;
  let debit = 0;
  for (const t of txns) {
    if (t.kind === 'credit') credit += num(t.amount);
    else debit += num(t.amount);
  }
  return { credit, debit, balance: credit - debit };
}

const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Accounts';

function fileBase(ledgers: LedgerForExport[], period: Period) {
  const who = ledgers.length === 1 ? ledgers[0].account.name : 'All accounts';
  const when = period ? format(period, 'MMM yyyy') : 'All time';
  return safeName(`${who} - ${when}`);
}

// ---------------------------------------------------------------------------
// Export

/** Build the file and hand it to the share sheet (download / print on web). */
export async function exportLedgers(
  ledgers: LedgerForExport[],
  period: Period,
  fmt: ExportFormat,
): Promise<void> {
  const base = fileBase(ledgers, period);
  if (fmt === 'xlsx') return shareXlsx(buildWorkbook(ledgers, period), `${base}.xlsx`);
  if (fmt === 'csv') return shareText(buildCsv(ledgers), `${base}.csv`, 'text/csv');
  return sharePdf(buildHtml(ledgers, period), `${base}.pdf`);
}

function ledgerAoa(txns: AccountTransaction[]): (string | number)[][] {
  const t = totals(txns);
  return [
    HEAD,
    ...txns.map((x) => [
      displayDate(x.txn_date),
      x.particular ?? '',
      x.kind === 'credit' ? num(x.amount) : 0,
      x.kind === 'debit' ? num(x.amount) : 0,
    ]),
    [],
    ['', 'Total', t.credit, t.debit],
    ['', 'Balance (Credit − Debit)', t.balance, ''],
  ];
}

function buildWorkbook(ledgers: LedgerForExport[], period: Period): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const cols = [{ wch: 12 }, { wch: 40 }, { wch: 14 }, { wch: 14 }];

  if (ledgers.length > 1) {
    const rows: (string | number)[][] = [
      ['Accounts summary', periodLabel(period)],
      [],
      ['Account', 'Credit(₹)', 'Debit(₹)', 'Balance(₹)'],
    ];
    let c = 0;
    let d = 0;
    for (const l of ledgers) {
      const t = totals(l.txns);
      c += t.credit;
      d += t.debit;
      rows.push([l.account.name, t.credit, t.debit, t.balance]);
    }
    rows.push([], ['All accounts', c, d, c - d]);
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Summary');
  }

  const used = new Set<string>(['Summary']);
  for (const l of ledgers) {
    // Sheet names: max 31 chars, no []:*?/\ and unique.
    let name = l.account.name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Account';
    let n = 2;
    while (used.has(name)) name = `${name.slice(0, 26)} ${n++}`;
    used.add(name);
    const ws = XLSX.utils.aoa_to_sheet(ledgerAoa(l.txns));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return wb;
}

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function buildCsv(ledgers: LedgerForExport[]): string {
  const multi = ledgers.length > 1;
  const lines: string[] = [(multi ? ['Account', ...HEAD] : HEAD).map(csvCell).join(',')];
  for (const l of ledgers) {
    for (const x of l.txns) {
      const row = [
        displayDate(x.txn_date),
        x.particular ?? '',
        x.kind === 'credit' ? num(x.amount) : 0,
        x.kind === 'debit' ? num(x.amount) : 0,
      ];
      lines.push((multi ? [l.account.name, ...row] : row).map(csvCell).join(','));
    }
  }
  // BOM so Excel opens ₹ and other characters correctly.
  return '\uFEFF' + lines.join('\r\n');
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function buildHtml(ledgers: LedgerForExport[], period: Period): string {
  const all = ledgers.flatMap((l) => l.txns);
  const grand = totals(all);

  const section = (l: LedgerForExport) => {
    const t = totals(l.txns);
    const rows = l.txns
      .map(
        (x) => `<tr class="${x.kind}">
          <td>${displayDate(x.txn_date)}</td>
          <td>${esc(x.particular ?? '')}</td>
          <td class="n">${x.kind === 'credit' ? money(x.amount) : '0'}</td>
          <td class="n">${x.kind === 'debit' ? money(x.amount) : '0'}</td>
        </tr>`,
      )
      .join('');
    return `<section>
      <h2>${esc(l.account.name)}</h2>
      <table>
        <thead><tr><th>Date</th><th>Particular</th><th class="n">Credit(₹)</th><th class="n">Debit(₹)</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="4" class="empty">No entries</td></tr>'}</tbody>
        <tfoot>
          <tr><td></td><td>Total</td><td class="n">${money(t.credit)}</td><td class="n">${money(t.debit)}</td></tr>
          <tr><td></td><td>Balance (Credit − Debit)</td><td class="n" colspan="2">${t.balance < 0 ? '−' : ''}₹${money(Math.abs(t.balance))}</td></tr>
        </tfoot>
      </table>
    </section>`;
  };

  return `<!doctype html><html><head><meta charset="utf-8" />
  <style>
    body { font-family: -apple-system, Roboto, Arial, sans-serif; color: #0F1116; padding: 24px;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h1 { font-size: 20px; margin: 0; }
    .sub { color: #6B7280; font-size: 12px; margin: 4px 0 16px; }
    .cards { display: flex; gap: 10px; margin-bottom: 18px; }
    .card { flex: 1; border: 1px solid #DCE1EA; border-radius: 10px; padding: 10px 12px; }
    .card b { display: block; font-size: 16px; margin-top: 2px; }
    .card span { font-size: 11px; color: #6B7280; text-transform: uppercase; letter-spacing: .4px; }
    h2 { font-size: 15px; margin: 22px 0 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #20242B; color: #fff; text-align: left; padding: 7px 8px; font-weight: 600; }
    td { padding: 6px 8px; border-bottom: 1px solid #EAEDF3; }
    .n { text-align: right; white-space: nowrap; }
    tr.credit td:first-child, tr.credit td:nth-child(2) { color: #08875D; }
    tr.debit td:first-child, tr.debit td:nth-child(2) { color: #D0304C; }
    tfoot td { font-weight: 700; background: #F3F5F8; }
    .empty { color: #6B7280; text-align: center; }
    section { page-break-inside: auto; }
  </style></head><body>
    <h1>${esc(ledgers.length === 1 ? ledgers[0].account.name : 'All accounts')}</h1>
    <div class="sub">${esc(periodLabel(period))} · exported ${format(new Date(), 'd MMM yyyy, h:mm a')} · VEBOSSO EMS</div>
    <div class="cards">
      <div class="card"><span>Credit</span><b>₹${money(grand.credit)}</b></div>
      <div class="card"><span>Debit</span><b>₹${money(grand.debit)}</b></div>
      <div class="card"><span>Balance</span><b>${grand.balance < 0 ? '−' : ''}₹${money(Math.abs(grand.balance))}</b></div>
    </div>
    ${ledgers.map(section).join('')}
  </body></html>`;
}

async function shareFile(uri: string, mimeType: string, name: string) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: name, UTI: undefined });
}

async function shareXlsx(wb: XLSX.WorkBook, name: string) {
  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, name);
    return;
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  await shareFile(uri, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', name);
}

async function shareText(text: string, name: string, mime: string) {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, text, { encoding: FileSystem.EncodingType.UTF8 });
  await shareFile(uri, mime, name);
}

async function sharePdf(html: string, name: string) {
  if (Platform.OS === 'web') {
    // The print dialog shows the ledger; "Save as PDF" downloads it.
    await printHtmlOnWeb(html, name);
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  // Give the file a readable name before sharing it.
  const named = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.deleteAsync(named, { idempotent: true });
  await FileSystem.moveAsync({ from: uri, to: named });
  await shareFile(named, 'application/pdf', name);
}

// ---------------------------------------------------------------------------
// Import

export interface ParsedLedger {
  /** Sheet name (or file name for a single CSV). */
  name: string;
  entries: TxnInput[];
  /** Rows that looked like data but couldn't be read (no date / amount). */
  skipped: number;
  credit: number;
  debit: number;
  from: string | null;
  to: string | null;
}

const IMPORT_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'text/comma-separated-values',
  'application/csv',
  'application/pdf',
];

/** A file picked for import, read into memory. */
export interface PickedFile {
  name: string;
  kind: 'pdf' | 'excel' | 'csv';
  bytes: Uint8Array;
  /** The same bytes as base64 (what the PDF reader takes on a phone). */
  base64: string;
}

/** Reads a PDF's text (PDF.js — see PdfTextReader). */
export type PdfReader = (file: PickedFile, password?: string) => Promise<PdfItem[][]>;

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Let the person pick an Excel, CSV or PDF file. null when they cancel. */
export async function pickLedgerFile(): Promise<PickedFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: Platform.OS === 'web' ? ['.xlsx', '.xls', '.csv', '.pdf', ...IMPORT_TYPES] : ['*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;

  const lower = asset.name.toLowerCase();
  const kind = lower.endsWith('.pdf') ? 'pdf' : lower.endsWith('.csv') ? 'csv' : /\.(xlsx|xls)$/.test(lower) ? 'excel' : null;
  if (!kind) throw new Error('Choose an Excel (.xlsx, .xls), CSV or PDF file');

  if (Platform.OS === 'web') {
    const bytes = new Uint8Array(await (await fetch(asset.uri)).arrayBuffer());
    return { name: asset.name, kind, bytes, base64: kind === 'pdf' ? '' : bytesToB64(bytes) };
  }
  const base64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
  return { name: asset.name, kind, bytes: b64ToBytes(base64), base64 };
}

/**
 * Every ledger-looking sheet (or the PDF statement) in a picked file.
 * Throws PasswordNeededError when the file is protected and no — or the
 * wrong — password was given.
 */
export async function parseLedgerFile(
  file: PickedFile,
  opts: { password?: string; readPdf: PdfReader },
): Promise<{ fileName: string; ledgers: ParsedLedger[] }> {
  const baseName = cleanName(file.name.replace(/\.[^.]+$/, '').replace(/\.(pd|xl)$/i, ''));

  if (file.kind === 'pdf') {
    const pages = await opts.readPdf(file, opts.password);
    return { fileName: file.name, ledgers: parsePdfStatement(pages, baseName) };
  }

  const isCsv = file.kind === 'csv';
  let bytes = file.bytes;
  // A password-protected Excel file: unlock it here, on the device.
  if (!isCsv && isEncryptedOffice(bytes)) {
    if (!opts.password) throw new PasswordNeededError(false);
    bytes = decryptOffice(bytes, opts.password);
  }

  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(bytes, { type: 'array', cellDates: true, raw: isCsv });
  } catch (e: any) {
    // Older protection the unlock above doesn't cover.
    if (/password/i.test(e?.message ?? '')) {
      throw new Error('This Excel file uses an older kind of password the app can’t open. Save it again without a password, or as a newer Excel file.');
    }
    throw e;
  }

  const ledgers: ParsedLedger[] = [];
  for (const sheetName of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
      header: 1,
      raw: true,
      defval: '',
      blankrows: false,
    });
    // A CSV exported with an "Account" column holds several accounts.
    const sheet = cleanName(sheetName.replace(/\s+sheet$/i, ''));
    const generic = !sheet || /^(sheet\s*\d*|statement)$/i.test(sheet);
    const parsed = parseRows(rows, isCsv || generic ? baseName : sheet);
    ledgers.push(...parsed);
  }
  return { fileName: file.name, ledgers: ledgers.filter((l) => l.entries.length > 0) };
}

/** "Rahul_230926210620" → "Rahul" — drop export timestamps and stray separators. */
function cleanName(name: string): string {
  return name
    .replace(/[_\s-]*\d{8,}$/, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

const norm = (v: unknown) => String(v ?? '').toLowerCase().replace(/[^a-z/+-]/g, ' ').replace(/\s+/g, ' ').trim();

function findCol(header: string[], tests: RegExp[], skip: number[] = []): number {
  for (const re of tests) {
    const i = header.findIndex((h, idx) => !skip.includes(idx) && re.test(h));
    if (i !== -1) return i;
  }
  return -1;
}

/** A "Cr/Dr" or "Type" column says which way an Amount goes — never an amount itself. */
const TYPE_TESTS = [/^type$/, /transaction type/, /cr ?\/ ?dr/, /dr ?\/ ?cr/, /\btype\b/];

/** Rows → one ledger (or several, when there's an Account column). */
function parseRows(rows: unknown[][], fallbackName: string): ParsedLedger[] {
  // Find the header row in the first 25 rows.
  let h = -1;
  let cols = { date: -1, particular: -1, credit: -1, debit: -1, amount: -1, type: -1, account: -1 };
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const header = (rows[i] || []).map(norm);
    const type = findCol(header, TYPE_TESTS);
    const skip = type === -1 ? [] : [type];
    // The transaction date first — bank statements also have a Value Date.
    const date = findCol(header, [/^date$/, /^(txn|tran|trans|transaction|posting) ?date/, /\bdate\b/, /^dt$/]);
    const credit = findCol(
      header,
      [/^credit/, /\bcredit\b/, /^cr$/, /^cr amount/, /\bcr amount\b/, /^deposit/, /\bdeposit/, /\breceived\b/, /^in$/],
      skip,
    );
    const debit = findCol(
      header,
      [/^debit/, /\bdebit\b/, /^dr$/, /^dr amount/, /\bdr amount\b/, /^withdraw/, /\bwithdraw/, /\bpaid\b/, /^out$/],
      skip,
    );
    const amount = findCol(header, [/^amount/, /\bamount\b/], skip);
    if (date !== -1 && (credit !== -1 || debit !== -1 || amount !== -1)) {
      h = i;
      cols = {
        date,
        credit,
        debit,
        amount,
        particular: findCol(header, [/particular/, /description/, /narration/, /remark/, /detail/, /\bnote/, /purpose/, /item/]),
        type,
        account: findCol(header, [/^account/, /\bparty\b/, /^name$/]),
      };
      break;
    }
  }
  if (h === -1) return [];
  const named = statementName(rows.slice(0, h).map((r) => (r || []).join(' ')).join('\n'));
  if (named) fallbackName = named;

  const byAccount = new Map<string, ParsedLedger>();
  const bucket = (name: string) => {
    let l = byAccount.get(name);
    if (!l) {
      l = { name, entries: [], skipped: 0, credit: 0, debit: 0, from: null, to: null };
      byAccount.set(name, l);
    }
    return l;
  };

  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const name = cols.account !== -1 ? String(r[cols.account] ?? '').trim() || fallbackName : fallbackName;
    const cells = r.map((c) => String(c ?? '').trim());
    if (cells.every((c) => !c)) continue;

    const date = parseDate(r[cols.date]);
    const ledger = bucket(name);
    if (!date) {
      // Totals, balance, notes and footer lines have no date — just skip
      // them. Only count a row as unreadable when its date cell has
      // something in it that isn't a date.
      const dateCell = String(r[cols.date] ?? '').trim();
      const looksLikeFooter = cells.some((c) => /total|balance|opening|closing/i.test(c));
      if (dateCell && !looksLikeFooter) ledger.skipped++;
      continue;
    }

    const particular = cols.particular !== -1 ? String(r[cols.particular] ?? '').trim() || null : null;
    const found: TxnInput[] = [];

    if (cols.credit !== -1 || cols.debit !== -1) {
      const c = cols.credit !== -1 ? parseAmount(r[cols.credit]) : 0;
      const d = cols.debit !== -1 ? parseAmount(r[cols.debit]) : 0;
      if (c > 0) found.push({ txn_date: date, kind: 'credit', amount: c, particular });
      if (d > 0) found.push({ txn_date: date, kind: 'debit', amount: d, particular });
      // A signed single column ("-500") under Credit/Debit.
      if (c < 0) found.push({ txn_date: date, kind: 'debit', amount: -c, particular });
      if (d < 0) found.push({ txn_date: date, kind: 'credit', amount: -d, particular });
    } else if (cols.amount !== -1) {
      const a = parseAmount(r[cols.amount]);
      const type = cols.type !== -1 ? norm(r[cols.type]) : '';
      if (a !== 0) {
        const isDebit = /\bdr\b|debit|out|paid|-/.test(type) || (!type && a < 0);
        found.push({ txn_date: date, kind: isDebit ? 'debit' : 'credit', amount: Math.abs(a), particular });
      }
    }

    if (found.length === 0) {
      ledger.skipped++;
      continue;
    }
    for (const e of found) {
      ledger.entries.push(e);
      if (e.kind === 'credit') ledger.credit += e.amount;
      else ledger.debit += e.amount;
      if (!ledger.from || e.txn_date < ledger.from) ledger.from = e.txn_date;
      if (!ledger.to || e.txn_date > ledger.to) ledger.to = e.txn_date;
    }
  }
  return [...byAccount.values()];
}
