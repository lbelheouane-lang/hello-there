CREATE POLICY "Admins read expense attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'expense-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload expense attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'expense-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update expense attachments"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'expense-attachments' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete expense attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'expense-attachments' AND public.has_role(auth.uid(), 'admin'));