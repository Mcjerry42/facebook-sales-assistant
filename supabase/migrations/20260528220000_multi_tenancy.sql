-- Add user_id to support Multi-Tenancy
ALTER TABLE public.fb_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.sheets_config ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.knowledge_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- For existing data, we might want to assign them to the admin, but since we don't know the admin's UUID here, 
-- they will remain NULL or whatever default. A script or manual update can link them later if needed.

-- Drop existing admin-only policies
DROP POLICY IF EXISTS "fb_config admin all" ON public.fb_config;
DROP POLICY IF EXISTS "ai_settings admin all" ON public.ai_settings;
DROP POLICY IF EXISTS "sheets_config admin all" ON public.sheets_config;
DROP POLICY IF EXISTS "knowledge admin all" ON public.knowledge_entries;
DROP POLICY IF EXISTS "conversations admin all" ON public.conversations;
DROP POLICY IF EXISTS "messages admin all" ON public.messages;
DROP POLICY IF EXISTS "comments admin all" ON public.comments;
DROP POLICY IF EXISTS "orders admin all" ON public.orders;
DROP POLICY IF EXISTS "analytics admin all" ON public.analytics_events;

-- Create user-scoped multi-tenant policies
CREATE POLICY "fb_config tenant all" ON public.fb_config FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ai_settings tenant all" ON public.ai_settings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sheets_config tenant all" ON public.sheets_config FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "knowledge tenant all" ON public.knowledge_entries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations tenant all" ON public.conversations FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages tenant all" ON public.messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments tenant all" ON public.comments FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "orders tenant all" ON public.orders FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "analytics tenant all" ON public.analytics_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
