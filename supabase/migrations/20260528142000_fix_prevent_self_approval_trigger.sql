-- Fix prevent_self_approval_changes to allow updates by postgres (Supabase Dashboard) or service_role
CREATE OR REPLACE FUNCTION public.prevent_self_approval_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow if database session is postgres (Supabase Dashboard) or service_role or user is admin
  IF current_user = 'postgres' OR auth.role() = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.is_approved IS DISTINCT FROM OLD.is_approved
     OR NEW.approved_until IS DISTINCT FROM OLD.approved_until THEN
    RAISE EXCEPTION 'Only admins can change approval status';
  END IF;
  
  RETURN NEW;
END;
$$;
