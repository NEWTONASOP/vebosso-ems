// ============================================================================
// VEBOSSO EMS — Attendance log (075)
// The steps of one day: sent, sent back with a reason, sent again.
// ============================================================================

import { useEffect, useState } from 'react';
import { WorkLogEvent } from '../types/database';
import { supabase } from './supabase';

/**
 * The log entries of one work log, oldest first. `version` is the log's
 * updated_at: when the day changes (a check-out, a send-back) the log is read
 * again. Any failure gives an empty list, so a screen still shows the day when
 * the table is not there yet (before migration 075 is applied).
 */
export function useWorkLogEvents(workLogId: string | null | undefined, version?: string | null): WorkLogEvent[] {
  const [events, setEvents] = useState<WorkLogEvent[]>([]);

  useEffect(() => {
    if (!workLogId) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('work_log_events')
        .select('id, seq, work_log_id, kind, body, actor_id, actor_name, occurred_at')
        .eq('work_log_id', workLogId)
        .order('occurred_at', { ascending: true })
        .order('seq', { ascending: true });
      if (!cancelled) setEvents(error ? [] : ((data ?? []) as WorkLogEvent[]));
    })();
    return () => {
      cancelled = true;
    };
  }, [workLogId, version]);

  return events;
}
