
-- 1. Product categories
CREATE TABLE public.product_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories viewable by authenticated" ON public.product_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage categories" ON public.product_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.product_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_categories (name, is_default) VALUES
  ('Bague', true),
  ('Collier', true),
  ('Bracelet', true),
  ('Boucles d''oreilles', true),
  ('Pendentif', true),
  ('Chaîne', true),
  ('Bracelet de cheville', true),
  ('Parure', true),
  ('Pièce personnalisée', true),
  ('Alliance', true),
  ('Montre', true),
  ('Autre', true)
ON CONFLICT (name) DO NOTHING;

-- 2. Jewelry sets (Parures)
CREATE SEQUENCE IF NOT EXISTS public.set_number_seq;

CREATE TABLE public.jewelry_sets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  name text NOT NULL,
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jewelry_sets TO authenticated;
GRANT ALL ON public.jewelry_sets TO service_role;
ALTER TABLE public.jewelry_sets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sets viewable by authenticated" ON public.jewelry_sets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage sets" ON public.jewelry_sets FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_sets_updated BEFORE UPDATE ON public.jewelry_sets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.next_set_number()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'PAR-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.set_number_seq')::text, 5, '0');
$function$;

-- 3. Link products to a parent set (history preserved after sale)
ALTER TABLE public.products
  ADD COLUMN set_id uuid REFERENCES public.jewelry_sets(id) ON DELETE SET NULL;
CREATE INDEX idx_products_set_id ON public.products(set_id);

-- 4. Set audit trail
CREATE TABLE public.jewelry_set_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  set_id uuid REFERENCES public.jewelry_sets(id) ON DELETE CASCADE,
  product_id uuid,
  event_type text NOT NULL,
  detail text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jewelry_set_events TO authenticated;
GRANT ALL ON public.jewelry_set_events TO service_role;
ALTER TABLE public.jewelry_set_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Set events viewable by authenticated" ON public.jewelry_set_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage set events" ON public.jewelry_set_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_set_events_set_id ON public.jewelry_set_events(set_id);

-- 5. Trigger: log when a set item is sold (partial sale / redistribution)
CREATE OR REPLACE FUNCTION public.log_set_item_sale()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.set_id IS NOT NULL AND NEW.status = 'vendu' AND OLD.status IS DISTINCT FROM 'vendu' THEN
    INSERT INTO public.jewelry_set_events (set_id, product_id, event_type, detail)
    VALUES (NEW.set_id, NEW.id, 'item_sold',
      'Pièce vendue : ' || NEW.name || ' — reste dans la catégorie ' || NEW.category);
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_log_set_item_sale
  AFTER UPDATE OF status ON public.products
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.log_set_item_sale();
