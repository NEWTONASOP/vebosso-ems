// ============================================================================
// VEBOSSO EMS — Admin Update Member Edge Function
// ============================================================================
// Endpoint: POST /admin-update-member
// Body: { action: 'update-password' | 'delete-member', user_id, password }
// Auth: Requires owner role (validated via JWT)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdateMemberBody {
  action: 'update-password' | 'delete-member';
  user_id: string;
  password?: string;
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error('Missing required environment variables');
    return errorResponse('Server configuration error. Please contact support.', 500, 'ENV_MISSING');
  }

  try {
    // Validate Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return errorResponse('Missing authorization header', 401, 'AUTH_MISSING');
    }

    // Verify caller is owner
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return errorResponse('Invalid or expired token. Please sign in again.', 401, 'AUTH_INVALID');
    }

    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'owner') {
      return errorResponse('Only owners can perform admin updates on members', 403, 'FORBIDDEN');
    }

    // Parse and validate request body
    let body: UpdateMemberBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid request body. Expected JSON.', 400, 'INVALID_JSON');
    }

    const { action, user_id, password } = body;

    if (!action || !user_id) {
      return errorResponse('action and user_id are required', 400, 'VALIDATION_ERROR');
    }

    // Prevent owners from deleting or editing themselves
    if (user_id === user.id) {
      return errorResponse('You cannot modify or delete your own account via this API', 400, 'SELF_MODIFICATION');
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === 'update-password') {
      if (!password || password.length < 6) {
        return errorResponse('Password must be at least 6 characters', 400, 'VALIDATION_ERROR');
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(user_id, {
        password: password,
      });

      if (updateError) {
        console.error('Password update error:', updateError);
        return errorResponse('Failed to update member password: ' + updateError.message, 500, 'PASSWORD_UPDATE_FAILED');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Password updated successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (action === 'delete-member') {
      // Step 1: Nullify assigned_by references in tasks (tasks assigned BY this user to others)
      // We can't cascade-delete these as it would wipe tasks assigned to innocent members
      const { error: tasksUpdateError } = await adminClient
        .from('tasks')
        .update({ assigned_by: null } as any)
        .eq('assigned_by', user_id);

      if (tasksUpdateError) {
        console.warn('Could not nullify assigned_by tasks (non-fatal):', tasksUpdateError.message);
      }

      // Step 2: Delete user from Supabase Auth — cascades to profiles, which cascades to
      // work_logs, sessions, leave_requests, tasks(assigned_to), announcements
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user_id);

      if (deleteError) {
        console.error('Auth user delete error:', deleteError);
        return errorResponse('Failed to delete member: ' + deleteError.message, 500, 'MEMBER_DELETE_FAILED');
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Member deleted successfully' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return errorResponse(`Invalid action "${action}"`, 400, 'INVALID_ACTION');
    }
  } catch (error) {
    console.error('Admin update member unexpected error:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
