
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved_until timestamptz;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;
