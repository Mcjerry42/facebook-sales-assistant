-- ============================================
-- MetaPilot - Simplified Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. ENUMS
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. TABLES

-- profiles (user info + approval)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  avatar_url text,
  is_approved boolean DEFAULT false,
  approved_until timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- user_roles (admin/user)
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- fb_config (per user - bot ON/OFF + Facebook page config)
CREATE TABLE IF NOT EXISTS fb_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id text,
  page_name text,
  page_access_token text,
  verify_token text,
  app_secret text,
  connected boolean DEFAULT false,
  bot_enabled boolean DEFAULT false,
  monitored_post_ids text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- ai_settings (per user - AI provider config)
CREATE TABLE IF NOT EXISTS ai_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text DEFAULT 'lovable',
  model text DEFAULT 'google/gemini-2.0-flash',
  api_key text,
  base_url text,
  system_instructions text DEFAULT '',
  language_mode text DEFAULT 'auto',
  auto_reply_messages boolean DEFAULT true,
  auto_reply_comments boolean DEFAULT true,
  auto_hide_abusive boolean DEFAULT true,
  comment_trigger_keywords text[] DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

-- app_settings (global - price, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  package_name text DEFAULT 'default',
  price_bdt numeric DEFAULT 500,
  duration_days integer DEFAULT 30,
  paywall_title text DEFAULT 'Activation Required',
  paywall_message text DEFAULT 'Contact the administrator to activate your account.',
  whatsapp_number text,
  updated_at timestamptz DEFAULT now()
);

-- 3. FUNCTIONS

-- auto_auth: create user if not exists
CREATE OR REPLACE FUNCTION auto_auth(user_email text, user_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_user_id uuid;
  new_user_id uuid;
BEGIN
  SELECT id INTO existing_user_id FROM auth.users WHERE email = user_email LIMIT 1;
  IF existing_user_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'user', jsonb_build_object('id', existing_user_id, 'email', user_email),
      'session', jsonb_build_object('access_token', '', 'refresh_token', '', 'expires_in', 0)
    );
  END IF;
  new_user_id := gen_random_uuid();
  INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, confirmation_token, recovery_token)
  VALUES ('00000000-0000-0000-0000-000000000000', new_user_id, 'authenticated', 'authenticated', user_email, crypt(user_password, gen_salt('bf')), now(), now(), now(), encode(gen_random_bytes(32), 'hex'), encode(gen_random_bytes(32), 'hex'));
  INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (new_user_id, new_user_id, jsonb_build_object('sub', new_user_id::text, 'email', user_email), 'email', now(), now(), now());
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, factor_id, aal, not_after)
  VALUES (gen_random_uuid(), new_user_id, now(), now(), NULL, 'aal1', NULL);
  RETURN jsonb_build_object('user', jsonb_build_object('id', new_user_id, 'email', user_email), 'session', jsonb_build_object('access_token', '', 'refresh_token', '', 'expires_in', 0));
END;
$$;

-- approve_first_user
CREATE OR REPLACE FUNCTION approve_first_user(target_user_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  is_first boolean;
BEGIN
  uid := COALESCE(target_user_id, (SELECT id FROM auth.users ORDER BY created_at LIMIT 1));
  UPDATE profiles SET is_approved = true, approved_until = now() + INTERVAL '90 days' WHERE id = uid;
  SELECT NOT EXISTS(SELECT 1 FROM user_roles WHERE role = 'admin') INTO is_first;
  IF is_first THEN
    INSERT INTO user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
    INSERT INTO profiles (id, is_approved, approved_until) VALUES (uid, true, now() + INTERVAL '90 days')
      ON CONFLICT (id) DO UPDATE SET is_approved = true, approved_until = now() + INTERVAL '90 days';
  END IF;
  INSERT INTO fb_config (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  INSERT INTO ai_settings (user_id) VALUES (uid) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'user_id', uid, 'made_admin', is_first);
END;
$$;

-- has_role
CREATE OR REPLACE FUNCTION has_role(_role app_role, _user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM user_roles WHERE user_id = _user_id AND role = _role); $$;

-- is_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT has_role('admin', auth.uid()); $$;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- handle_new_user (auto-create profile on signup)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_approved)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''), false)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- user_email_map view
CREATE OR REPLACE VIEW user_email_map AS SELECT id, email FROM auth.users;

-- 4. RLS POLICIES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE fb_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "admin_all_profiles" ON profiles;
CREATE POLICY "admin_all_profiles" ON profiles FOR ALL USING (has_role('admin', auth.uid()));

DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
CREATE POLICY "user_roles_select_own" ON user_roles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_all_user_roles" ON user_roles;
CREATE POLICY "admin_all_user_roles" ON user_roles FOR ALL USING (has_role('admin', auth.uid()));

DROP POLICY IF EXISTS "fb_config_select_own" ON fb_config;
CREATE POLICY "fb_config_select_own" ON fb_config FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "fb_config_insert_own" ON fb_config;
CREATE POLICY "fb_config_insert_own" ON fb_config FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "fb_config_update_own" ON fb_config;
CREATE POLICY "fb_config_update_own" ON fb_config FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_all_fb_config" ON fb_config;
CREATE POLICY "admin_all_fb_config" ON fb_config FOR ALL USING (has_role('admin', auth.uid()));

DROP POLICY IF EXISTS "ai_settings_select_own" ON ai_settings;
CREATE POLICY "ai_settings_select_own" ON ai_settings FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_settings_insert_own" ON ai_settings;
CREATE POLICY "ai_settings_insert_own" ON ai_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "ai_settings_update_own" ON ai_settings;
CREATE POLICY "ai_settings_update_own" ON ai_settings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "admin_all_ai_settings" ON ai_settings;
CREATE POLICY "admin_all_ai_settings" ON ai_settings FOR ALL USING (has_role('admin', auth.uid()));

DROP POLICY IF EXISTS "app_settings_select" ON app_settings;
CREATE POLICY "app_settings_select" ON app_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "admin_all_app_settings" ON app_settings;
CREATE POLICY "admin_all_app_settings" ON app_settings FOR ALL USING (has_role('admin', auth.uid()));

-- 5. TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ai_settings_updated_at ON ai_settings;
CREATE TRIGGER update_ai_settings_updated_at BEFORE UPDATE ON ai_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_fb_config_updated_at ON fb_config;
CREATE TRIGGER update_fb_config_updated_at BEFORE UPDATE ON fb_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. DEFAULT DATA
INSERT INTO app_settings (package_name, price_bdt, duration_days, paywall_title, paywall_message, whatsapp_number)
SELECT 'default', 500, 30, 'Activation Required', 'Contact the administrator to activate your account.', NULL
WHERE NOT EXISTS (SELECT 1 FROM app_settings LIMIT 1);