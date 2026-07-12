// ============================================================================
// VEBOSSO EMS — Send Push Notification Edge Function
// ============================================================================
// Endpoint: POST /send-push-notification
// Body: { user_id: string, title: string, body: string, data?: object }
// Can be called via database webhooks or directly
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationBody {
  user_id: string;
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

/** Returns a consistent JSON error response. */
function errorResponse(message: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ error: message, ...(code ? { code } : {}) }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
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
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Parse request body — separate catch for malformed JSON
    let payload: PushNotificationBody;
    try {
      payload = await req.json();
    } catch {
      return errorResponse('Invalid request body. Expected JSON.', 400, 'INVALID_JSON');
    }

    const { user_id, title, body: messageBody, data } = payload;

    if (!user_id || !title || !messageBody) {
      return errorResponse('user_id, title, and body are required', 400, 'VALIDATION_ERROR');
    }

    // Get the user's Expo push token
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('expo_push_token, full_name')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return new Response(
        JSON.stringify({ success: false, message: 'Failed to fetch user profile', user_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the notification to the database for in-app logs
    try {
      const { error: dbError } = await adminClient
        .from('notifications')
        .insert({
          user_id,
          title,
          body: messageBody,
          data: data || {},
          read: false,
        });

      if (dbError) {
        console.error('Error logging notification to database:', dbError);
      }
    } catch (dbCatchErr) {
      console.error('Unexpected error logging notification to database:', dbCatchErr);
    }

    if (!profile?.expo_push_token) {
      console.warn(`No push token found for user ${user_id}`);
      return new Response(
        JSON.stringify({ success: false, message: 'No push token found for user — logged to DB', user_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate Expo push token format
    const token = profile.expo_push_token as string;
    if (!token.startsWith('ExponentPushToken[') && !token.startsWith('ExpoPushToken[')) {
      console.warn(`Invalid push token format for user ${user_id}: ${token}`);
      // Clear the invalid token
      await adminClient.from('profiles').update({ expo_push_token: null }).eq('id', user_id);
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid push token format — token cleared', user_id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine the appropriate Android notification channel based on the payload type
    let channelId = 'default';
    const notifType = data?.type as string | undefined;
    if (notifType) {
      if (['check_in_request', 'checkout_request', 'leave_request'].includes(notifType)) {
        channelId = 'approvals';
      } else if (['task_assigned', 'task_reassigned'].includes(notifType)) {
        channelId = 'tasks';
      } else if (notifType === 'announcement') {
        channelId = 'announcements';
      }
    }

    // Construct Expo push message
    const message: ExpoPushMessage = {
      to: token,
      title,
      body: messageBody,
      data: data || {},
      sound: 'default',
      priority: 'high',
      channelId,
      ttl: 2419200, // 4 weeks in seconds - ensures delivery queueing if device is sleeping or offline
    };

    // Send via Expo Push API
    const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
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

    if (pushResult.data?.status === 'error') {
      console.error('Push notification delivery error:', pushResult.data);
      
      const expoErrorCode = pushResult.data.details?.error;

      // If the token is invalid or device unregistered, clear it from the profile
      if (expoErrorCode === 'DeviceNotRegistered' || expoErrorCode === 'InvalidCredentials') {
        await adminClient
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', user_id);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: pushResult.data.message,
          code: expoErrorCode || 'PUSH_DELIVERY_ERROR',
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ticket: pushResult.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification unexpected error:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
