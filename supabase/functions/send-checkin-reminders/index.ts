// ============================================================================
// VEBOSSO EMS — Daily Check-in Reminder Edge Function
// ============================================================================
// Endpoint: POST /send-checkin-reminders
// Triggered daily via pg_cron at 06:00 UTC (11:30 AM IST) — see migration 032.
// Reminds every active member / manager who hasn't checked in today, and
// gives each owner a summary instead (how many are in, who isn't yet, who is
// on leave). Skips anyone on approved leave today, and on Sundays anyone who
// turned the Sunday reminder off (profiles.sunday_checkin_reminder).
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
  channelId: 'default';
  ttl: number;
}

const TITLE = 'Time to check in ☀️';
const OWNER_TITLE = 'Morning attendance ☀️';

/** "Ankit, Priya and Rahul" / "Ankit, Priya, Rahul and 4 more" */
function nameList(names: string[], max = 3): string {
  if (names.length <= max) {
    return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

const firstName = (full: string | null) => full?.split(' ')[0] || 'there';
const isExpoToken = (t: string | null) => !!t && (t.startsWith('ExponentPushToken[') || t.startsWith('ExpoPushToken['));

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Today in IST (UTC+5:30), and whether it's a Sunday there.
    const indiaNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
    const todayIST = indiaNow.toISOString().split('T')[0];
    const isSunday = indiaNow.getUTCDay() === 0;

    console.log(`Check-in reminders for ${todayIST}${isSunday ? ' (Sunday)' : ''}`);

    // 2. Everyone who works shifts, the day's check-ins and approved leave.
    const [peopleRes, logsRes, leaveRes] = await Promise.all([
      adminClient
        .from('profiles')
        .select('id, full_name, role, expo_push_token, sunday_checkin_reminder')
        .eq('is_active', true)
        .in('role', ['member', 'manager', 'owner']),
      adminClient.from('work_logs').select('user_id').eq('date', todayIST),
      adminClient.from('leave_requests').select('user_id').eq('date', todayIST).eq('status', 'approved'),
    ]);

    if (peopleRes.error) throw peopleRes.error;
    if (logsRes.error) throw logsRes.error;
    if (leaveRes.error) throw leaveRes.error;

    const checkedIn = new Set((logsRes.data ?? []).map((l) => l.user_id));
    const onLeave = new Set((leaveRes.data ?? []).map((l) => l.user_id));

    const everyone = peopleRes.data ?? [];
    // Default on; only an explicit "off" skips Sundays.
    const wantsToday = (p: { sunday_checkin_reminder: boolean | null }) =>
      !(isSunday && p.sunday_checkin_reminder === false);

    const staff = everyone.filter((p) => p.role !== 'owner');
    const owners = everyone.filter((p) => p.role === 'owner' && wantsToday(p));
    const notYet = staff.filter((p) => !checkedIn.has(p.id) && !onLeave.has(p.id));
    const due = notYet.filter(wantsToday);

    const pushMessages: ExpoPushMessage[] = [];
    const dbNotifications: Record<string, unknown>[] = [];

    const send = (p: { id: string; expo_push_token: string | null }, title: string, body: string, type: string) => {
      // Always kept in the in-app notification list.
      dbNotifications.push({ user_id: p.id, title, body, data: { type, date: todayIST }, read: false });
      if (isExpoToken(p.expo_push_token)) {
        pushMessages.push({
          to: p.expo_push_token as string,
          title,
          body,
          data: { type, date: todayIST },
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          ttl: 6 * 60 * 60, // useless after the working day
        });
      }
    };

    for (const p of due) {
      send(
        p,
        TITLE,
        `Good morning ${firstName(p.full_name)}! You haven't checked in yet. Open the app to start your day.`,
        'checkin_reminder'
      );
    }

    // Owners: where the team stands at 11:30.
    if (staff.length > 0) {
      const inCount = staff.filter((p) => checkedIn.has(p.id)).length;
      const leaveNames = staff.filter((p) => onLeave.has(p.id)).map((p) => firstName(p.full_name));
      const lines = [
        notYet.length === 0
          ? `Everyone is in today (${inCount} of ${staff.length}).`
          : `${inCount} of ${staff.length} checked in so far.`,
        notYet.length > 0 ? `Not in yet: ${nameList(notYet.map((p) => firstName(p.full_name)))}.` : null,
        leaveNames.length > 0 ? `On leave: ${nameList(leaveNames)}.` : null,
      ].filter(Boolean);
      for (const o of owners) send(o, OWNER_TITLE, lines.join(' '), 'checkin_summary');
    }

    if (dbNotifications.length === 0) {
      console.log('Nothing to send.');
      return new Response(
        JSON.stringify({ success: true, message: 'No reminders needed', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. In-app log.
    const { error: dbInsertError } = await adminClient.from('notifications').insert(dbNotifications);
    if (dbInsertError) console.error('Error logging notifications to database:', dbInsertError);

    // 4. Push, in batches of 100 (Expo's limit per request).
    const results: unknown[] = [];
    for (let i = 0; i < pushMessages.length; i += 100) {
      const res = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages.slice(i, i + 100)),
      });
      if (!res.ok) {
        console.error('Expo push batch HTTP error:', res.status, await res.text());
        throw new Error(`Expo API HTTP error: ${res.status}`);
      }
      results.push(await res.json());
    }

    return new Response(
      JSON.stringify({
        success: true,
        date: todayIST,
        sunday: isSunday,
        reminded: due.length,
        owners_told: owners.length,
        push_sent: pushMessages.length,
        expo_response: results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Unexpected error in scheduled check-in reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
