-- 1) Restrict direct reads of store_settings to admins only.
DROP POLICY IF EXISTS "Authenticated can read store settings" ON public.store_settings;

CREATE POLICY "Admins can read store settings"
ON public.store_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2) Expose an application view for non-admin authenticated users.
--    Operational fields needed for documents and pricing stay readable;
--    backend automation/config fields are revealed only to admins, with
--    safe defaults returned to everyone else.
CREATE OR REPLACE VIEW public.store_settings_app
WITH (security_invoker = off) AS
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
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN gold_auto_sync ELSE true END AS gold_auto_sync,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN gold_manual_override ELSE false END AS gold_manual_override,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN gold_manual_price_eur ELSE NULL END AS gold_manual_price_eur,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN gold_discrepancy_threshold_pct ELSE 2 END AS gold_discrepancy_threshold_pct,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN auto_backup_enabled ELSE false END AS auto_backup_enabled,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN auto_backup_frequency ELSE 'weekly' END AS auto_backup_frequency,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN auto_backup_time ELSE '02:00' END AS auto_backup_time,
  CASE WHEN public.has_role(auth.uid(), 'admin') THEN last_auto_backup_at ELSE NULL END AS last_auto_backup_at
FROM public.store_settings
WHERE singleton = true;

GRANT SELECT ON public.store_settings_app TO authenticated;

-- 3) Allow non-admin authenticated employees to read expense categories so
--    they can select a category when recording an expense.
CREATE POLICY "Authenticated can read expense categories"
ON public.expense_categories
FOR SELECT
TO authenticated
USING (true);