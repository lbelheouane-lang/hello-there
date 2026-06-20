DROP POLICY "Authenticated can update customers" ON public.customers;
CREATE POLICY "Only admins can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));