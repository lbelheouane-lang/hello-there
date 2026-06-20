-- Expense management (admin only)

CREATE SEQUENCE IF NOT EXISTS public.expense_number_seq;

CREATE OR REPLACE FUNCTION public.next_expense_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'DEP-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.expense_number_seq')::text, 5, '0');
$$;

-- Categories (predefined + custom)
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  is_custom boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expense categories"
  ON public.expense_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Expenses
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reference text NOT NULL UNIQUE DEFAULT public.next_expense_number(),
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'especes',
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  recorded_by uuid,
  notes text,
  attachment_path text,
  spent_at timestamptz NOT NULL DEFAULT now(),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_expenses_updated_at
  BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed predefined categories
INSERT INTO public.expense_categories (name, is_custom) VALUES
  ('Salaires', false),
  ('Vitrines et mobilier', false),
  ('Produits d''entretien', false),
  ('Fournitures de bureau', false),
  ('Équipement et maintenance', false),
  ('Loyer', false),
  ('Charges (eau, électricité, gaz)', false),
  ('Marketing et publicité', false),
  ('Transport', false),
  ('Taxes et frais', false),
  ('Divers', false)
ON CONFLICT (name) DO NOTHING;