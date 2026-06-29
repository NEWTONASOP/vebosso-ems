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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const payload: PushNotificationBody = await req.json();
    const { user_id, title, body: messageBody, data } = payload;

    if (!user_id || !title || !messageBody) {
      return new Response(
        JSON.stringify({ error: 'user_id, title, and body are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the user's Expo push token
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('expo_push_token, full_name')
      .eq('id', user_id)
      .single();

    if (profileError || !profile?.expo_push_token) {
      console.warn(`No push token found for user ${user_id}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'No push token found for user',
          user_id 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Construct Expo push message
    const message: ExpoPushMessage = {
      to: profile.expo_push_token,
      title,
      body: messageBody,
      data: data || {},
      sound: 'default',
      priority: 'high',
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

    const pushResult = await pushResponse.json();

    if (pushResult.data?.status === 'error') {
      console.error('Push notification error:', pushResult.data);
      
      // If the token is invalid, clear it from the profile
      if (pushResult.data.details?.error === 'DeviceNotRegistered') {
        await adminClient
          .from('profiles')
          .update({ expo_push_token: null })
          .eq('id', user_id);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: pushResult.data.message,
          details: pushResult.data.details 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, ticket: pushResult.data }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Push notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
