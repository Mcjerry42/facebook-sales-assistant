-- Add name column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS name text DEFAULT '';