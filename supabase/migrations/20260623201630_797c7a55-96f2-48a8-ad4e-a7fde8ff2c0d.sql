
-- 1. New 'client' role for passkey signups
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'client';

-- 2. Passkeys table (brand-new, dedicated to account creation)
CREATE TABLE public.passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text,
  disabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  used_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_by_email text,
  used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.passkeys TO authenticated;
GRANT ALL ON public.passkeys TO service_role;

ALTER TABLE public.passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage passkeys"
  ON public.passkeys FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_passkeys_updated_at
  BEFORE UPDATE ON public.passkeys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Passkey event log (creation + usage auditing)
CREATE TABLE public.passkey_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passkey_id uuid REFERENCES public.passkeys(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  detail text,
  actor uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.passkey_events TO authenticated;
GRANT ALL ON public.passkey_events TO service_role;

ALTER TABLE public.passkey_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read passkey events"
  ON public.passkey_events FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()));

-- 4. Account management fields on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_passkey_id uuid REFERENCES public.passkeys(id) ON DELETE SET NULL;

-- 5. Include the new tables in backups
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
    'pin_audit_log','passkeys','passkey_events'
  ]::text[];
$function$;
