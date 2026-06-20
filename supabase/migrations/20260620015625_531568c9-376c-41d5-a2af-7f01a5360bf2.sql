ALTER TABLE public.gold_prices
  ADD COLUMN IF NOT EXISTS price_per_ounce numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'DZD',
  ADD COLUMN IF NOT EXISTS fetched_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS making_charge numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stone_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS selling_price numeric NOT NULL DEFAULT 0;

CREATE TABLE public.audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  entity_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Audit logs viewable by authenticated"
  ON public.audit_logs FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs (event_type);