-- ============================================================
-- MULTI-TENANT — Migration 2/3 : tenant_id sur les tables métier
-- ============================================================
DO $$
DECLARE
  hist_id constant uuid := 'c27e42f8-7d28-4f8b-bc58-c37a2877a4bb';
  t text;
  tbls text[] := ARRAY[
    'products','customers','suppliers','sales','payments','invoices','purchases',
    'expenses','expense_categories','product_categories','product_subcategories',
    'jewelry_sets','jewelry_set_events','scrap_gold','scrap_gold_events',
    'repairs','repair_status_history','daily_journals','stock_movements',
    'store_settings','audit_logs','product_origin_events','product_quantity_events',
    'backups','employees','clients','invitations'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    -- 1. add column (nullable first)
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id uuid REFERENCES public.tenants(id)', t);
    -- 2. backfill existing rows to the historical tenant
    EXECUTE format('UPDATE public.%I SET tenant_id = %L WHERE tenant_id IS NULL', t, hist_id);
    -- 3. enforce NOT NULL
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', t);
    -- 4. auto-fill trigger on insert
    EXECUTE format('DROP TRIGGER IF EXISTS set_tenant_id_%I ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER set_tenant_id_%I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_tenant_id()',
      t, t
    );
    -- 5. helpful index
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_tenant ON public.%I(tenant_id)', t, t);
  END LOOP;
END $$;

-- store_settings : une ligne par tenant (au lieu d'un singleton global)
ALTER TABLE public.store_settings DROP CONSTRAINT IF EXISTS store_settings_singleton_key;
CREATE UNIQUE INDEX IF NOT EXISTS store_settings_tenant_unique ON public.store_settings(tenant_id);

-- La vue applicative doit respecter la RLS de l'utilisateur (isolation tenant)
CREATE OR REPLACE VIEW public.store_settings_app
WITH (security_invoker = on) AS
 SELECT id, singleton, store_name, slogan, tagline, logo_url, address, phone, email,
    website, social, tax_id, currency, language, invoice_prefix, receipt_prefix,
    invoice_header, invoice_footer, thank_you_message, terms, signature_left,
    signature_right, created_at, updated_at, eur_to_dzd, default_theme, default_mode,
    login_logo_url, login_background_url, favicon_url,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN gold_auto_sync ELSE true END AS gold_auto_sync,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN gold_manual_override ELSE false END AS gold_manual_override,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN gold_manual_price_eur ELSE NULL::numeric END AS gold_manual_price_eur,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN gold_discrepancy_threshold_pct ELSE (2)::numeric END AS gold_discrepancy_threshold_pct,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN auto_backup_enabled ELSE false END AS auto_backup_enabled,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN auto_backup_frequency ELSE 'weekly'::text END AS auto_backup_frequency,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN auto_backup_time ELSE '02:00'::text END AS auto_backup_time,
    CASE WHEN has_role(auth.uid(), 'admin'::app_role) THEN last_auto_backup_at ELSE NULL::timestamp with time zone END AS last_auto_backup_at
   FROM store_settings
  WHERE singleton = true;