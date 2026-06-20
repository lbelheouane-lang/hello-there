
-- Sequence + reference generator for purchases
CREATE SEQUENCE IF NOT EXISTS public.purchase_number_seq;

CREATE OR REPLACE FUNCTION public.next_purchase_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 'ACH-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.purchase_number_seq')::text, 5, '0');
$$;

-- Durable, immutable purchase history table
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text,
  product_name text,
  metal_type text,
  gold_karat smallint,
  weight_grams numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  metal_purchase_price numeric NOT NULL DEFAULT 0,
  labor_cost numeric NOT NULL DEFAULT 0,
  making_charge numeric NOT NULL DEFAULT 0,
  stone_cost numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid,
  employee_name text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One purchase per product (prevents duplicates)
CREATE UNIQUE INDEX IF NOT EXISTS purchases_product_id_uniq
  ON public.purchases(product_id) WHERE product_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS purchases_supplier_idx ON public.purchases(supplier_id);
CREATE INDEX IF NOT EXISTS purchases_purchased_at_idx ON public.purchases(purchased_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage purchases"
  ON public.purchases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Automatic recording: create a purchase whenever a product is linked to a supplier
CREATE OR REPLACE FUNCTION public.record_product_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  emp text;
  sup text;
  unit numeric;
BEGIN
  IF NEW.supplier_id IS NULL THEN
    RETURN NEW;
  END IF;
  -- prevent duplicates
  IF EXISTS (SELECT 1 FROM public.purchases WHERE product_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  SELECT full_name INTO emp FROM public.profiles WHERE id = NEW.created_by;
  SELECT name INTO sup FROM public.suppliers WHERE id = NEW.supplier_id;
  unit := COALESCE(NEW.metal_purchase_price,0) + COALESCE(NEW.labor_cost,0)
        + COALESCE(NEW.making_charge,0) + COALESCE(NEW.stone_cost,0);

  INSERT INTO public.purchases (
    reference, supplier_id, supplier_name, product_id, sku, product_name,
    metal_type, gold_karat, weight_grams, quantity,
    metal_purchase_price, labor_cost, making_charge, stone_cost,
    unit_cost, total_cost, notes, recorded_by, employee_name, purchased_at, is_demo
  ) VALUES (
    public.next_purchase_number(), NEW.supplier_id, sup, NEW.id, NEW.internal_code, NEW.name,
    NEW.metal_type, NEW.gold_karat, NEW.weight_grams, 1,
    COALESCE(NEW.metal_purchase_price,0), COALESCE(NEW.labor_cost,0),
    COALESCE(NEW.making_charge,0), COALESCE(NEW.stone_cost,0),
    unit, unit, NEW.origin, NEW.created_by, emp, NEW.created_at, COALESCE(NEW.is_demo,false)
  )
  ON CONFLICT (product_id) WHERE product_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_record_purchase_ins
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.record_product_purchase();

CREATE TRIGGER trg_record_purchase_upd
  AFTER UPDATE OF supplier_id ON public.products
  FOR EACH ROW
  WHEN (OLD.supplier_id IS DISTINCT FROM NEW.supplier_id AND NEW.supplier_id IS NOT NULL)
  EXECUTE FUNCTION public.record_product_purchase();

-- Backfill purchases for all existing products that have a supplier
INSERT INTO public.purchases (
  reference, supplier_id, supplier_name, product_id, sku, product_name,
  metal_type, gold_karat, weight_grams, quantity,
  metal_purchase_price, labor_cost, making_charge, stone_cost,
  unit_cost, total_cost, notes, recorded_by, employee_name, purchased_at, is_demo
)
SELECT
  public.next_purchase_number(), p.supplier_id, s.name, p.id, p.internal_code, p.name,
  p.metal_type, p.gold_karat, p.weight_grams, 1,
  COALESCE(p.metal_purchase_price,0), COALESCE(p.labor_cost,0),
  COALESCE(p.making_charge,0), COALESCE(p.stone_cost,0),
  COALESCE(p.metal_purchase_price,0)+COALESCE(p.labor_cost,0)+COALESCE(p.making_charge,0)+COALESCE(p.stone_cost,0),
  COALESCE(p.metal_purchase_price,0)+COALESCE(p.labor_cost,0)+COALESCE(p.making_charge,0)+COALESCE(p.stone_cost,0),
  p.origin, p.created_by, pr.full_name, p.created_at, COALESCE(p.is_demo,false)
FROM public.products p
LEFT JOIN public.suppliers s ON s.id = p.supplier_id
LEFT JOIN public.profiles pr ON pr.id = p.created_by
WHERE p.supplier_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.purchases pu WHERE pu.product_id = p.id);

-- Keep demo cleanup consistent
CREATE OR REPLACE FUNCTION public.delete_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.purchases WHERE is_demo;
  DELETE FROM public.sales WHERE is_demo;
  DELETE FROM public.products WHERE is_demo;
  DELETE FROM public.customers WHERE is_demo;
  DELETE FROM public.suppliers WHERE is_demo;
  DELETE FROM public.gold_prices WHERE is_demo;
END;
$$;
