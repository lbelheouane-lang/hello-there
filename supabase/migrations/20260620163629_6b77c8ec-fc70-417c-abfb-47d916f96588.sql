GRANT SELECT ON public.store_settings TO anon;

CREATE POLICY "Anyone can read store branding"
  ON public.store_settings FOR SELECT TO anon
  USING (true);