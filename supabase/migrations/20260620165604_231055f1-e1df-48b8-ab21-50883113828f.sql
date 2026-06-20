ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS eur_to_dzd numeric NOT NULL DEFAULT 145,
  ADD COLUMN IF NOT EXISTS gold_auto_sync boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS gold_manual_override boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gold_manual_price_eur numeric,
  ADD COLUMN IF NOT EXISTS gold_discrepancy_threshold_pct numeric NOT NULL DEFAULT 2;

ALTER TABLE public.store_settings ALTER COLUMN currency SET DEFAULT 'EUR';
UPDATE public.store_settings SET currency = 'EUR' WHERE singleton = true;

ALTER TABLE public.gold_prices ALTER COLUMN currency SET DEFAULT 'EUR';

CREATE TABLE public.gold_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL,
  source text NOT NULL,
  data_source text,
  currency text NOT NULL DEFAULT 'EUR',
  price_per_ounce_eur numeric,
  price_per_gram_eur numeric,
  usd_eur_rate numeric,
  eur_dzd_rate numeric,
  goldrepublic_price_eur numeric,
  app_price_eur numeric,
  discrepancy_eur numeric,
  discrepancy_pct numeric,
  threshold_pct numeric,
  alert boolean NOT NULL DEFAULT false,
  fallback_used boolean NOT NULL DEFAULT false,
  manual_override boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 1,
  products_recalculated integer NOT NULL DEFAULT 0,
  error text,
  raw_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.gold_sync_logs TO authenticated;
GRANT ALL ON public.gold_sync_logs TO service_role;

ALTER TABLE public.gold_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read gold sync logs"
  ON public.gold_sync_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_gold_sync_logs_created_at ON public.gold_sync_logs (created_at DESC);