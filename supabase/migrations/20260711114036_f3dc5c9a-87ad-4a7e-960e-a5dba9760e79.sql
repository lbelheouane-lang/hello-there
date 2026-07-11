DROP VIEW IF EXISTS public.store_settings_app;
DROP VIEW IF EXISTS public.store_branding_public;

CREATE VIEW public.store_branding_public
WITH (security_invoker = on) AS
SELECT
  store_name,
  slogan,
  tagline,
  logo_url,
  login_logo_url,
  login_background_url,
  favicon_url,
  website,
  social,
  currency,
  language,
  default_theme,
  default_mode
FROM public.store_settings
WHERE singleton = true;

CREATE VIEW public.store_settings_app
WITH (security_invoker = on) AS
SELECT
  id,
  singleton,
  store_name,
  slogan,
  tagline,
  logo_url,
  address,
  phone,
  email,
  website,
  social,
  tax_id,
  currency,
  language,
  invoice_prefix,
  receipt_prefix,
  invoice_header,
  invoice_footer,
  thank_you_message,
  terms,
  signature_left,
  signature_right,
  created_at,
  updated_at,
  eur_to_dzd,
  default_theme,
  default_mode,
  login_logo_url,
  login_background_url,
  favicon_url,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN gold_auto_sync ELSE true END AS gold_auto_sync,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN gold_manual_override ELSE false END AS gold_manual_override,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN gold_manual_price_eur ELSE NULL::numeric END AS gold_manual_price_eur,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN gold_discrepancy_threshold_pct ELSE 2::numeric END AS gold_discrepancy_threshold_pct,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN auto_backup_enabled ELSE false END AS auto_backup_enabled,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN auto_backup_frequency ELSE 'weekly'::text END AS auto_backup_frequency,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN auto_backup_time ELSE '02:00'::text END AS auto_backup_time,
  CASE WHEN public.has_role(auth.uid(), 'admin'::public.app_role) THEN last_auto_backup_at ELSE NULL::timestamp with time zone END AS last_auto_backup_at
FROM public.store_settings
WHERE singleton = true;

GRANT SELECT ON public.store_branding_public TO anon, authenticated;
GRANT SELECT ON public.store_settings_app TO authenticated;