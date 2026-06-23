ALTER TABLE public.mobile_pairings
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS last_sync timestamptz;

CREATE INDEX IF NOT EXISTS idx_mobile_pairings_device_id ON public.mobile_pairings (device_id);