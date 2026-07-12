// ============================================================================
// VEBOSSO EMS — Daily Checkout Reminder Edge Function
// ============================================================================
// Endpoint: POST /send-checkout-reminders
// Triggered daily via pg_cron at 15:00 UTC (8:30 PM IST)
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

    // 1. Calculate today's date in IST (UTC+5:30)
    // Server runs in UTC, so we add 5.5 hours to find today's date in India
    const indiaOffsetMs = 5.5 * 60 * 60 * 1000;
    const todayIST = new Date(Date.now() + indiaOffsetMs).toISOString().split('T')[0];

    console.log(`Checking for active check-ins on date (IST): ${todayIST}`);

    // 2. Fetch active check-ins for today
    // Get work logs where status is 'working' or 'pending_approval'
    // Joined with profiles to get user_id, full_name, and expo_push_token
    const { data: activeLogs, error: logError } = await adminClient
      .from('work_logs')
      .select('id, user_id, status, profiles(id, full_name, expo_push_token)')
      .eq('date', todayIST)
      .in('status', ['working', 'pending_approval']);

    if (logError) {
      console.error('Error fetching active logs:', logError);
      throw logError;
    }

    if (!activeLogs || activeLogs.length === 0) {
      console.log('No active check-ins found for today.');
      return new Response(
        JSON.stringify({ success: true, message: 'No active check-ins found', count: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${activeLogs.length} active check-ins.`);

    const pushMessages: ExpoPushMessage[] = [];
    const dbNotifications: any[] = [];
    const notifiedUserIds: string[] = [];

    for (const log of activeLogs) {
      // Access profile from joint query
      const profile = Array.isArray(log.profiles) ? log.profiles[0] : log.profiles;
      if (!profile) continue;

      const { id: userId, full_name: fullName, expo_push_token: token } = profile as any;

      // Always log the notification to the database for the user's in-app logs
      dbNotifications.push({
        user_id: userId,
        title: 'Forgot to check out? ⏰',
        body: `Hey ${fullName || 'there'}, you are still checked in. Don't forget to submit your report and check out!`,
        data: { type: 'checkout_reminder', work_log_id: log.id },
        read: false,
      });

      // Prepare Expo push message if they have a valid token
      if (token && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['))) {
        pushMessages.push({
          to: token,
          title: 'Forgot to check out? ⏰',
          body: `Hey ${fullName || 'there'}, you are still checked in. Don't forget to submit your report and check out!`,
          data: { type: 'checkout_reminder', work_log_id: log.id },
          sound: 'default',
          priority: 'high',
          channelId: 'default',
          ttl: 2419200, // 4 weeks
        });
        notifiedUserIds.push(userId);
      } else {
        console.warn(`No valid push token found for active user: ${userId}`);
      }
    }

    // 3. Batch insert notifications into database for in-app logs
    if (dbNotifications.length > 0) {
      const { error: dbInsertError } = await adminClient
        .from('notifications')
        .insert(dbNotifications);

      if (dbInsertError) {
        console.error('Error logging notifications to database:', dbInsertError);
      } else {
        console.log(`Logged ${dbNotifications.length} notifications to database.`);
      }
    }

    // 4. Batch send push notifications via Expo Push API
    let pushResult = null;
    if (pushMessages.length > 0) {
      const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(pushMessages),
      });

      if (!pushResponse.ok) {
        const rawText = await pushResponse.text();
        console.error('Expo push batch HTTP error:', pushResponse.status, rawText);
        throw new Error(`Expo API HTTP error: ${pushResponse.status}`);
      }

      pushResult = await pushResponse.json();
      console.log('Expo push batch response:', JSON.stringify(pushResult));
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reminders processed successfully',
        total_active: activeLogs.length,
        push_sent: pushMessages.length,
        notified_users: notifiedUserIds,
        expo_response: pushResult,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Unexpected error in scheduled checkout reminders function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
