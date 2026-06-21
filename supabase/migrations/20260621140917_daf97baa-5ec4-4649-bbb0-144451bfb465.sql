-- 1. Quantity on products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
UPDATE public.products SET quantity = CASE WHEN status = 'vendu' THEN 0 ELSE 1 END;
ALTER TABLE public.products
  ADD CONSTRAINT products_quantity_non_negative CHECK (quantity >= 0);

-- 2. Quantity on sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
ALTER TABLE public.sales
  ADD CONSTRAINT sales_quantity_positive CHECK (quantity > 0);

-- 3. Quantity history table
CREATE TABLE public.product_quantity_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail text,
  quantity_change integer,
  quantity_after integer NOT NULL,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.product_quantity_events TO authenticated;
GRANT ALL ON public.product_quantity_events TO service_role;

ALTER TABLE public.product_quantity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quantity events"
  ON public.product_quantity_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert quantity events"
  ON public.product_quantity_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_product_quantity_events_product ON public.product_quantity_events(product_id, created_at DESC);

-- 4. Trigger: log quantity events on products
CREATE OR REPLACE FUNCTION public.log_product_quantity_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.product_quantity_events (product_id, event_type, detail, quantity_change, quantity_after, changed_by)
    VALUES (NEW.id, 'initial',
      'Quantité initiale : ' || NEW.quantity || ' pièce(s)',
      NEW.quantity, NEW.quantity, NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' AND NEW.quantity IS DISTINCT FROM OLD.quantity THEN
    IF COALESCE(current_setting('app.sale_context', true), '') = '1' THEN
      INSERT INTO public.product_quantity_events (product_id, event_type, detail, quantity_change, quantity_after, changed_by)
      VALUES (NEW.id, 'quantity_sold',
        'Vente : ' || (OLD.quantity - NEW.quantity) || ' pièce(s) vendue(s) — reste ' || NEW.quantity,
        NEW.quantity - OLD.quantity, NEW.quantity, auth.uid());
    ELSE
      INSERT INTO public.product_quantity_events (product_id, event_type, detail, quantity_change, quantity_after, changed_by)
      VALUES (NEW.id, 'quantity_adjusted',
        'Quantité modifiée : ' || OLD.quantity || ' → ' || NEW.quantity || ' pièce(s)',
        NEW.quantity - OLD.quantity, NEW.quantity, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_product_quantity_event
  AFTER INSERT OR UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.log_product_quantity_event();

-- 5. Trigger: apply sale to inventory (decrement quantity, set status)
CREATE OR REPLACE FUNCTION public.apply_sale_to_inventory()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_qty integer;
BEGIN
  IF NEW.product_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM set_config('app.sale_context', '1', true);
  UPDATE public.products
    SET quantity = GREATEST(quantity - COALESCE(NEW.quantity, 1), 0),
        status = CASE WHEN GREATEST(quantity - COALESCE(NEW.quantity, 1), 0) = 0 THEN 'vendu' ELSE status END,
        updated_at = now()
    WHERE id = NEW.product_id
    RETURNING quantity INTO new_qty;
  PERFORM set_config('app.sale_context', '', true);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_sale_to_inventory
  AFTER INSERT ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.apply_sale_to_inventory();