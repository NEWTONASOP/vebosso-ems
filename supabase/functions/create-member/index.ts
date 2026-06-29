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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify caller is owner
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: callerProfile } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (callerProfile?.role !== 'owner') {
      return new Response(
        JSON.stringify({ error: 'Only owners can create members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and validate body
    const body: CreateMemberBody = await req.json();
    const { full_name, employee_id, role, department, manager_id, password } = body;

    if (!full_name || !employee_id || !role || !password) {
      return new Response(
        JSON.stringify({ error: 'full_name, employee_id, role, and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!['manager', 'member'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Role must be "manager" or "member"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: `Employee ID "${employee_id}" already exists` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Failed to create auth user', details: authError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
      return new Response(
        JSON.stringify({ error: 'Failed to create profile', details: profileError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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
          email, // Internal email used for auth
        },
        credentials: {
          employee_id: profile.employee_id,
          password, // Return so owner can share with member
        },
      }),
      { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Create member error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
