import { format, isToday, isYesterday, parseISO } from 'date-fns';

/** Returns "Yesterday" or "Mon, Jul 8" for past logs; null for today. */
export function formatWorkLogDateLabel(dateStr: string): string | null {
  const logDate = parseISO(dateStr);
  if (isToday(logDate)) return null;
  if (isYesterday(logDate)) return 'Yesterday';
  return format(logDate, 'EEE, MMM d');
}

/** Phrase for notification bodies, e.g. "yesterday" or "Mon, Jul 8". */
export function formatWorkLogDateForMessage(dateStr: string): string | null {
  const label = formatWorkLogDateLabel(dateStr);
  if (!label) return null;
  if (label === 'Yesterday') return 'yesterday';
  return label;
}
