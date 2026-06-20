-- Metal origin tracking for inventory items
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS metal_origin text,
  ADD COLUMN IF NOT EXISTS country_of_origin text;

-- History table for origin changes
CREATE TABLE IF NOT EXISTS public.product_origin_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail text,
  metal_origin text,
  country_of_origin text,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_origin_events TO authenticated;
GRANT ALL ON public.product_origin_events TO service_role;

ALTER TABLE public.product_origin_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view origin events"
  ON public.product_origin_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert origin events"
  ON public.product_origin_events FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_product_origin_events_product ON public.product_origin_events(product_id);

-- Trigger to log metal origin assignment / country changes
CREATE OR REPLACE FUNCTION public.log_product_origin_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.metal_origin IS NOT NULL THEN
      INSERT INTO public.product_origin_events (product_id, event_type, detail, metal_origin, country_of_origin, changed_by)
      VALUES (NEW.id, 'origin_assigned',
        'Origine métal définie : ' || NEW.metal_origin ||
        CASE WHEN NEW.country_of_origin IS NOT NULL THEN ' (' || NEW.country_of_origin || ')' ELSE '' END,
        NEW.metal_origin, NEW.country_of_origin, NEW.created_by);
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.metal_origin IS DISTINCT FROM OLD.metal_origin THEN
      INSERT INTO public.product_origin_events (product_id, event_type, detail, metal_origin, country_of_origin, changed_by)
      VALUES (NEW.id, 'origin_assigned',
        'Origine métal : ' || COALESCE(OLD.metal_origin, '—') || ' → ' || COALESCE(NEW.metal_origin, '—'),
        NEW.metal_origin, NEW.country_of_origin, auth.uid());
    END IF;
    IF NEW.country_of_origin IS DISTINCT FROM OLD.country_of_origin THEN
      INSERT INTO public.product_origin_events (product_id, event_type, detail, metal_origin, country_of_origin, changed_by)
      VALUES (NEW.id, 'country_changed',
        'Pays d''origine : ' || COALESCE(OLD.country_of_origin, '—') || ' → ' || COALESCE(NEW.country_of_origin, '—'),
        NEW.metal_origin, NEW.country_of_origin, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_log_product_origin_event
AFTER INSERT OR UPDATE ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_product_origin_event();