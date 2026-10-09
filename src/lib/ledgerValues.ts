// ============================================================================
// VEBOSSO EMS — Reading dates and amounts from statements
// Shared by the spreadsheet importer and the PDF statement importer.
// ============================================================================

import { format, isValid, parse } from 'date-fns';
import * as XLSX from 'xlsx';

export function parseAmount(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  const negative = /^\(.*\)$/.test(s) || /^-/.test(s);
  s = s.replace(/[^0-9.]/g, '');
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return 0;
  return negative ? -n : n;
}

const DATE_FORMATS = [
  'dd-MM-yyyy', 'd-M-yyyy', 'dd/MM/yyyy', 'd/M/yyyy', 'dd.MM.yyyy', 'd.M.yyyy',
  'dd-MM-yy', 'dd/MM/yy', 'd/M/yy',
  'yyyy-MM-dd', 'yyyy/MM/dd',
  'd MMM yyyy', 'dd MMM yyyy', 'd-MMM-yyyy', 'dd-MMM-yyyy', 'd-MMM-yy', 'dd-MMM-yy',
  'MMM d, yyyy', 'd MMMM yyyy', 'dd MMMM yyyy',
];

/** → "yyyy-MM-dd", day-first for ambiguous dates (Indian style). */
export function parseDate(v: unknown): string | null {
  if (v instanceof Date) return isValid(v) ? format(v, 'yyyy-MM-dd') : null;
  if (typeof v === 'number') {
    // Excel serial date.
    if (v < 20000 || v > 80000) return null;
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return null;
  // Drop a trailing time ("15-09-2026 10:32").
  const datePart = s.replace(/[ T]\d{1,2}:\d{2}(:\d{2})?( ?[ap]m)?$/i, '');
  for (const f of DATE_FORMATS) {
    const d = parse(datePart, f, new Date(2000, 0, 1));
    if (isValid(d) && d.getFullYear() >= 1990 && d.getFullYear() <= 2100) return format(d, 'yyyy-MM-dd');
  }
  return null;
}
