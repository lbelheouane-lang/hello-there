-- New developer role (compared via ::text to stay safe within this transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'developer';

CREATE OR REPLACE FUNCTION public.is_developer(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'developer'
  )
$$;

-- Licenses
CREATE TABLE public.licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key text NOT NULL UNIQUE,
  store_name text NOT NULL,
  status text NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Suspended','Revoked')),
  activation_date timestamptz,
  last_activity timestamptz,
  max_users integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.licenses TO authenticated;
GRANT ALL ON public.licenses TO service_role;

ALTER TABLE public.licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage licenses" ON public.licenses
FOR ALL TO authenticated
USING (public.is_developer(auth.uid()))
WITH CHECK (public.is_developer(auth.uid()));

CREATE TRIGGER update_licenses_updated_at
BEFORE UPDATE ON public.licenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- License activations
CREATE TABLE public.license_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id uuid NOT NULL REFERENCES public.licenses(id) ON DELETE CASCADE,
  store_name text NOT NULL,
  activated_at timestamptz NOT NULL DEFAULT now(),
  last_activity timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.license_activations TO authenticated;
GRANT ALL ON public.license_activations TO service_role;

ALTER TABLE public.license_activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Developers manage activations" ON public.license_activations
FOR ALL TO authenticated
USING (public.is_developer(auth.uid()))
WITH CHECK (public.is_developer(auth.uid()));

-- Include new tables in backups
CREATE OR REPLACE FUNCTION public.backup_table_list()
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT ARRAY[
    'suppliers','customers',
    'product_categories','product_subcategories',
    'products','jewelry_sets',
    'profiles','user_roles','employees','employee_credentials',
    'gold_prices','gold_sync_logs',
    'expense_categories','expenses',
    'sales','payments','invoices','purchases',
    'scrap_gold','repairs','repair_status_history',
    'daily_journals','store_settings','user_preferences',
    'audit_logs','jewelry_set_events','product_origin_events',
    'product_quantity_events','scrap_gold_events','stock_movements',
    'pin_audit_log','licenses','license_activations'
  ]::text[];
$function$;