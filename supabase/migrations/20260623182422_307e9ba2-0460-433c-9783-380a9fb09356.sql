ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS activated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_key text;