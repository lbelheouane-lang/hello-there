-- 1) Public (anonymous) read access limited to demo rows only.
-- These policies NEVER expose production rows (is_demo = false) and grant no writes.
GRANT SELECT ON public.products      TO anon;
GRANT SELECT ON public.customers     TO anon;
GRANT SELECT ON public.suppliers     TO anon;
GRANT SELECT ON public.sales         TO anon;
GRANT SELECT ON public.invoices      TO anon;
GRANT SELECT ON public.payments      TO anon;
GRANT SELECT ON public.expenses      TO anon;
GRANT SELECT ON public.scrap_gold    TO anon;
GRANT SELECT ON public.repairs       TO anon;
GRANT SELECT ON public.jewelry_sets  TO anon;
GRANT SELECT ON public.purchases     TO anon;
GRANT SELECT ON public.gold_prices   TO anon;
GRANT SELECT ON public.product_categories    TO anon;
GRANT SELECT ON public.product_subcategories TO anon;

DROP POLICY IF EXISTS "Demo public read products" ON public.products;
CREATE POLICY "Demo public read products" ON public.products FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read customers" ON public.customers;
CREATE POLICY "Demo public read customers" ON public.customers FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read suppliers" ON public.suppliers;
CREATE POLICY "Demo public read suppliers" ON public.suppliers FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read sales" ON public.sales;
CREATE POLICY "Demo public read sales" ON public.sales FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read invoices" ON public.invoices;
CREATE POLICY "Demo public read invoices" ON public.invoices FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read payments" ON public.payments;
CREATE POLICY "Demo public read payments" ON public.payments FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read expenses" ON public.expenses;
CREATE POLICY "Demo public read expenses" ON public.expenses FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read scrap_gold" ON public.scrap_gold;
CREATE POLICY "Demo public read scrap_gold" ON public.scrap_gold FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read repairs" ON public.repairs;
CREATE POLICY "Demo public read repairs" ON public.repairs FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read jewelry_sets" ON public.jewelry_sets;
CREATE POLICY "Demo public read jewelry_sets" ON public.jewelry_sets FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read purchases" ON public.purchases;
CREATE POLICY "Demo public read purchases" ON public.purchases FOR SELECT TO anon USING (is_demo = true);
DROP POLICY IF EXISTS "Demo public read gold_prices" ON public.gold_prices;
CREATE POLICY "Demo public read gold_prices" ON public.gold_prices FOR SELECT TO anon USING (is_demo = true);
-- Reference data (category names only; no sensitive fields)
DROP POLICY IF EXISTS "Demo public read product_categories" ON public.product_categories;
CREATE POLICY "Demo public read product_categories" ON public.product_categories FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "Demo public read product_subcategories" ON public.product_subcategories;
CREATE POLICY "Demo public read product_subcategories" ON public.product_subcategories FOR SELECT TO anon USING (true);

-- 2) Extend demo cleanup to cover the new demo tables.
CREATE OR REPLACE FUNCTION public.delete_demo_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  DELETE FROM public.repairs WHERE is_demo;
  DELETE FROM public.expenses WHERE is_demo;
  DELETE FROM public.scrap_gold WHERE is_demo;
  DELETE FROM public.purchases WHERE is_demo;
  DELETE FROM public.payments WHERE is_demo;
  DELETE FROM public.sales WHERE is_demo;
  UPDATE public.products SET set_id = NULL WHERE is_demo AND set_id IS NOT NULL;
  DELETE FROM public.jewelry_sets WHERE is_demo;
  DELETE FROM public.products WHERE is_demo;
  DELETE FROM public.customers WHERE is_demo;
  DELETE FROM public.suppliers WHERE is_demo;
  DELETE FROM public.gold_prices WHERE is_demo;
END;
$function$;

-- 3) Add showroom sample rows for the remaining modules to seed_demo_data().
CREATE OR REPLACE FUNCTION public.seed_demo_extras()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  cust_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO cust_ids FROM public.customers WHERE is_demo;

  -- Jewelry sets (parures)
  INSERT INTO public.jewelry_sets (reference, name, notes, is_demo)
  VALUES
    (public.next_set_number(), 'Parure mariée « Lumière » (démo)', 'Collier + boucles + bracelet assortis', true),
    (public.next_set_number(), 'Parure fiançailles « Aurore » (démo)', 'Collier et bague coordonnés', true);

  -- Scrap gold (or cassé) buy-backs from demo customers
  INSERT INTO public.scrap_gold (purchased_at, customer_id, customer_name, weight_grams, gold_karat, price_per_gram, status, notes, is_demo)
  VALUES
    (now() - interval '5 days',  cust_ids[1], 'Amina Benali',   8.40, 18, 7200, 'en_stock',   'Rachat bague ancienne (démo)', true),
    (now() - interval '12 days', cust_ids[3], 'Yasmine Cherif', 15.10, 21, 8400, 'fondu',      'Chaîne cassée refondue (démo)', true),
    (now() - interval '20 days', cust_ids[5], 'Lila Boudjema',  5.60, 22, 8900, 'transforme', 'Or transformé en pièce neuve (démo)', true);

  -- Expenses
  INSERT INTO public.expenses (reference, category, description, amount, payment_method, spent_at, notes, is_demo)
  VALUES
    (public.next_expense_number(), 'Loyer',       'Loyer mensuel boutique',        85000, 'virement', now() - interval '3 days',  'Charge fixe (démo)', true),
    (public.next_expense_number(), 'Salaires',    'Salaire vendeuse',              60000, 'especes',  now() - interval '8 days',  'Charge fixe (démo)', true),
    (public.next_expense_number(), 'Électricité', 'Facture Sonelgaz',              12500, 'especes',  now() - interval '15 days', 'Utilité (démo)', true),
    (public.next_expense_number(), 'Fournitures', 'Écrins et emballages cadeaux',   9800, 'carte',    now() - interval '22 days', 'Consommables (démo)', true);

  -- Repairs
  INSERT INTO public.repairs (reference, tracking_token, customer_id, customer_name, customer_phone, intake_at, jewelry_type, metal_type, purity, weight_grams, jewelry_description, repair_description, estimated_completion, estimated_cost, status, is_demo)
  VALUES
    (public.next_repair_number(), gen_random_uuid(), cust_ids[2], 'Karim Hadjadj', '+213 770 33 44 55', now() - interval '4 days', 'Bague', 'or', '18K', 3.10, 'Bague solitaire', 'Resserrage et polissage', (current_date + 3), 4500, 'in_progress', true),
    (public.next_repair_number(), gen_random_uuid(), cust_ids[4], 'Sofiane Mansouri', '+213 661 99 88 77', now() - interval '9 days', 'Chaîne', 'or', '21K', 6.20, 'Chaîne maille forçat', 'Soudure fermoir', (current_date - 1), 3000, 'ready', true);
END;
$function$;

-- Append extras to the main seed routine.
CREATE OR REPLACE FUNCTION public.seed_demo_data()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  karats int[] := ARRAY[24,22,21,18,14];
  purity numeric[] := ARRAY[1.0,0.916,0.875,0.75,0.585];
  i int;
  dd int;
  base24 numeric;
  cust_ids uuid[];
  prod RECORD;
  idx int := 0;
  total numeric;
  paid numeric;
  pm text;
  pms text[] := ARRAY['especes','cheque','carte','virement'];
BEGIN
  PERFORM public.delete_demo_data();

  INSERT INTO public.suppliers (name, phone, email, address, notes, is_demo) VALUES
    ('Atelier Or & Lumière (démo)', '+213 661 23 45 67', 'contact@orlumiere.dz', 'Rue Didouche Mourad, Alger', 'Fournisseur démo', true),
    ('Comptoir du Bijou (démo)', '+213 770 11 22 33', 'ventes@comptoirbijou.dz', 'Bd Zighoud Youcef, Oran', 'Fournisseur démo', true),
    ('Maison Aurum Import (démo)', '+213 555 98 76 54', 'import@aurum.dz', 'Centre-ville, Constantine', 'Fournisseur démo', true);

  INSERT INTO public.products
    (internal_code, name, category, metal_type, gold_karat, weight_grams,
     metal_purchase_price, labor_cost, making_charge, stone_cost, selling_price,
     supplier_id, status, is_demo)
  VALUES
    ('DEMO-001','Bague solitaire éclat','Bague','or',18,3.20,38000,8000,3000,12000,98000,(SELECT id FROM public.suppliers WHERE name='Atelier Or & Lumière (démo)'),'en_stock',true),
    ('DEMO-002','Alliance torsadée','Alliance','or',21,4.10,52000,6000,2500,0,86000,(SELECT id FROM public.suppliers WHERE name='Atelier Or & Lumière (démo)'),'en_stock',true),
    ('DEMO-003','Bague jonc martelé','Bague','or',22,5.60,76000,9000,3500,0,128000,(SELECT id FROM public.suppliers WHERE name='Comptoir du Bijou (démo)'),'vendu',true),
    ('DEMO-004','Collier maille royale','Collier','or',18,12.40,148000,18000,6000,0,265000,(SELECT id FROM public.suppliers WHERE name='Comptoir du Bijou (démo)'),'en_stock',true),
    ('DEMO-005','Collier pendentif goutte','Collier','or',21,8.70,112000,14000,5000,9000,228000,(SELECT id FROM public.suppliers WHERE name='Maison Aurum Import (démo)'),'vendu',true),
    ('DEMO-006','Chaîne forçat fine','Chaîne','or',18,3.90,46000,5000,2000,0,82000,(SELECT id FROM public.suppliers WHERE name='Maison Aurum Import (démo)'),'en_stock',true),
    ('DEMO-007','Bracelet jonc large','Bracelet','or',22,15.20,205000,22000,8000,0,360000,(SELECT id FROM public.suppliers WHERE name='Atelier Or & Lumière (démo)'),'vendu',true),
    ('DEMO-008','Bracelet gourmette','Bracelet','or',21,9.30,120000,12000,4500,0,210000,(SELECT id FROM public.suppliers WHERE name='Comptoir du Bijou (démo)'),'en_stock',true),
    ('DEMO-009','Boucles d''oreilles créoles','Boucles d''oreilles','or',18,2.80,33000,7000,2500,0,72000,(SELECT id FROM public.suppliers WHERE name='Atelier Or & Lumière (démo)'),'vendu',true),
    ('DEMO-010','Boucles d''oreilles pendantes','Boucles d''oreilles','or',21,4.50,58000,11000,4000,14000,142000,(SELECT id FROM public.suppliers WHERE name='Maison Aurum Import (démo)'),'en_stock',true),
    ('DEMO-011','Pendentif main de Fatma','Pendentif','or',18,2.10,25000,6000,2000,0,58000,(SELECT id FROM public.suppliers WHERE name='Comptoir du Bijou (démo)'),'vendu',true),
    ('DEMO-012','Parure mariage sur mesure','Autre','or',22,28.50,385000,65000,20000,45000,820000,(SELECT id FROM public.suppliers WHERE name='Maison Aurum Import (démo)'),'vendu',true),
    ('DEMO-013','Bague pièce unique gravée','Autre','or',21,6.80,88000,28000,9000,8000,210000,(SELECT id FROM public.suppliers WHERE name='Atelier Or & Lumière (démo)'),'en_reparation',true),
    ('DEMO-014','Collier sautoir 24K','Collier','or',24,18.90,268000,24000,9000,0,470000,(SELECT id FROM public.suppliers WHERE name='Comptoir du Bijou (démo)'),'vendu',true);

  INSERT INTO public.customers (full_name, phone, email, address, notes, is_demo) VALUES
    ('Amina Benali', '+213 661 00 11 22', 'amina.benali@example.dz', 'Cité 1000 logements, Alger', 'Cliente fidèle • achats réguliers', true),
    ('Karim Hadjadj', '+213 770 33 44 55', 'karim.h@example.dz', 'Hai El Badr, Oran', 'Plan de paiement en 3 versements', true),
    ('Yasmine Cherif', '+213 555 66 77 88', 'yasmine.c@example.dz', 'Rue de la Liberté, Constantine', 'Préfère le 21K', true),
    ('Sofiane Mansouri', '+213 661 99 88 77', 'sofiane.m@example.dz', 'Bab Ezzouar, Alger', 'Solde restant à régler', true),
    ('Lila Boudjema', '+213 770 12 34 56', 'lila.b@example.dz', 'Centre-ville, Annaba', 'Mariage prévu', true),
    ('Reda Khelifi', '+213 555 22 33 44', 'reda.k@example.dz', 'Hydra, Alger', 'Paiement comptant habituel', true),
    ('Nadia Saadi', '+213 661 45 67 89', 'nadia.s@example.dz', 'Tlemcen', 'Nouvelle cliente', true);

  SELECT array_agg(id) INTO cust_ids FROM public.customers WHERE is_demo;

  FOR prod IN
    SELECT * FROM public.products WHERE is_demo AND status = 'vendu' ORDER BY internal_code
  LOOP
    idx := idx + 1;
    total := prod.selling_price;
    pm := pms[1 + (idx % 4)];
    paid := CASE idx % 4
      WHEN 0 THEN total
      WHEN 1 THEN round(total * 0.5)
      WHEN 2 THEN round(total * 0.3)
      ELSE 0
    END;
    INSERT INTO public.sales
      (sale_number, customer_id, product_id, product_name, weight_grams,
       total_amount, amount_paid, payment_method, notes, is_demo, created_at, updated_at)
    VALUES
      ('DEMO-V-' || lpad(idx::text, 3, '0'),
       cust_ids[1 + (idx % array_length(cust_ids,1))],
       prod.id, prod.name, prod.weight_grams,
       total, paid, pm,
       CASE idx % 4
         WHEN 0 THEN 'Vente démo • payée intégralement'
         WHEN 1 THEN 'Vente démo • acompte 50% • solde dû'
         WHEN 2 THEN 'Vente démo • plan de paiement (3 versements)'
         ELSE 'Vente démo • impayée • solde total dû'
       END,
       true,
       now() - ((idx * 4) || ' days')::interval,
       now() - ((idx * 4) || ' days')::interval);
  END LOOP;

  FOR dd IN 1..60 LOOP
    base24 := 100 + 12 * sin(dd / 8.0) + 5 * cos(dd / 3.0);
    FOR i IN 1..array_length(karats,1) LOOP
      INSERT INTO public.gold_prices
        (karat, price_per_gram, price_per_ounce, price_date, source, currency, is_demo, fetched_at)
      VALUES
        (karats[i],
         round(base24 * purity[i], 2),
         round(base24 * 31.1035 * purity[i], 2),
         current_date - dd,
         'demo',
         'USD',
         true,
         now() - (dd || ' days')::interval)
      ON CONFLICT (karat, price_date) DO NOTHING;
    END LOOP;
  END LOOP;

  PERFORM public.seed_demo_extras();
END;
$function$;

SELECT public.seed_demo_data();