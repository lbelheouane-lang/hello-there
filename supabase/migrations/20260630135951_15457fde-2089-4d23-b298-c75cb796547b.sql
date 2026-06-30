CREATE OR REPLACE FUNCTION public.reset_instance_for_new_client()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Business / transactional data (children before parents) ----------------
  DELETE FROM public.payments;
  DELETE FROM public.invoices;
  DELETE FROM public.sales;
  DELETE FROM public.repair_status_history;
  DELETE FROM public.repairs;
  DELETE FROM public.scrap_gold_events;
  DELETE FROM public.scrap_gold;
  DELETE FROM public.product_origin_events;
  DELETE FROM public.product_quantity_events;
  DELETE FROM public.stock_movements;
  DELETE FROM public.purchases;
  -- products reference jewelry_sets, so products must go first
  DELETE FROM public.jewelry_set_events;
  DELETE FROM public.products;
  DELETE FROM public.jewelry_sets;
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
  -- employees reference clients; detach before deleting clients
  UPDATE public.employees SET client_id = NULL WHERE client_id IS NOT NULL;
  DELETE FROM public.invitations;
  DELETE FROM public.access_keys;
  DELETE FROM public.clients;
END;
$function$;