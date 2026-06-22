
-- ============ Backup history table ============
CREATE TABLE public.backups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name text NOT NULL,
  store_name text,
  size_bytes bigint NOT NULL DEFAULT 0,
  record_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  kind text NOT NULL DEFAULT 'manual',
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backups TO authenticated;
GRANT ALL ON public.backups TO service_role;

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage backup history"
  ON public.backups FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ Auto-backup configuration on store_settings ============
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS auto_backup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_backup_frequency text NOT NULL DEFAULT 'weekly',
  ADD COLUMN IF NOT EXISTS auto_backup_time text NOT NULL DEFAULT '02:00',
  ADD COLUMN IF NOT EXISTS last_auto_backup_at timestamptz;

-- ============ Ordered list of public tables (parents -> children) ============
CREATE OR REPLACE FUNCTION public.backup_table_list()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
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
    'pin_audit_log'
  ]::text[];
$$;

-- ============ Export everything as a single JSON object ============
CREATE OR REPLACE FUNCTION public.backup_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbls text[];
  t text;
  part jsonb;
  result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent créer une sauvegarde.';
  END IF;

  tbls := public.backup_table_list();
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(row_to_json(x)), ''[]''::json)::jsonb FROM public.%I x', t
    ) INTO part;
    result := result || jsonb_build_object(t, part);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.backup_all() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_all() TO authenticated;
GRANT EXECUTE ON FUNCTION public.backup_table_list() TO authenticated;

-- ============ Restore everything from a JSON object ============
CREATE OR REPLACE FUNCTION public.restore_backup(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbls text[];
  t text;
  i int;
  inserted int;
  result jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent restaurer une sauvegarde.';
  END IF;

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Fichier de sauvegarde invalide.';
  END IF;

  tbls := public.backup_table_list();

  -- Disable user triggers so derived rows (invoices, purchases, history,
  -- audit logs) are restored exactly as saved instead of being regenerated.
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
  END LOOP;

  -- Delete existing rows, children first (reverse order).
  FOR i IN REVERSE array_length(tbls, 1)..1 LOOP
    EXECUTE format('DELETE FROM public.%I', tbls[i]);
  END LOOP;

  -- Insert backup rows, parents first.
  FOREACH t IN ARRAY tbls LOOP
    IF payload ? t AND jsonb_typeof(payload->t) = 'array' THEN
      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1->%L)',
        t, t, t
      ) USING payload;
      GET DIAGNOSTICS inserted = ROW_COUNT;
      result := result || jsonb_build_object(t, inserted);
    END IF;
  END LOOP;

  -- Re-enable user triggers.
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;
