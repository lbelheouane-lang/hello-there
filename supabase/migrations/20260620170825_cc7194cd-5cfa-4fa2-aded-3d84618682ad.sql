CREATE POLICY "Staff read repair photos" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'repair-photos');
CREATE POLICY "Staff upload repair photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'repair-photos');
CREATE POLICY "Staff update repair photos" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'repair-photos');
CREATE POLICY "Staff delete repair photos" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'repair-photos');
