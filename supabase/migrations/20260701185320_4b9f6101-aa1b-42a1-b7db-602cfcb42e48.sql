DO $$
DECLARE
  t text;
  tbls text[] := ARRAY[
    'products','customers','suppliers','sales','payments','invoices','purchases',
    'expenses','expense_categories','product_categories','product_subcategories',
    'jewelry_sets','jewelry_set_events','scrap_gold','scrap_gold_events',
    'repairs','repair_status_history','daily_journals','stock_movements',
    'store_settings','audit_logs','product_origin_events','product_quantity_events',
    'backups','employees','clients','invitations'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.current_tenant_id()', t);
  END LOOP;
END $$;