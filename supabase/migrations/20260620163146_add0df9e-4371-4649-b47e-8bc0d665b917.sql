CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  store_name text NOT NULL DEFAULT 'Maison d''Or',
  slogan text,
  tagline text DEFAULT 'Bijouterie · Or & Joaillerie',
  logo_url text,
  address text DEFAULT 'Rue Didouche Mourad, Alger, Algérie',
  phone text DEFAULT '+213 555 00 00 00',
  email text DEFAULT 'contact@maisondor.dz',
  website text,
  social jsonb NOT NULL DEFAULT '{}'::jsonb,
  tax_id text DEFAULT 'RC 16/00-1234567',
  currency text NOT NULL DEFAULT 'DZD',
  language text NOT NULL DEFAULT 'fr',
  invoice_prefix text NOT NULL DEFAULT 'FACT',
  receipt_prefix text NOT NULL DEFAULT 'REC',
  invoice_header text,
  invoice_footer text DEFAULT 'Merci de votre confiance.',
  thank_you_message text DEFAULT 'Merci de votre confiance — au plaisir de vous revoir.',
  terms text,
  signature_left text DEFAULT 'Signature du client',
  signature_right text DEFAULT 'Cachet & signature du représentant',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read store settings"
  ON public.store_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert store settings"
  ON public.store_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update store settings"
  ON public.store_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete store settings"
  ON public.store_settings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_store_settings_updated_at
  BEFORE UPDATE ON public.store_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_settings (singleton) VALUES (true)
  ON CONFLICT (singleton) DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_sale_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cust RECORD;
  prod RECORD;
  emp_name text;
  bal numeric;
  pfx text;
BEGIN
  SELECT full_name, phone, address INTO cust FROM public.customers WHERE id = NEW.customer_id;
  SELECT internal_code, metal_type, gold_karat FROM public.products WHERE id = NEW.product_id INTO prod;
  SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.sold_by;
  SELECT COALESCE(invoice_prefix, 'FACT') INTO pfx FROM public.store_settings WHERE singleton = true LIMIT 1;
  pfx := COALESCE(pfx, 'FACT');
  bal := GREATEST(NEW.total_amount - NEW.amount_paid, 0);

  INSERT INTO public.invoices (
    invoice_number, invoice_type, sale_id, sale_number,
    customer_id, customer_name, customer_phone, customer_address,
    product_id, product_sku, product_name, metal_type, gold_karat, weight_grams,
    quantity, unit_price, total_amount, amount_this_tx, total_paid, balance,
    payment_method, payment_status, sale_type, employee_id, employee_name, notes, is_demo, issued_at
  ) VALUES (
    public.next_invoice_number(pfx), 'sale', NEW.id, NEW.sale_number,
    NEW.customer_id, COALESCE(cust.full_name, 'Client de passage'), cust.phone, cust.address,
    NEW.product_id, prod.internal_code, NEW.product_name, prod.metal_type, prod.gold_karat, NEW.weight_grams,
    1, NEW.total_amount, NEW.total_amount, NEW.amount_paid, NEW.amount_paid, bal,
    NEW.payment_method, public.invoice_status(NEW.total_amount, NEW.amount_paid, NEW.due_date),
    NEW.sale_type, NEW.sold_by, emp_name, NEW.notes, COALESCE(NEW.is_demo, false), NEW.created_at
  );
  RETURN NEW;
END;
$function$;