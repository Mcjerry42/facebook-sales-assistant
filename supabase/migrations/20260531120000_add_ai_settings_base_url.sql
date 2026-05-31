-- Add base_url column to ai_settings for custom API endpoints (DeepSeek, OpenAI, etc.)
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS base_url TEXT;