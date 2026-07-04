// ============================================================================
// VEBOSSO EMS — Create Member Edge Function
// ============================================================================
// Endpoint: POST /create-member
// Body: { full_name, employee_id, role, department, manager_id, password }
// Auth: Requires owner role (validated via JWT)
// ============================================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateMemberBody {
  full_name: string;
  employee_id: string;
  role: 'manager' | 'member';
  department?: string;
  manager_id?: string;
  password: string;
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

  // Validate required environment variables on each request
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
      return errorResponse('Only owners can create members', 403, 'FORBIDDEN');
    }

    // Parse and validate request body — separate catch for bad JSON
    let body: CreateMemberBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse('Invalid request body. Expected JSON.', 400, 'INVALID_JSON');
    }

    const { full_name, employee_id, role, department, manager_id, password } = body;

    if (!full_name || !employee_id || !role || !password) {
      return errorResponse('full_name, employee_id, role, and password are required', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 8) {
      return errorResponse('Password must be at least 8 characters', 400, 'VALIDATION_ERROR');
    }

    if (!['manager', 'member'].includes(role)) {
      return errorResponse('Role must be "manager" or "member"', 400, 'VALIDATION_ERROR');
    }

    // Create admin client
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Check if employee_id already exists
    const { data: existingProfile } = await adminClient
      .from('profiles')
      .select('id')
      .eq('employee_id', employee_id)
      .single();

    if (existingProfile) {
      return errorResponse(`Employee ID "${employee_id}" already exists`, 409, 'DUPLICATE_EMPLOYEE_ID');
    }

    // Generate a unique email from employee_id (used for Supabase Auth)
    const email = `${employee_id.toLowerCase().replace(/[^a-z0-9]/g, '')}@vebosso.local`;

    // Create auth user
    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        employee_id,
      },
    });

    if (authError) {
      console.error('Auth create error:', authError);
      return errorResponse('Failed to create auth user: ' + authError.message, 500, 'AUTH_CREATE_FAILED');
    }

    // Create profile row
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .insert({
        id: authData.user.id,
        full_name,
        employee_id,
        role,
        department: department || null,
        manager_id: manager_id || null,
        is_active: true,
        must_change_password: true,
        created_by: user.id,
      })
      .select()
      .single();

    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      console.error('Profile create error:', profileError);
      return errorResponse('Failed to create profile: ' + profileError.message, 500, 'PROFILE_CREATE_FAILED');
    }

    return new Response(
      JSON.stringify({
        success: true,
        member: {
          id: profile.id,
          full_name: profile.full_name,
          employee_id: profile.employee_id,
          role: profile.role,
          department: profile.department,
          email,
        },
        credentials: {
          employee_id: profile.employee_id,
          password,
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create member unexpected error:', error);
    return errorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
});
