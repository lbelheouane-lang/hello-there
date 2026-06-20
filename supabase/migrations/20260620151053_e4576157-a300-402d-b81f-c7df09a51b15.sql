-- 1. Demo markers
ALTER TABLE public.suppliers   ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.products    ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.customers   ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.sales       ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.gold_prices ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;

-- 2. Delete helper
CREATE OR REPLACE FUNCTION public.delete_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sales WHERE is_demo;
  DELETE FROM public.products WHERE is_demo;     -- cascades stock_movements
  DELETE FROM public.customers WHERE is_demo;
  DELETE FROM public.suppliers WHERE is_demo;
  DELETE FROM public.gold_prices WHERE is_demo;
END;
$$;

-- 3. Seed helper
CREATE OR REPLACE FUNCTION public.seed_demo_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  -- start fresh
  PERFORM public.delete_demo_data();

  -- Suppliers
  INSERT INTO public.suppliers (name, phone, email, address, notes, is_demo) VALUES
    ('Atelier Or & Lumière (démo)', '+213 661 23 45 67', 'contact@orlumiere.dz', 'Rue Didouche Mourad, Alger', 'Fournisseur démo', true),
    ('Comptoir du Bijou (démo)', '+213 770 11 22 33', 'ventes@comptoirbijou.dz', 'Bd Zighoud Youcef, Oran', 'Fournisseur démo', true),
    ('Maison Aurum Import (démo)', '+213 555 98 76 54', 'import@aurum.dz', 'Centre-ville, Constantine', 'Fournisseur démo', true);

  -- Products (one piece per row)
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

  -- Customers
  INSERT INTO public.customers (full_name, phone, email, address, notes, is_demo) VALUES
    ('Amina Benali', '+213 661 00 11 22', 'amina.benali@example.dz', 'Cité 1000 logements, Alger', 'Cliente fidèle • achats réguliers', true),
    ('Karim Hadjadj', '+213 770 33 44 55', 'karim.h@example.dz', 'Hai El Badr, Oran', 'Plan de paiement en 3 versements', true),
    ('Yasmine Cherif', '+213 555 66 77 88', 'yasmine.c@example.dz', 'Rue de la Liberté, Constantine', 'Préfère le 21K', true),
    ('Sofiane Mansouri', '+213 661 99 88 77', 'sofiane.m@example.dz', 'Bab Ezzouar, Alger', 'Solde restant à régler', true),
    ('Lila Boudjema', '+213 770 12 34 56', 'lila.b@example.dz', 'Centre-ville, Annaba', 'Mariage prévu', true),
    ('Reda Khelifi', '+213 555 22 33 44', 'reda.k@example.dz', 'Hydra, Alger', 'Paiement comptant habituel', true),
    ('Nadia Saadi', '+213 661 45 67 89', 'nadia.s@example.dz', 'Tlemcen', 'Nouvelle cliente', true);

  SELECT array_agg(id) INTO cust_ids FROM public.customers WHERE is_demo;

  -- Sales for each sold product, with varied payment situations
  FOR prod IN
    SELECT * FROM public.products WHERE is_demo AND status = 'vendu' ORDER BY internal_code
  LOOP
    idx := idx + 1;
    total := prod.selling_price;
    pm := pms[1 + (idx % 4)];
    -- 0 = fully paid, 1 = partial, 2 = installment (small deposit), 3 = unpaid
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

  -- Historical gold prices in USD for the last 60 days (excluding today)
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
END;
$$;

-- 4. Lock down execution: only the service role (server functions) may run these
REVOKE ALL ON FUNCTION public.seed_demo_data() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_demo_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_demo_data() TO service_role;

-- 5. Populate immediately on first launch (only if there is no data yet)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.products LIMIT 1)
     AND NOT EXISTS (SELECT 1 FROM public.sales LIMIT 1) THEN
    PERFORM public.seed_demo_data();
  END IF;
END;
$$;