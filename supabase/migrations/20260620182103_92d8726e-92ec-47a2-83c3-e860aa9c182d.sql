-- Reference sequence + generator
CREATE SEQUENCE IF NOT EXISTS public.scrap_number_seq;

CREATE OR REPLACE FUNCTION public.next_scrap_number()
 RETURNS text
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 'OC-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.scrap_number_seq')::text, 5, '0');
$function$;

-- Scrap gold purchases
CREATE TABLE public.scrap_gold (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE,
  purchased_at timestamp with time zone NOT NULL DEFAULT now(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text,
  notes text,
  weight_grams numeric NOT NULL DEFAULT 0,
  gold_karat smallint NOT NULL DEFAULT 18,
  price_per_gram numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'en_stock',
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrap_gold TO authenticated;
GRANT ALL ON public.scrap_gold TO service_role;

ALTER TABLE public.scrap_gold ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scrap gold viewable by authenticated"
  ON public.scrap_gold FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage scrap gold"
  ON public.scrap_gold FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_scrap_gold_updated_at
  BEFORE UPDATE ON public.scrap_gold
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit trail
CREATE TABLE public.scrap_gold_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scrap_id uuid NOT NULL REFERENCES public.scrap_gold(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  detail text,
  weight_grams numeric,
  status text,
  changed_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scrap_gold_events TO authenticated;
GRANT ALL ON public.scrap_gold_events TO service_role;

ALTER TABLE public.scrap_gold_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scrap events viewable by authenticated"
  ON public.scrap_gold_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert scrap events"
  ON public.scrap_gold_events FOR INSERT TO authenticated WITH CHECK (true);

-- Generate reference + enforce total before insert
CREATE OR REPLACE FUNCTION public.scrap_gold_before_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := public.next_scrap_number();
  END IF;
  NEW.total_amount := COALESCE(NEW.weight_grams, 0) * COALESCE(NEW.price_per_gram, 0);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_scrap_gold_before_insert
  BEFORE INSERT ON public.scrap_gold
  FOR EACH ROW EXECUTE FUNCTION public.scrap_gold_before_insert();

-- Recompute total before update
CREATE OR REPLACE FUNCTION public.scrap_gold_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.total_amount := COALESCE(NEW.weight_grams, 0) * COALESCE(NEW.price_per_gram, 0);
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_scrap_gold_before_update
  BEFORE UPDATE ON public.scrap_gold
  FOR EACH ROW EXECUTE FUNCTION public.scrap_gold_before_update();

-- Audit logging
CREATE OR REPLACE FUNCTION public.log_scrap_gold_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.scrap_gold_events (scrap_id, event_type, detail, weight_grams, status, changed_by)
    VALUES (NEW.id, 'created',
      'Achat enregistré : ' || to_char(NEW.weight_grams, 'FM999990.000') || ' g',
      NEW.weight_grams, NEW.status, NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.weight_grams IS DISTINCT FROM OLD.weight_grams THEN
      INSERT INTO public.scrap_gold_events (scrap_id, event_type, detail, weight_grams, status, changed_by)
      VALUES (NEW.id, 'weight_modified',
        'Poids modifié : ' || to_char(OLD.weight_grams, 'FM999990.000') || ' g → ' || to_char(NEW.weight_grams, 'FM999990.000') || ' g',
        NEW.weight_grams, NEW.status, auth.uid());
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.scrap_gold_events (scrap_id, event_type, detail, weight_grams, status, changed_by)
      VALUES (NEW.id,
        CASE NEW.status
          WHEN 'vendu' THEN 'sold'
          WHEN 'fondu' THEN 'melted'
          WHEN 'transforme' THEN 'transformed'
          ELSE 'status_changed'
        END,
        'Statut : ' || OLD.status || ' → ' || NEW.status,
        NEW.weight_grams, NEW.status, auth.uid());
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE TRIGGER trg_log_scrap_gold_event
  AFTER INSERT OR UPDATE ON public.scrap_gold
  FOR EACH ROW EXECUTE FUNCTION public.log_scrap_gold_event();