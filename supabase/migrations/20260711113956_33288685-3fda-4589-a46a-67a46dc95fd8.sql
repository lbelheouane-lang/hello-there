DROP POLICY IF EXISTS "Demo public read product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Demo public read product_subcategories" ON public.product_subcategories;

REVOKE SELECT ON public.product_categories FROM anon;
REVOKE SELECT ON public.product_subcategories FROM anon;