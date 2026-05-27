
-- 1) profiles.is_approved
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

-- Existing admins should be auto-approved
UPDATE public.profiles p
SET is_approved = true
WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'admin');

-- Allow admins to view & update all profiles (for approval management)
DROP POLICY IF EXISTS "profiles admin select all" ON public.profiles;
CREATE POLICY "profiles admin select all" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "profiles admin update all" ON public.profiles;
CREATE POLICY "profiles admin update all" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2) app_settings (singleton paywall config)
CREATE TABLE IF NOT EXISTS public.app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  price_bdt numeric NOT NULL DEFAULT 2000,
  whatsapp_number text,
  package_name text NOT NULL DEFAULT 'MetaPilot Pro',
  paywall_title text NOT NULL DEFAULT 'Activate your account',
  paywall_message text NOT NULL DEFAULT 'এপটি ব্যবহার করতে নিচের প্যাকেজটি কিনুন। WhatsApp এ যোগাযোগ করুন, পেমেন্ট নিশ্চিত হলে আপনার একাউন্ট approve করে দেওয়া হবে।',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "app_settings auth select" ON public.app_settings;
CREATE POLICY "app_settings auth select" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "app_settings admin write" ON public.app_settings;
CREATE POLICY "app_settings admin write" ON public.app_settings
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Seed default row if empty
INSERT INTO public.app_settings (price_bdt, package_name)
SELECT 2000, 'MetaPilot Pro'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

-- 3) Update handle_new_user: auto-approve the first/admin user
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  user_count INTEGER;
  is_first BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users;
  is_first := (user_count = 1);

  INSERT INTO public.profiles (id, email, full_name, is_approved)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), is_first);

  IF is_first THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  END IF;
  RETURN NEW;
END;
$function$;
