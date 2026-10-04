// ============================================================================
// VEBOSSO EMS — Navgrah Leads: Excel import / export, and saving to the phone
// Excel columns: dof, name, function, contact, remarks — one sheet per banquet
// (the sheet's name is the banquet). Import is forgiving: the header row can
// sit anywhere near the top, column names can vary ("DOF", "Date", "No.",
// "Phone"…), blank rows are skipped, and "7 Dec" without a year means the next
// 7 Dec (or one up to two months ago).
// Saving to the phone writes a contact card (.vcf) and hands it to the
// Contacts app, which asks once to save it — no extra app permission needed.
// ============================================================================

import { addMonths, format, isValid, parse, parseISO, setYear, subMonths } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { Lead, LeadInput } from '../types/database';
import { contactName } from './leads';

// ---------------------------------------------------------------------------
// Export

export const LEAD_COLUMNS = ['dof', 'name', 'function', 'contact', 'remarks'] as const;

const sheetName = (name: string, used: Set<string>) => {
  let n = name.replace(/[[\]:*?/\\]/g, ' ').trim().slice(0, 28) || 'Leads';
  let i = 2;
  while (used.has(n.toLowerCase())) n = `${n.slice(0, 26)} ${i++}`;
  used.add(n.toLowerCase());
  return n;
};

/** One sheet per banquet, in the import format, then shared / downloaded. */
export async function exportLeads(groups: { name: string; leads: Lead[] }[], fileBase: string): Promise<void> {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const g of groups) {
    const rows = [
      [...LEAD_COLUMNS],
      ...g.leads.map((l) => [
        l.dof ? format(parseISO(l.dof), 'd MMM yyyy') : '',
        l.name ?? '',
        l.function ?? '',
        l.contact ?? '',
        l.remarks ?? '',
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 24 }, { wch: 16 }, { wch: 16 }, { wch: 36 }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName(g.name, used));
  }
  const name = `${fileBase.replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'Navgrah Leads'}.xlsx`;

  if (Platform.OS === 'web') {
    XLSX.writeFile(wb, name);
    return;
  }
  const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, b64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    dialogTitle: name,
    UTI: 'org.openxmlformats.spreadsheetml.sheet',
  });
}

// ---------------------------------------------------------------------------
// Import

/** One sheet of a file: its name (the banquet) and the leads in it. */
export interface ParsedLeadSheet {
  sheet: string;
  leads: LeadInput[];
}

const norm = (v: unknown) =>
  String(v ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');

/** Which column a header names, or null. */
function columnOf(header: unknown): (typeof LEAD_COLUMNS)[number] | null {
  const h = norm(header);
  if (!h) return null;
  if (['dof', 'date', 'dateoffunction', 'functiondate', 'eventdate', 'day'].includes(h)) return 'dof';
  if (['name', 'clientname', 'client', 'customer', 'customername', 'person'].includes(h)) return 'name';
  if (['function', 'functiontype', 'event', 'eventtype', 'occasion', 'type'].includes(h)) return 'function';
  if (['contact', 'no', 'number', 'phone', 'phoneno', 'phonenumber', 'mobile', 'mobileno', 'contactno', 'contactnumber'].includes(h))
    return 'contact';
  if (['remarks', 'remark', 'notes', 'note', 'comment', 'comments'].includes(h)) return 'remarks';
  return null;
}

const FULL_FORMATS = [
  'd MMM yyyy', 'dd MMM yyyy', 'd MMMM yyyy', 'd-MMM-yyyy', 'dd-MMM-yyyy', 'd-MMM-yy', 'dd-MMM-yy',
  'dd-MM-yyyy', 'd-M-yyyy', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'dd-MM-yy', 'd/M/yy', 'dd/MM/yy',
  'yyyy-MM-dd', 'yyyy/MM/dd', 'MMM d, yyyy',
];
const NO_YEAR_FORMATS = ['d MMM', 'dd MMM', 'd MMMM', 'd-MMM', 'dd-MMM', 'MMM d', 'd/M', 'dd/MM'];

/** "7 Dec" → the next 7 Dec, unless that was within the last two months. */
function withYear(d: Date): Date {
  const now = new Date();
  const thisYear = setYear(d, now.getFullYear());
  if (thisYear >= subMonths(now, 2)) return thisYear;
  const next = setYear(d, now.getFullYear() + 1);
  return next <= addMonths(now, 12) ? next : thisYear;
}

/** → "yyyy-MM-dd", day first (Indian style), or null. */
function parseDof(v: unknown): string | null {
  if (v instanceof Date) return isValid(v) ? format(v, 'yyyy-MM-dd') : null;
  if (typeof v === 'number') {
    if (v < 20000 || v > 80000) return null;
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/(\d)(st|nd|rd|th)\b/gi, '$1');
  if (!s) return null;
  for (const f of FULL_FORMATS) {
    const d = parse(s, f, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) return format(d, 'yyyy-MM-dd');
  }
  for (const f of NO_YEAR_FORMATS) {
    const d = parse(s, f, new Date(2000, 0, 1));
    if (isValid(d)) return format(withYear(d), 'yyyy-MM-dd');
  }
  return null;
}

/** A phone number from a cell: 9837307364 (number) or "98373 07364". */
function cleanContact(v: unknown): string {
  if (typeof v === 'number') return String(Math.round(v));
  return String(v ?? '').trim();
}

function parseSheet(rows: unknown[][]): LeadInput[] {
  // The header row: the first of the top rows naming at least two columns.
  let headerAt = -1;
  let map: Partial<Record<(typeof LEAD_COLUMNS)[number], number>> = {};
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const found: typeof map = {};
    rows[r].forEach((cell, c) => {
      const col = columnOf(cell);
      if (col && found[col] === undefined) found[col] = c;
    });
    if (Object.keys(found).length >= 2) {
      headerAt = r;
      map = found;
      break;
    }
  }
  if (headerAt < 0) return [];

  const out: LeadInput[] = [];
  for (const row of rows.slice(headerAt + 1)) {
    const cell = (k: (typeof LEAD_COLUMNS)[number]) => (map[k] === undefined ? '' : row[map[k]!]);
    const lead: LeadInput = {
      banquet_id: null,
      dof: parseDof(cell('dof')),
      name: String(cell('name') ?? '').trim() || null,
      function: String(cell('function') ?? '').trim() || null,
      contact: cleanContact(cell('contact')) || null,
      remarks: String(cell('remarks') ?? '').trim() || null,
    };
    // Skip rows with nothing in them.
    if (!lead.dof && !lead.name && !lead.function && !lead.contact && !lead.remarks) continue;
    out.push(lead);
  }
  return out;
}

/** Pick an Excel / CSV file and read the leads in every sheet. */
export async function pickAndParseLeadsFile(): Promise<{ fileName: string; sheets: ParsedLeadSheet[] } | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type:
      Platform.OS === 'web'
        ? ['.xlsx', '.xls', '.csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel', 'text/csv']
        : ['*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = res.canceled ? null : res.assets?.[0];
  if (!asset) return null;

  const lower = asset.name.toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(lower)) throw new Error('Choose an Excel (.xlsx, .xls) or CSV file');
  const isCsv = lower.endsWith('.csv');

  let wb: XLSX.WorkBook;
  if (Platform.OS === 'web') {
    const buf = await (await fetch(asset.uri)).arrayBuffer();
    wb = XLSX.read(buf, { type: 'array', cellDates: true, raw: isCsv });
  } else {
    const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
    wb = XLSX.read(b64, { type: 'base64', cellDates: true, raw: isCsv });
  }

  const base = asset.name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
  const sheets: ParsedLeadSheet[] = [];
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: false });
    const leads = parseSheet(rows);
    if (!leads.length) continue;
    // "Sheet1" and CSVs take the file's name instead.
    const generic = isCsv || /^sheet\s*\d*$/i.test(name.trim());
    sheets.push({ sheet: (generic ? base : name.trim()).slice(0, 120) || 'Leads', leads });
  }
  return { fileName: asset.name, sheets };
}

// ---------------------------------------------------------------------------
// Saving to the phone's contacts

const vEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** One contact card per lead with a number, named "<name> <banquet> <dof> <function>". */
function buildVcf(leads: { lead: Lead; banquetName: string | null }[]): string {
  return leads
    .filter(({ lead }) => (lead.contact ?? '').trim())
    .map(({ lead, banquetName }) => {
      const full = contactName(lead, banquetName) || (lead.contact ?? '');
      const lines = [
        'BEGIN:VCARD',
        'VERSION:3.0',
        `FN:${vEscape(full)}`,
        `N:;${vEscape(full)};;;`,
        `TEL;TYPE=CELL:${(lead.contact ?? '').replace(/[^\d+]/g, '')}`,
      ];
      if (lead.remarks?.trim()) lines.push(`NOTE:${vEscape(lead.remarks.trim())}`);
      lines.push('END:VCARD');
      return lines.join('\r\n');
    })
    .join('\r\n');
}

/**
 * Hands the contact card(s) to the phone: on Android the Contacts app opens to
 * save them; on iPhone the share sheet offers Contacts; on the web it downloads
 * a .vcf file. Returns how many contacts were in it.
 */
export async function saveLeadsToPhone(leads: { lead: Lead; banquetName: string | null }[], fileBase: string): Promise<number> {
  const vcf = buildVcf(leads);
  const count = (vcf.match(/BEGIN:VCARD/g) || []).length;
  if (!count) throw new Error('No phone number to save');
  const name = `${fileBase.replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 60) || 'Lead'}.vcf`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([vcf], { type: 'text/vcard;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return count;
  }

  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, vcf, { encoding: FileSystem.EncodingType.UTF8 });

  if (Platform.OS === 'android') {
    const contentUri = await FileSystem.getContentUriAsync(uri);
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: 'text/x-vcard',
      });
      return count;
    } catch {
      // No app took it directly — offer the share sheet instead.
    }
  }
  await Sharing.shareAsync(uri, { mimeType: 'text/x-vcard', dialogTitle: 'Save to contacts', UTI: 'public.vcard' });
  return count;
}
