DROP TABLE IF EXISTS public.license_activations CASCADE;
DROP TABLE IF EXISTS public.licenses CASCADE;

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
    'pin_audit_log'
  ]::text[];
$function$;