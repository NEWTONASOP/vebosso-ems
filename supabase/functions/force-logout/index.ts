// ============================================================================
// VEBOSSO EMS — Force Logout Edge Function
// ============================================================================
// Endpoint: POST /force-logout
// Body: { user_id: string, session_id?: string }
// Auth: Requires owner role (validated via JWT)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Returns a consistent JSON error response. */
function errorResponse(message: string, status: number, code?: string): Response {
  return new Response(
    JSON.stringify({ error: message, ...(code ? { code } : {}) }),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // Validate required environment variables
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return errorResponse('Server configuration error. Please contact support.', 500, 'ENV_MISSING');
  }

  try {
    // Validate the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, 'AUTH_MISSING');
    }

    // Create a Supabase client with the user's JWT to verify identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return errorResponse('Invalid or expired token. Please sign in again.', 401, 'AUTH_INVALID');
    }

    // Check if caller is owner
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'owner') {
      return errorResponse('Only owners can force logout users', 403, 'FORBIDDEN');
    }

    // Parse request body — separate catch for malformed JSON
    let user_id: string;
    let session_id: string | undefined;
    try {
      const body = await req.json();
      user_id = body.user_id;
      session_id = body.session_id;
    } catch {
      return errorResponse('Invalid request body. Expected JSON.', 400, 'INVALID_JSON');
    }

    if (!user_id) {
      return errorResponse('user_id is required', 400, 'VALIDATION_ERROR');
    }

    // Prevent self-logout
    if (user_id === user.id) {
      return errorResponse('You cannot force logout yourself', 400, 'SELF_LOGOUT');
    }

    // Create admin client with service role key
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Sign out the target user using admin API
    const { error: signOutError } = await adminClient.auth.admin.signOut(user_id);

    if (signOutError) {
      console.error('Sign out error:', signOutError);
      return errorResponse('Failed to sign out user: ' + signOutError.message, 500, 'SIGNOUT_FAILED');
    }

    // Update sessions table
    if (session_id) {
      await adminClient
        .from('sessions')
        .update({ is_active: false })
        .eq('id', session_id);
    } else {
      // Deactivate all sessions for this user
      await adminClient
        .from('sessions')
        .update({ is_active: false })
        .eq('user_id', user_id);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User has been logged out' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Force logout unexpected error:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
