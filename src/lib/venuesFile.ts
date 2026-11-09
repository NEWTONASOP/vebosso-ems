// ============================================================================
// VEBOSSO EMS — Venues: Excel / CSV import
// One row per venue. Columns: date met, venue, location, city, brand, and the
// person met there (role, name, phone, email). More people: the same columns
// with a number ("name 2", "phone 2"…). Import is forgiving: the header row can
// sit anywhere near the top, column names can vary ("Hotel", "Mobile",
// "Designation"…), blank rows are skipped, every sheet is read. A missing date
// means today; "7 Dec" without a year means the last 7 Dec.
// ============================================================================

import { format, isValid, parse, setYear, subYears } from 'date-fns';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import * as XLSX from 'xlsx';
import { VenueContact } from '../types/database';
import { isValidEmail } from './venues';

/** One venue read from the file. City and brand are names, as written. */
export interface ParsedVenue {
  /** Where it came from, for messages: "row 7" or "Delhi, row 7". */
  at: string;
  met_on: string;
  venue_name: string;
  location: string | null;
  city: string | null;
  brand: string | null;
  contacts: VenueContact[];
}

export interface ParsedVenueFile {
  fileName: string;
  venues: ParsedVenue[];
  /** Rows left out or changed, and why. */
  notes: string[];
}

type VenueField = 'date' | 'venue' | 'location' | 'city' | 'brand';
type PersonField = 'role' | 'name' | 'phone' | 'email';
type Column = { field: VenueField; person?: undefined } | { field: PersonField; person: number };

const MAX_PEOPLE = 30; // chk_venue_contacts (040)

/** Which column a header names, or null. */
function columnOf(header: unknown): Column | null {
  const raw = String(header ?? '').toLowerCase();
  const h = raw.replace(/[^a-z]/g, '');
  if (!h) return null;

  if (['date', 'datemet', 'meton', 'metdate', 'dateofmeeting', 'meetingdate', 'day'].includes(h)) return { field: 'date' };
  if (['venue', 'venuename', 'hotel', 'hotelname', 'property', 'propertyname', 'banquet', 'banquetname'].includes(h))
    return { field: 'venue' };
  if (['location', 'address', 'area', 'place', 'locality'].includes(h)) return { field: 'location' };
  if (h === 'city') return { field: 'city' };
  if (h === 'brand' || h === 'brandname') return { field: 'brand' };

  // The person met: "Name", "Person 2 name", "Contact person", "Their phone"…
  const person = Math.min(Math.max(Number(raw.match(/\d+/)?.[0] ?? 1), 1), MAX_PEOPLE) - 1;
  if (h === 'contact') return { field: 'phone', person };
  const p = h.replace(/^(person|contact|their)/, '');
  if (['role', 'metrole', 'designation', 'position', 'post', 'title'].includes(p)) return { field: 'role', person };
  if (['', 'name', 'met', 'fullname', 'personmet', 'person', 'metname'].includes(p)) return { field: 'name', person };
  if (['phone', 'mobile', 'number', 'no', 'phoneno', 'phonenumber', 'mobileno', 'mobilenumber', 'contactno', 'whatsapp'].includes(p))
    return { field: 'phone', person };
  if (['email', 'mail', 'emailid', 'emailaddress', 'mailid'].includes(p)) return { field: 'email', person };
  return null;
}

const FULL_FORMATS = [
  'd MMM yyyy', 'dd MMM yyyy', 'd MMMM yyyy', 'd-MMM-yyyy', 'dd-MMM-yyyy', 'd-MMM-yy', 'dd-MMM-yy',
  'dd-MM-yyyy', 'd-M-yyyy', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'dd-MM-yy', 'd/M/yy', 'dd/MM/yy',
  'yyyy-MM-dd', 'yyyy/MM/dd', 'MMM d, yyyy',
];
const NO_YEAR_FORMATS = ['d MMM', 'dd MMM', 'd MMMM', 'd-MMM', 'dd-MMM', 'MMM d', 'd/M', 'dd/MM'];

/** A date cell → "yyyy-MM-dd", day first (Indian style). '' when empty, null when unreadable. */
function parseMetOn(v: unknown, today: Date): string | null | '' {
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
  if (!s) return '';
  for (const f of FULL_FORMATS) {
    const d = parse(s, f, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() >= 2000 && d.getFullYear() <= 2100) return format(d, 'yyyy-MM-dd');
  }
  for (const f of NO_YEAR_FORMATS) {
    const d = parse(s, f, new Date(2000, 0, 1));
    if (!isValid(d)) continue;
    // Met in the past: this year's, or last year's if this year's is still ahead.
    const thisYear = setYear(d, today.getFullYear());
    return format(thisYear > today ? subYears(thisYear, 1) : thisYear, 'yyyy-MM-dd');
  }
  return null;
}

/** A cell as text. Phone numbers often come as numbers (9837307364). */
const text = (v: unknown, max: number) => {
  const s = typeof v === 'number' ? String(Math.round(v)) : String(v ?? '').trim();
  return s.slice(0, max);
};

/** The venues in one sheet (rows as SheetJS gives them, header: 1, blank rows kept). */
export function parseVenueRows(rows: unknown[][], where: string, notes: string[], today = new Date()): ParsedVenue[] {
  // The header row: the first of the top rows naming at least two columns.
  let headerAt = -1;
  let cols: { col: number; c: Column }[] = [];
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const found: { col: number; c: Column }[] = [];
    (rows[r] ?? []).forEach((cell, col) => {
      const c = columnOf(cell);
      if (c && !found.some((f) => f.c.field === c.field && f.c.person === c.person)) found.push({ col, c });
    });
    if (found.length >= 2) {
      headerAt = r;
      cols = found;
      break;
    }
  }
  if (headerAt < 0) return [];
  // No venue column but a "Name" one: that's the venue's name.
  if (!cols.some((f) => f.c.field === 'venue')) {
    const name = cols.find((f) => f.c.field === 'name' && f.c.person === 0);
    if (!name) return [];
    name.c = { field: 'venue' };
  }

  const todayKey = format(today, 'yyyy-MM-dd');
  const out: ParsedVenue[] = [];
  for (let r = headerAt + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const at = `${where}row ${r + 1}`;
    const get = (field: VenueField) => {
      const f = cols.find((x) => x.c.field === field);
      return f ? row[f.col] : '';
    };
    if (cols.every((f) => text(row[f.col], 1) === '')) continue;

    const venue_name = text(get('venue'), 200);
    if (!venue_name) {
      notes.push(`${at}: no venue name, left out`);
      continue;
    }

    let met_on = parseMetOn(get('date'), today);
    if (met_on === null) {
      notes.push(`${at}: couldn’t read the date “${text(get('date'), 40)}”, used today`);
      met_on = todayKey;
    } else if (met_on === '') {
      met_on = todayKey;
    } else if (met_on > todayKey) {
      notes.push(`${at}: the date is in the future, used today`);
      met_on = todayKey;
    }

    const people: VenueContact[] = [];
    for (const f of cols) {
      if (f.c.person === undefined) continue;
      const value = text(row[f.col], f.c.field === 'phone' ? 30 : 120);
      if (!value) continue;
      if (f.c.field === 'email' && !isValidEmail(value)) {
        notes.push(`${at}: the email “${value}” doesn’t look right, left out`);
        continue;
      }
      people[f.c.person] = { ...people[f.c.person], [f.c.field]: f.c.field === 'email' ? value.toLowerCase() : value };
    }

    out.push({
      at,
      met_on,
      venue_name,
      location: text(get('location'), 300) || null,
      city: text(get('city'), 80).replace(/\s+/g, ' ') || null,
      brand: text(get('brand'), 80).replace(/\s+/g, ' ') || null,
      contacts: people.filter((p) => p && Object.keys(p).length),
    });
  }
  return out;
}

/** Pick an Excel / CSV file and read the venues in every sheet. Null when cancelled. */
export async function pickAndParseVenuesFile(): Promise<ParsedVenueFile | null> {
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

  const notes: string[] = [];
  const venues: ParsedVenue[] = [];
  const many = wb.SheetNames.length > 1;
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], { header: 1, raw: true, defval: '', blankrows: true });
    venues.push(...parseVenueRows(rows, many ? `${name.trim()}, ` : '', notes));
  }
  return { fileName: asset.name, venues, notes };
}
