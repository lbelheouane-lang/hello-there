-- Invoicing system: permanent, auto-generated invoices for every transaction

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq;

CREATE TABLE public.invoices (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number text NOT NULL UNIQUE,
  invoice_type text NOT NULL DEFAULT 'sale', -- 'sale' | 'payment'
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  payment_id uuid REFERENCES public.payments(id) ON DELETE SET NULL,
  sale_number text,
  customer_id uuid,
  customer_name text,
  customer_phone text,
  customer_address text,
  product_id uuid,
  product_sku text,
  product_name text,
  metal_type text,
  gold_karat smallint,
  weight_grams numeric,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  amount_this_tx numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  payment_method text,
  payment_status text NOT NULL DEFAULT 'unpaid',
  sale_type text,
  employee_id uuid,
  employee_name text,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  issued_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.invoice_number_seq TO authenticated, service_role;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view invoices"
  ON public.invoices FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sequential invoice number: FACT-YYYY-000001
CREATE OR REPLACE FUNCTION public.next_invoice_number(_prefix text DEFAULT 'FACT')
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _prefix || '-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.invoice_number_seq')::text, 6, '0');
$$;

-- Status helper
CREATE OR REPLACE FUNCTION public.invoice_status(_total numeric, _paid numeric, _due date)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN _paid >= _total THEN 'paid'
    WHEN _due IS NOT NULL AND _due < current_date THEN 'overdue'
    WHEN _paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END;
$$;

-- Create a 'sale' invoice automatically when a sale is created
CREATE OR REPLACE FUNCTION public.create_sale_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cust RECORD;
  prod RECORD;
  emp_name text;
  bal numeric;
BEGIN
  SELECT full_name, phone, address INTO cust FROM public.customers WHERE id = NEW.customer_id;
  SELECT internal_code, metal_type, gold_karat FROM public.products WHERE id = NEW.product_id INTO prod;
  SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.sold_by;
  bal := GREATEST(NEW.total_amount - NEW.amount_paid, 0);

  INSERT INTO public.invoices (
    invoice_number, invoice_type, sale_id, sale_number,
    customer_id, customer_name, customer_phone, customer_address,
    product_id, product_sku, product_name, metal_type, gold_karat, weight_grams,
    quantity, unit_price, total_amount, amount_this_tx, total_paid, balance,
    payment_method, payment_status, sale_type, employee_id, employee_name, notes, is_demo, issued_at
  ) VALUES (
    public.next_invoice_number('FACT'), 'sale', NEW.id, NEW.sale_number,
    NEW.customer_id, COALESCE(cust.full_name, 'Client de passage'), cust.phone, cust.address,
    NEW.product_id, prod.internal_code, NEW.product_name, prod.metal_type, prod.gold_karat, NEW.weight_grams,
    1, NEW.total_amount, NEW.total_amount, NEW.amount_paid, NEW.amount_paid, bal,
    NEW.payment_method, public.invoice_status(NEW.total_amount, NEW.amount_paid, NEW.due_date),
    NEW.sale_type, NEW.sold_by, emp_name, NEW.notes, COALESCE(NEW.is_demo, false), NEW.created_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_sale_invoice
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.create_sale_invoice();

-- Create a 'payment' invoice (receipt) automatically for each installment payment.
-- Named zz_ so it runs AFTER sync_sale_amount_paid (alphabetical order), ensuring
-- the sale's amount_paid already reflects this payment.
CREATE OR REPLACE FUNCTION public.create_payment_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s RECORD;
  cust RECORD;
  prod RECORD;
  emp_name text;
  bal numeric;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  SELECT full_name, phone, address INTO cust FROM public.customers WHERE id = s.customer_id;
  SELECT internal_code, metal_type, gold_karat FROM public.products WHERE id = s.product_id INTO prod;
  SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.recorded_by;
  bal := GREATEST(s.total_amount - s.amount_paid, 0);

  INSERT INTO public.invoices (
    invoice_number, invoice_type, sale_id, payment_id, sale_number,
    customer_id, customer_name, customer_phone, customer_address,
    product_id, product_sku, product_name, metal_type, gold_karat, weight_grams,
    quantity, unit_price, total_amount, amount_this_tx, total_paid, balance,
    payment_method, payment_status, sale_type, employee_id, employee_name, notes, is_demo, issued_at
  ) VALUES (
    NEW.receipt_number, 'payment', s.id, NEW.id, s.sale_number,
    s.customer_id, COALESCE(cust.full_name, 'Client de passage'), cust.phone, cust.address,
    s.product_id, prod.internal_code, s.product_name, prod.metal_type, prod.gold_karat, s.weight_grams,
    1, s.total_amount, s.total_amount, NEW.amount, s.amount_paid, bal,
    NEW.payment_method, public.invoice_status(s.total_amount, s.amount_paid, s.due_date),
    s.sale_type, NEW.recorded_by, emp_name, NEW.notes, COALESCE(NEW.is_demo, false), NEW.paid_at
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER zz_create_payment_invoice
  AFTER INSERT ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.create_payment_invoice();

-- Backfill 'sale' invoices for existing sales so history is complete
INSERT INTO public.invoices (
  invoice_number, invoice_type, sale_id, sale_number,
  customer_id, customer_name, customer_phone, customer_address,
  product_id, product_sku, product_name, metal_type, gold_karat, weight_grams,
  quantity, unit_price, total_amount, amount_this_tx, total_paid, balance,
  payment_method, payment_status, sale_type, employee_id, employee_name, notes, is_demo, issued_at
)
SELECT
  public.next_invoice_number('FACT'), 'sale', s.id, s.sale_number,
  s.customer_id, COALESCE(c.full_name, 'Client de passage'), c.phone, c.address,
  s.product_id, p.internal_code, s.product_name, p.metal_type, p.gold_karat, s.weight_grams,
  1, s.total_amount, s.total_amount, s.amount_paid, s.amount_paid,
  GREATEST(s.total_amount - s.amount_paid, 0),
  s.payment_method, public.invoice_status(s.total_amount, s.amount_paid, s.due_date),
  s.sale_type, s.sold_by, pr.full_name, s.notes, COALESCE(s.is_demo, false), s.created_at
FROM public.sales s
LEFT JOIN public.customers c ON c.id = s.customer_id
LEFT JOIN public.products p ON p.id = s.product_id
LEFT JOIN public.profiles pr ON pr.id = s.sold_by
ORDER BY s.created_at;