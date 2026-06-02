-- Add Facebook fields to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fb_page_id text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fb_page_token text DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS fb_status text DEFAULT 'off';