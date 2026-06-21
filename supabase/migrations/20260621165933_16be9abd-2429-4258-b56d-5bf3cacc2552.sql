-- Permanent relationship between an expense and its generated purchase transaction
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS expense_id uuid REFERENCES public.expenses(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS purchases_expense_id_unique
  ON public.purchases(expense_id) WHERE expense_id IS NOT NULL;

-- Audit history for stock purchases automatically generated from expenses
CREATE OR REPLACE FUNCTION public.log_stock_purchase()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.expense_id IS NOT NULL THEN
    INSERT INTO public.audit_logs (event_type, entity_id, details)
    VALUES ('stock_purchase_created', NEW.id, jsonb_build_object(
      'expense_id', NEW.expense_id,
      'supplier_id', NEW.supplier_id,
      'supplier_name', NEW.supplier_name,
      'amount', NEW.total_cost,
      'reference', NEW.reference,
      'employee_name', NEW.employee_name,
      'recorded_by', NEW.recorded_by,
      'created_at', now()
    ));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_stock_purchase ON public.purchases;
CREATE TRIGGER trg_log_stock_purchase
AFTER INSERT ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.log_stock_purchase();

-- Seed the new expense category
INSERT INTO public.expense_categories (name, is_custom)
VALUES ('Achat de stock', false)
ON CONFLICT DO NOTHING;