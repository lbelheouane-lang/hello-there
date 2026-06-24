ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url text;

CREATE POLICY "Staff read product photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'product-photos');
CREATE POLICY "Staff upload product photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos');
CREATE POLICY "Staff update product photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'product-photos');
CREATE POLICY "Staff delete product photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-photos');