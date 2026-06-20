-- Add installment fields to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS due_date date;

-- Payments table: records each installment payment registered after a sale
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL DEFAULT 'especes',
  paid_at timestamp with time zone NOT NULL DEFAULT now(),
  recorded_by uuid REFERENCES auth.users(id),
  notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view payments"
  ON public.payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create payments"
  ON public.payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Only admins can update payments"
  ON public.payments FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete payments"
  ON public.payments FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Keep sales.amount_paid in sync with registered payments (incremental).
-- Initial down payment stays in sales.amount_paid; each extra payment adjusts it.
CREATE OR REPLACE FUNCTION public.sync_sale_amount_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sales SET amount_paid = amount_paid + NEW.amount, updated_at = now() WHERE id = NEW.sale_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sales SET amount_paid = GREATEST(amount_paid - OLD.amount, 0), updated_at = now() WHERE id = OLD.sale_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.sales SET amount_paid = GREATEST(amount_paid - OLD.amount + NEW.amount, 0), updated_at = now() WHERE id = NEW.sale_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_sale_amount_paid_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_sale_amount_paid();