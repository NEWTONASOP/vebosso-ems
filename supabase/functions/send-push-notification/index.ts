// ============================================================================
// VEBOSSO EMS — Send Push Notification Edge Function
// ============================================================================
// Endpoint: POST /send-push-notification
//
// Modes:
//   Single user:     { user_id: string, title, body, data? }
//   Role broadcast:  { to_role: 'owner'|'manager'|'member', title, body, data?, exclude_user_ids? }
//
// The role-broadcast mode runs server-side using the service_role key, so it
// bypasses RLS and can resolve owner/manager profiles even when the caller is
// a regular member.
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationBody {
  // Single-user mode
  user_id?: string;
  // Role-broadcast mode
  to_role?: 'owner' | 'manager' | 'member';
  exclude_user_ids?: string[];
  // Common fields
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound: 'default';
  priority: 'high';
  channelId?: string;
  ttl?: number;
}

interface TargetUser {
  id: string;
  expo_push_token: string | null;
}

/** Returns a consistent JSON error response. */
function errorResponse(message: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ error: message, ...(code ? { code } : {}) }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

/** Determine the Android notification channel based on the notification type. */
function getChannelId(notifType: string | undefined): string {
  if (!notifType) return 'default';
  if (['check_in_request', 'checkout_request', 'leave_request'].includes(notifType)) {
    return 'approvals';
  }
  if (['task_assigned', 'task_reassigned'].includes(notifType)) {
    return 'tasks';
  }
  if (notifType === 'announcement') {
    return 'announcements';
  }
  return 'default';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validate required environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return errorResponse('Server configuration error. Please contact support.', 500, 'ENV_MISSING');
  }

  try {
    // adminClient uses service_role key → bypasses RLS entirely
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request body
    let payload: PushNotificationBody;
    try {
      payload = await req.json();
    } catch {
      return errorResponse('Invalid request body. Expected JSON.', 400, 'INVALID_JSON');
    }

    const { user_id, to_role, exclude_user_ids, title, body: messageBody, data } = payload;

    if (!title || !messageBody) {
      return errorResponse('title and body are required', 400, 'VALIDATION_ERROR');
    }

    if (!user_id && !to_role) {
      return errorResponse('Either user_id or to_role is required', 400, 'VALIDATION_ERROR');
    }

    // -------------------------------------------------------------------------
    // Resolve target users
    // -------------------------------------------------------------------------
    let targetUsers: TargetUser[] = [];

    if (to_role) {
      // Role-broadcast mode — service_role key bypasses RLS, so we can read all
      // owner/manager profiles even if the caller is a member.
      const { data: profiles, error: profilesError } = await adminClient
        .from('profiles')
        .select('id, expo_push_token')
        .eq('role', to_role)
        .eq('is_active', true);

      if (profilesError) {
        console.error('Failed to fetch profiles for role broadcast:', profilesError);
        return errorResponse('Failed to resolve target users', 500, 'PROFILES_FETCH_ERROR');
      }

      const excluded = new Set(exclude_user_ids || []);
      const allProfiles = profiles || [];
      targetUsers = allProfiles.filter((p) => !excluded.has(p.id));

      const actuallyExcluded = allProfiles.length - targetUsers.length;
      console.log(
        `Role broadcast to '${to_role}': ${targetUsers.length} target(s) ` +
        `(${actuallyExcluded} excluded from ${allProfiles.length} total)`
      );
    } else {
      // Single-user mode
      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, expo_push_token')
        .eq('id', user_id!)
        .single();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        return new Response(
          JSON.stringify({ success: false, message: 'Failed to fetch user profile', user_id }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (profile) targetUsers = [profile];
    }

    if (targetUsers.length === 0) {
      console.warn('No target users found for notification');
      return new Response(
        JSON.stringify({ success: true, message: 'No target users found', sent: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------------
    // Log to notifications table (in-app notification center)
    // -------------------------------------------------------------------------
    try {
      const dbNotifications = targetUsers.map((u) => ({
        user_id: u.id,
        title,
        body: messageBody,
        data: data || {},
        read: false,
      }));

      const { error: dbError } = await adminClient
        .from('notifications')
        .insert(dbNotifications);

      if (dbError) {
        console.error('Error logging notification(s) to database:', dbError);
      }
    } catch (dbCatchErr) {
      console.error('Unexpected error logging notification(s) to database:', dbCatchErr);
    }

    // -------------------------------------------------------------------------
    // Build Expo push messages for users with valid tokens
    // -------------------------------------------------------------------------
    const channelId = getChannelId(data?.type as string | undefined);
    const pushMessages: ExpoPushMessage[] = [];

    for (const user of targetUsers) {
      const token = user.expo_push_token as string | null;

      if (!token) {
        console.warn(`No push token found for user ${user.id}`);
        continue;
      }

      if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
        console.warn(`Invalid push token format for user ${user.id}: ${token}`);
        // Clear the invalid token so it doesn't keep failing
        await adminClient.from('profiles').update({ expo_push_token: null }).eq('id', user.id);
        continue;
      }

      pushMessages.push({
        to: token,
        title,
        body: messageBody,
        data: data || {},
        sound: 'default',
        priority: 'high',
        channelId,
        ttl: 2419200, // 4 weeks — ensures delivery queueing if device is offline
      });
    }

    if (pushMessages.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Notifications logged to DB — no valid push tokens available',
          sent: 0,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -------------------------------------------------------------------------
    // Send via Expo Push API (single message or batch)
    // -------------------------------------------------------------------------
    const pushPayload = pushMessages.length === 1 ? pushMessages[0] : pushMessages;

    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushPayload),
    });

    if (!pushResponse.ok) {
      const rawText = await pushResponse.text();
      console.error('Expo push API HTTP error:', pushResponse.status, rawText);
      return new Response(
        JSON.stringify({ success: false, error: 'Expo push API error', code: 'EXPO_HTTP_ERROR' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pushResult = await pushResponse.json();

    // Handle single vs batch response shapes
    const results = Array.isArray(pushResult.data) ? pushResult.data : [pushResult.data];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result?.status === 'error') {
        const expoErrorCode = result.details?.error;
        console.error(`Push delivery error for message ${i}:`, result);

        // Clear invalid tokens so they don't keep failing on future sends
        if (expoErrorCode === 'DeviceNotRegistered' || expoErrorCode === 'InvalidCredentials') {
          const failedToken = pushMessages[i]?.to;
          if (failedToken) {
            await adminClient
              .from('profiles')
              .update({ expo_push_token: null })
              .eq('expo_push_token', failedToken);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, sent: pushMessages.length, tickets: pushResult.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification unexpected error:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
