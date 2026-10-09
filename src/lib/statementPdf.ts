// ============================================================================
// VEBOSSO EMS — Bank statements as PDF
// The PDF's text (pieces with their x / y on the page, from PDF.js) is put
// back into lines. A transaction is a line that starts with a date; its
// amounts are on that line, and the description continues on the lines after
// it. Two layouts are read:
//   • "Amount  CR/DR  Balance"            — e.g. PNB
//   • "… Debit  Credit  Balance" with "-" for an empty side — e.g. SBI
// Some banks (SBI) print a short label ("WDL TFR") just above the date line;
// when the whole statement does that, the label goes with the transaction
// below it. Page headers and the summary / footer are skipped.
// ============================================================================

import type { TxnInput } from './accounts';
import type { ParsedLedger } from './accountsFile';
import { parseAmount, parseDate } from './ledgerValues';

/** One piece of text on a page. */
export interface PdfItem {
  s: string;
  x: number;
  y: number;
}

type Line = { y: number; cells: string[] };

/** Pieces → lines, top to bottom; each line's cells left to right. */
function toLines(items: PdfItem[]): Line[] {
  const rows: { y: number; c: PdfItem[] }[] = [];
  for (const it of items) {
    if (!it.s.trim()) continue;
    let row = rows.find((r) => Math.abs(r.y - it.y) <= 2.5);
    if (!row) {
      row = { y: it.y, c: [] };
      rows.push(row);
    }
    row.c.push(it);
  }
  rows.sort((a, b) => b.y - a.y);
  return rows.map((r) => ({
    y: r.y,
    cells: r.c.sort((a, b) => a.x - b.x).map((c) => c.s.replace(/\s+/g, ' ').trim()).filter(Boolean),
  }));
}

const DATE_CELL = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}[ -][A-Za-z]{3,9}[ -,]*\d{2,4})$/;
/** 1,23,456.78 / 69707.0 / 500 — optionally with Cr / Dr after. */
const MONEY = /^-?[\d,]+(\.\d{1,2})?\s*(cr|dr)?\.?$/i;
/** Two decimals: a real amount (account / reference numbers have none). */
const MONEY_DECIMAL = /^-?[\d,]+\.\d{1,2}\s*(cr|dr)?\.?$/i;
const EMPTY_SIDE = /^[-–—]$/;
const TYPE = /^(cr|dr|credit|debit)\.?$/i;
/** Ends a transaction: page footers, the summary, totals. */
const STOP = /^(date\s*:|page\b|page no|statement summary|brought forward|opening balance|closing balance|total\b|grand total|\*{3}|this is a computer|please do not share)/i;
/** A short label in capitals, like "WDL TFR" or "DEP TFR". */
const LABEL = /^[A-Z]{2,5}( [A-Z]{2,5}){0,2}$/;

/** "SBI 5602" from what the statement says before its table; null if unsure. */
export function statementName(headerText: string): string | null {
  const BANKS: Record<string, string> = {
    SBIN: 'SBI', PUNB: 'PNB', HDFC: 'HDFC', ICIC: 'ICICI', UTIB: 'Axis', KKBK: 'Kotak', BARB: 'Bank of Baroda',
    CNRB: 'Canara', UBIN: 'Union Bank', IDIB: 'Indian Bank', YESB: 'Yes Bank', IDFB: 'IDFC First', INDB: 'IndusInd',
    BKID: 'Bank of India', MAHB: 'Bank of Maharashtra', CBIN: 'Central Bank', IOBA: 'IOB', UCBA: 'UCO Bank',
    FDRL: 'Federal Bank', AUBL: 'AU Bank',
  };
  const ifsc = headerText.match(/\b([A-Z]{4})0[A-Z0-9]{6}\b/);
  const bank =
    (ifsc && BANKS[ifsc[1]]) ||
    (/state bank of india/i.test(headerText) ? 'SBI' : /punjab national/i.test(headerText) ? 'PNB' : null);
  const acc =
    headerText.match(/account\s*(?:number|no\.?)\s*(?:for\s+account\s+number)?\s*[:\-]?\s*(\d{6,18})/i) ||
    headerText.match(/statement\s+of\s+account\s*[:\-]?\s*(\d{6,18})/i) ||
    headerText.match(/account\s+statement\s+for\s+account\s+number\s*(\d{6,18})/i);
  const last4 = acc ? acc[1].slice(-4) : null;
  if (!bank && !last4) return null;
  return [bank ?? 'Bank', last4].filter(Boolean).join(' ');
}

/** Entries from a PDF statement's pages (empty when it isn't one). */
export function parsePdfStatement(pages: PdfItem[][], fallbackName: string): ParsedLedger[] {
  const ledger: ParsedLedger = { name: fallbackName, entries: [], skipped: 0, credit: 0, debit: 0, from: null, to: null };
  const headerBits: string[] = [];

  type Block = { date: string; label: string | null; cells: string[]; extra: string[] };
  const allBlocks: Block[] = [];
  // Does a short capital label sit right above each date line (SBI)?
  let labelAbove = 0;
  let dateLines = 0;
  const perPage: { lines: Line[]; dateIdx: number[] }[] = [];

  for (const items of pages) {
    const lines = toLines(items);
    const dateIdx: number[] = [];
    lines.forEach((l, i) => {
      if (l.cells.length >= 2 && DATE_CELL.test(l.cells[0]) && parseDate(l.cells[0])) {
        // A real row has an amount on it, not just a date (e.g. "Account open date").
        if (l.cells.slice(1).some((c) => MONEY_DECIMAL.test(c) || TYPE.test(c))) dateIdx.push(i);
      }
    });
    for (const i of dateIdx) {
      dateLines++;
      const prev = lines[i - 1];
      if (prev && prev.cells.length === 1 && LABEL.test(prev.cells[0])) labelAbove++;
    }
    perPage.push({ lines, dateIdx });
    if (allBlocks.length === 0 && dateIdx.length === 0) headerBits.push(...lines.map((l) => l.cells.join(' ')));
    else if (allBlocks.length === 0) headerBits.push(...lines.slice(0, dateIdx[0]).map((l) => l.cells.join(' ')));
    // Mark that the table has started (anything after this isn't header).
    if (dateIdx.length) allBlocks.push({ date: '', label: null, cells: [], extra: [] });
  }
  allBlocks.length = 0;
  const labelsGoBelow = dateLines > 0 && labelAbove / dateLines >= 0.6;

  for (const { lines, dateIdx } of perPage) {
    dateIdx.forEach((i, k) => {
      const next = k + 1 < dateIdx.length ? dateIdx[k + 1] : lines.length;
      const extra: string[] = [];
      const label =
        labelsGoBelow && lines[i - 1] && lines[i - 1].cells.length === 1 && LABEL.test(lines[i - 1].cells[0])
          ? lines[i - 1].cells[0]
          : null;
      for (let j = i + 1; j < next; j++) {
        const text = lines[j].cells.join(' ');
        if (STOP.test(text)) break;
        // The next row's label stays with the next row.
        if (labelsGoBelow && j === next - 1 && next < lines.length && lines[j].cells.length === 1 && LABEL.test(text)) break;
        extra.push(text);
      }
      allBlocks.push({ date: parseDate(lines[i].cells[0])!, label, cells: lines[i].cells, extra });
    });
  }

  for (const b of allBlocks) {
    const cells = b.cells.slice(1);
    // A second date straight after (value date) isn't part of the description.
    if (cells[0] && DATE_CELL.test(cells[0]) && parseDate(cells[0])) cells.shift();

    let kind: 'credit' | 'debit' | null = null;
    let amount = 0;
    const used = new Set<number>();

    // Layout 1: amount, then CR / DR.
    const t = cells.findIndex((c, i) => i > 0 && TYPE.test(c) && MONEY.test(cells[i - 1]));
    if (t > 0) {
      amount = Math.abs(parseAmount(cells[t - 1]));
      kind = /^c/i.test(cells[t]) ? 'credit' : 'debit';
      used.add(t - 1).add(t);
      if (cells[t + 1] && MONEY.test(cells[t + 1])) used.add(t + 1); // balance
    } else {
      // Layout 2: … debit, credit, balance at the end ("-" for an empty side).
      const money = (i: number) => i >= 0 && (MONEY_DECIMAL.test(cells[i]) || EMPTY_SIDE.test(cells[i]));
      const bal = cells.length - 1;
      if (bal >= 2 && MONEY_DECIMAL.test(cells[bal]) && money(bal - 1) && money(bal - 2)) {
        const dr = EMPTY_SIDE.test(cells[bal - 2]) ? 0 : Math.abs(parseAmount(cells[bal - 2]));
        const cr = EMPTY_SIDE.test(cells[bal - 1]) ? 0 : Math.abs(parseAmount(cells[bal - 1]));
        if (cr > 0 && dr === 0) {
          kind = 'credit';
          amount = cr;
        } else if (dr > 0 && cr === 0) {
          kind = 'debit';
          amount = dr;
        }
        used.add(bal).add(bal - 1).add(bal - 2);
        // An empty reference column just before.
        if (cells[bal - 3] && EMPTY_SIDE.test(cells[bal - 3])) used.add(bal - 3);
      }
    }

    if (!kind || !(amount > 0)) {
      ledger.skipped++;
      continue;
    }

    const particular = [b.label ?? '', ...cells.filter((_, i) => !used.has(i)), ...b.extra]
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    const e: TxnInput = { txn_date: b.date, kind, amount: Math.round(amount * 100) / 100, particular: particular || null };
    ledger.entries.push(e);
    if (kind === 'credit') ledger.credit += e.amount;
    else ledger.debit += e.amount;
    if (!ledger.from || e.txn_date < ledger.from) ledger.from = e.txn_date;
    if (!ledger.to || e.txn_date > ledger.to) ledger.to = e.txn_date;
  }

  const named = statementName(headerBits.join('\n'));
  if (named) ledger.name = named;
  return ledger.entries.length ? [ledger] : [];
}
