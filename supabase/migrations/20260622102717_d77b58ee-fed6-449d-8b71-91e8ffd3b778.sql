ALTER TABLE public.scrap_gold ADD COLUMN IF NOT EXISTS estimated_value numeric NOT NULL DEFAULT 0;

UPDATE public.scrap_gold
  SET estimated_value = COALESCE(weight_grams, 0) * COALESCE(price_per_gram, 0);

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
  NEW.estimated_value := COALESCE(NEW.weight_grams, 0) * COALESCE(NEW.price_per_gram, 0);
  IF NEW.total_amount IS NULL OR NEW.total_amount = 0 THEN
    NEW.total_amount := NEW.estimated_value;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.scrap_gold_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.estimated_value := COALESCE(NEW.weight_grams, 0) * COALESCE(NEW.price_per_gram, 0);
  IF NEW.total_amount IS NULL OR NEW.total_amount = 0 THEN
    NEW.total_amount := NEW.estimated_value;
  END IF;
  RETURN NEW;
END;
$function$;

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
      'Achat enregistré : ' || to_char(NEW.weight_grams, 'FM999990.000') || ' g'
      || ' · ' || to_char(NEW.price_per_gram, 'FM999999990') || ' DZD/g'
      || ' · valeur estimée ' || to_char(NEW.estimated_value, 'FM999999990') || ' DZD'
      || ' · montant total ' || to_char(NEW.total_amount, 'FM999999990') || ' DZD',
      NEW.weight_grams, NEW.status, NEW.created_by);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.weight_grams IS DISTINCT FROM OLD.weight_grams THEN
      INSERT INTO public.scrap_gold_events (scrap_id, event_type, detail, weight_grams, status, changed_by)
      VALUES (NEW.id, 'weight_modified',
        'Poids modifié : ' || to_char(OLD.weight_grams, 'FM999990.000') || ' g → ' || to_char(NEW.weight_grams, 'FM999990.000') || ' g',
        NEW.weight_grams, NEW.status, auth.uid());
    END IF;
    IF NEW.total_amount IS DISTINCT FROM OLD.total_amount THEN
      INSERT INTO public.scrap_gold_events (scrap_id, event_type, detail, weight_grams, status, changed_by)
      VALUES (NEW.id, 'weight_modified',
        'Montant total modifié : ' || to_char(OLD.total_amount, 'FM999999990') || ' DZD → ' || to_char(NEW.total_amount, 'FM999999990') || ' DZD'
        || ' (valeur estimée ' || to_char(NEW.estimated_value, 'FM999999990') || ' DZD)',
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