-- Store purchase price per gram permanently on sales and invoices
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS purchase_price_per_gram numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS purchase_price_per_gram numeric;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS gold_value numeric;

-- Recreate sale invoice trigger to capture purchase price per gram + gold value
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
  ppg numeric;
  gval numeric;
BEGIN
  SELECT full_name, phone, address INTO cust FROM public.customers WHERE id = NEW.customer_id;
  SELECT internal_code, metal_type, gold_karat, metal_purchase_price, weight_grams
    INTO prod FROM public.products WHERE id = NEW.product_id;
  SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.sold_by;
  SELECT COALESCE(invoice_prefix, 'FACT') INTO pfx FROM public.store_settings WHERE singleton = true LIMIT 1;
  pfx := COALESCE(pfx, 'FACT');
  bal := GREATEST(NEW.total_amount - NEW.amount_paid, 0);

  -- Purchase price per gram: stored on the sale if provided, else derived from product cost
  ppg := COALESCE(
    NEW.purchase_price_per_gram,
    CASE WHEN COALESCE(prod.weight_grams,0) > 0 THEN prod.metal_purchase_price / prod.weight_grams ELSE NULL END
  );
  gval := COALESCE(NEW.weight_grams, prod.weight_grams, 0) * COALESCE(ppg, 0);

  INSERT INTO public.invoices (
    invoice_number, invoice_type, sale_id, sale_number,
    customer_id, customer_name, customer_phone, customer_address,
    product_id, product_sku, product_name, metal_type, gold_karat, weight_grams,
    purchase_price_per_gram, gold_value,
    quantity, unit_price, total_amount, amount_this_tx, total_paid, balance,
    payment_method, payment_status, sale_type, employee_id, employee_name, notes, is_demo, issued_at
  ) VALUES (
    public.next_invoice_number(pfx), 'sale', NEW.id, NEW.sale_number,
    NEW.customer_id, COALESCE(cust.full_name, 'Client de passage'), cust.phone, cust.address,
    NEW.product_id, prod.internal_code, NEW.product_name, prod.metal_type, prod.gold_karat, NEW.weight_grams,
    ppg, gval,
    1, NEW.total_amount, NEW.total_amount, NEW.amount_paid, NEW.amount_paid, bal,
    NEW.payment_method, public.invoice_status(NEW.total_amount, NEW.amount_paid, NEW.due_date),
    NEW.sale_type, NEW.sold_by, emp_name, NEW.notes, COALESCE(NEW.is_demo, false), NEW.created_at
  );
  RETURN NEW;
END;
$function$;

-- Recreate payment receipt trigger to carry the same stored values from the sale's invoice
CREATE OR REPLACE FUNCTION public.create_payment_invoice()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s RECORD;
  cust RECORD;
  prod RECORD;
  emp_name text;
  bal numeric;
  ppg numeric;
  gval numeric;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id;
  SELECT full_name, phone, address INTO cust FROM public.customers WHERE id = s.customer_id;
  SELECT internal_code, metal_type, gold_karat, metal_purchase_price, weight_grams
    INTO prod FROM public.products WHERE id = s.product_id;
  SELECT full_name INTO emp_name FROM public.profiles WHERE id = NEW.recorded_by;
  bal := GREATEST(s.total_amount - s.amount_paid, 0);

  ppg := COALESCE(
    s.purchase_price_per_gram,
    CASE WHEN COALESCE(prod.weight_grams,0) > 0 THEN prod.metal_purchase_price / prod.weight_grams ELSE NULL END
  );
  gval := COALESCE(s.weight_grams, prod.weight_grams, 0) * COALESCE(ppg, 0);

  INSERT INTO public.invoices (
    invoice_number, invoice_type, sale_id, payment_id, sale_number,
    customer_id, customer_name, customer_phone, customer_address,
    product_id, product_sku, product_name, metal_type, gold_karat, weight_grams,
    purchase_price_per_gram, gold_value,
    quantity, unit_price, total_amount, amount_this_tx, total_paid, balance,
    payment_method, payment_status, sale_type, employee_id, employee_name, notes, is_demo, issued_at
  ) VALUES (
    NEW.receipt_number, 'payment', s.id, NEW.id, s.sale_number,
    s.customer_id, COALESCE(cust.full_name, 'Client de passage'), cust.phone, cust.address,
    s.product_id, prod.internal_code, s.product_name, prod.metal_type, prod.gold_karat, s.weight_grams,
    ppg, gval,
    1, s.total_amount, s.total_amount, NEW.amount, s.amount_paid, bal,
    NEW.payment_method, public.invoice_status(s.total_amount, s.amount_paid, s.due_date),
    s.sale_type, NEW.recorded_by, emp_name, NEW.notes, COALESCE(NEW.is_demo, false), NEW.paid_at
  );
  RETURN NEW;
END;
$function$;