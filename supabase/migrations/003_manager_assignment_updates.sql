-- ============================================================================
-- VEBOSSO EMS — Manager Assignment Updates
-- ============================================================================
-- This migration adds support for owner to assign managers to team members
-- ============================================================================

-- The owner_full_access_profiles policy already allows owners to update any profile
-- including the manager_id field. This migration just adds a helpful comment
-- and ensures the policy is in place.

-- Add comment to profiles table to document manager_id usage
COMMENT ON COLUMN public.profiles.manager_id IS 'References the manager assigned to this user. Only owner can modify this field.';

-- Create index for better performance when querying by manager_id (if not exists)
CREATE INDEX IF NOT EXISTS idx_profiles_manager_id ON public.profiles(manager_id);

-- Add a check constraint to prevent self-assignment as manager
ALTER TABLE public.profiles 
DROP CONSTRAINT IF EXISTS chk_not_self_manager;

ALTER TABLE public.profiles 
ADD CONSTRAINT chk_not_self_manager 
CHECK (manager_id IS NULL OR manager_id != id);

-- Add function to get manager's full name for a user
CREATE OR REPLACE FUNCTION public.get_manager_name(user_id UUID)
RETURNS TEXT AS $$
  SELECT full_name 
  FROM public.profiles 
  WHERE id = (
    SELECT manager_id 
    FROM public.profiles 
    WHERE id = user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.get_manager_name(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_manager_name IS 'Returns the full name of the manager assigned to a user';
