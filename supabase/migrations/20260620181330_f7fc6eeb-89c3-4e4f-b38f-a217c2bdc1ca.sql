-- Add optional subcategory to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory text;

-- Subcategories table (custom subcategories under a category)
CREATE TABLE IF NOT EXISTS public.product_subcategories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id uuid NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (category_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_subcategories TO authenticated;
GRANT ALL ON public.product_subcategories TO service_role;

ALTER TABLE public.product_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Subcategories viewable by authenticated"
  ON public.product_subcategories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated manage subcategories"
  ON public.product_subcategories FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_product_subcategories_updated_at
  BEFORE UPDATE ON public.product_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the two missing predefined jewelry categories
INSERT INTO public.product_categories (name, is_default)
VALUES ('Or de récupération', true), ('Réparations', true)
ON CONFLICT DO NOTHING;