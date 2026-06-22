-- 1) Public branding view: only safe display fields, no sensitive config.
CREATE OR REPLACE VIEW public.store_branding_public AS
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

-- View runs with the definer's rights so anon can read only these columns.
ALTER VIEW public.store_branding_public SET (security_invoker = false);

GRANT SELECT ON public.store_branding_public TO anon, authenticated;

-- 2) Remove anonymous read access to the full settings table.
DROP POLICY IF EXISTS "Anyone can read store branding" ON public.store_settings;

-- 3) Restrict audit log reads to admins only.
DROP POLICY IF EXISTS "Audit logs viewable by authenticated" ON public.audit_logs;
CREATE POLICY "Audit logs viewable by admins"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));