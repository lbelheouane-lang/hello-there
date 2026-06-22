
ALTER TABLE public.backups
  ADD COLUMN IF NOT EXISTS storage_path text;

-- Only administrators may manage files in the private "backups" bucket.
CREATE POLICY "Admins read backup files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload backup files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete backup files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'backups' AND public.has_role(auth.uid(), 'admin'));
