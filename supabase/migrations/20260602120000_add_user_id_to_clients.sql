-- Add user_id column to clients table
-- Run this in Supabase SQL Editor

-- Add user_id column (links to auth.users)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);

-- Enable RLS if not already enabled
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "clients_select_own" ON clients;
DROP POLICY IF EXISTS "clients_insert_own" ON clients;
DROP POLICY IF EXISTS "clients_update_own" ON clients;

-- Users can only see their own clients row
CREATE POLICY "clients_select_own" ON clients FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own clients row
CREATE POLICY "clients_insert_own" ON clients FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own clients row
CREATE POLICY "clients_update_own" ON clients FOR UPDATE USING (auth.uid() = user_id);

-- Update existing row to link to first user (if any user exists)
-- This assigns the existing client data to the first user who signs up
UPDATE clients SET user_id = (SELECT id FROM auth.users ORDER BY created_at LIMIT 1) WHERE user_id IS NULL;