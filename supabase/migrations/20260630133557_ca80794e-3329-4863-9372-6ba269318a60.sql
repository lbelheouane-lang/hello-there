
CREATE OR REPLACE FUNCTION public.reset_instance_for_new_client()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Business / transactional data ------------------------------------------
  DELETE FROM public.payments;
  DELETE FROM public.invoices;
  DELETE FROM public.sales;
  DELETE FROM public.repair_status_history;
  DELETE FROM public.repairs;
  DELETE FROM public.scrap_gold_events;
  DELETE FROM public.scrap_gold;
  DELETE FROM public.jewelry_set_events;
  DELETE FROM public.jewelry_sets;
  DELETE FROM public.product_origin_events;
  DELETE FROM public.product_quantity_events;
  DELETE FROM public.stock_movements;
  DELETE FROM public.purchases;
  DELETE FROM public.products;
  DELETE FROM public.expenses;
  DELETE FROM public.customers;
  DELETE FROM public.suppliers;
  DELETE FROM public.daily_journals;
  DELETE FROM public.gold_sync_logs;
  DELETE FROM public.gold_prices;
  DELETE FROM public.audit_logs;
  DELETE FROM public.backups;

  -- Onboarding / invitations test data -------------------------------------
  DELETE FROM public.passkey_events;
  DELETE FROM public.passkeys;
  DELETE FROM public.invitations;
  DELETE FROM public.access_keys;
  DELETE FROM public.clients;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_instance_for_new_client() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_instance_for_new_client() TO service_role;
