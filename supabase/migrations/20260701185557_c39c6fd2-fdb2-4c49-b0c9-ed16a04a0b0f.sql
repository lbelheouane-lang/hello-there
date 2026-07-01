-- ============================================================
-- MULTI-TENANT — Migration 3/3 : RLS d'isolation par tenant
-- Expressions:
--   TENANT       = tenant_id = current_tenant_id() OR is_super_admin
--   ADMIN_TENANT = (admin AND tenant courant) OR is_super_admin
-- ============================================================

-- ---------- products ----------
DROP POLICY IF EXISTS "Authenticated manage products" ON public.products;
DROP POLICY IF EXISTS "Products viewable by authenticated" ON public.products;
CREATE POLICY "Tenant manage products" ON public.products FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- product_categories ----------
DROP POLICY IF EXISTS "Authenticated manage categories" ON public.product_categories;
DROP POLICY IF EXISTS "Categories viewable by authenticated" ON public.product_categories;
CREATE POLICY "Tenant manage categories" ON public.product_categories FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- product_subcategories ----------
DROP POLICY IF EXISTS "Authenticated manage subcategories" ON public.product_subcategories;
DROP POLICY IF EXISTS "Subcategories viewable by authenticated" ON public.product_subcategories;
CREATE POLICY "Tenant manage subcategories" ON public.product_subcategories FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- jewelry_sets ----------
DROP POLICY IF EXISTS "Authenticated manage sets" ON public.jewelry_sets;
DROP POLICY IF EXISTS "Sets viewable by authenticated" ON public.jewelry_sets;
CREATE POLICY "Tenant manage sets" ON public.jewelry_sets FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- jewelry_set_events ----------
DROP POLICY IF EXISTS "Authenticated manage set events" ON public.jewelry_set_events;
DROP POLICY IF EXISTS "Set events viewable by authenticated" ON public.jewelry_set_events;
CREATE POLICY "Tenant manage set events" ON public.jewelry_set_events FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- scrap_gold ----------
DROP POLICY IF EXISTS "Authenticated manage scrap gold" ON public.scrap_gold;
DROP POLICY IF EXISTS "Scrap gold viewable by authenticated" ON public.scrap_gold;
CREATE POLICY "Tenant manage scrap gold" ON public.scrap_gold FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- scrap_gold_events ----------
DROP POLICY IF EXISTS "Authenticated insert scrap events" ON public.scrap_gold_events;
DROP POLICY IF EXISTS "Scrap events viewable by authenticated" ON public.scrap_gold_events;
CREATE POLICY "Tenant view scrap events" ON public.scrap_gold_events FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant insert scrap events" ON public.scrap_gold_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- repairs ----------
DROP POLICY IF EXISTS "Staff can view repairs" ON public.repairs;
DROP POLICY IF EXISTS "Staff can create repairs" ON public.repairs;
DROP POLICY IF EXISTS "Staff can update repairs" ON public.repairs;
DROP POLICY IF EXISTS "Staff can delete repairs" ON public.repairs;
CREATE POLICY "Tenant manage repairs" ON public.repairs FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- repair_status_history ----------
DROP POLICY IF EXISTS "Staff can view repair history" ON public.repair_status_history;
DROP POLICY IF EXISTS "Staff can add repair history" ON public.repair_status_history;
CREATE POLICY "Tenant view repair history" ON public.repair_status_history FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant insert repair history" ON public.repair_status_history FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- daily_journals ----------
DROP POLICY IF EXISTS "Authenticated can view journals" ON public.daily_journals;
DROP POLICY IF EXISTS "Authenticated can create journals" ON public.daily_journals;
DROP POLICY IF EXISTS "Authenticated can update journals" ON public.daily_journals;
DROP POLICY IF EXISTS "Authenticated can delete journals" ON public.daily_journals;
CREATE POLICY "Tenant manage journals" ON public.daily_journals FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()))
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- stock_movements ----------
DROP POLICY IF EXISTS "Movements viewable by authenticated" ON public.stock_movements;
DROP POLICY IF EXISTS "Authenticated insert movements" ON public.stock_movements;
CREATE POLICY "Tenant view movements" ON public.stock_movements FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant insert movements" ON public.stock_movements FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- product_origin_events ----------
DROP POLICY IF EXISTS "Authenticated can view origin events" ON public.product_origin_events;
DROP POLICY IF EXISTS "Authenticated can insert origin events" ON public.product_origin_events;
CREATE POLICY "Tenant view origin events" ON public.product_origin_events FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant insert origin events" ON public.product_origin_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- product_quantity_events ----------
DROP POLICY IF EXISTS "Authenticated can view quantity events" ON public.product_quantity_events;
DROP POLICY IF EXISTS "Authenticated can insert quantity events" ON public.product_quantity_events;
CREATE POLICY "Tenant view quantity events" ON public.product_quantity_events FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant insert quantity events" ON public.product_quantity_events FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- sales (admin-only update/delete) ----------
DROP POLICY IF EXISTS "Authenticated can view sales" ON public.sales;
DROP POLICY IF EXISTS "Authenticated can create sales" ON public.sales;
DROP POLICY IF EXISTS "Only admins can update sales" ON public.sales;
DROP POLICY IF EXISTS "Only admins can delete sales" ON public.sales;
CREATE POLICY "Tenant view sales" ON public.sales FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant create sales" ON public.sales FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin update sales" ON public.sales FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin delete sales" ON public.sales FOR DELETE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- customers (admin-only update/delete) ----------
DROP POLICY IF EXISTS "Authenticated can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated can create customers" ON public.customers;
DROP POLICY IF EXISTS "Only admins can update customers" ON public.customers;
DROP POLICY IF EXISTS "Only admins can delete customers" ON public.customers;
CREATE POLICY "Tenant view customers" ON public.customers FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant create customers" ON public.customers FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() AND auth.uid() = created_by) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin update customers" ON public.customers FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin delete customers" ON public.customers FOR DELETE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- payments (admin-only update/delete) ----------
DROP POLICY IF EXISTS "Authenticated can view payments" ON public.payments;
DROP POLICY IF EXISTS "Authenticated can create payments" ON public.payments;
DROP POLICY IF EXISTS "Only admins can update payments" ON public.payments;
DROP POLICY IF EXISTS "Only admins can delete payments" ON public.payments;
CREATE POLICY "Tenant view payments" ON public.payments FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant create payments" ON public.payments FOR INSERT TO authenticated
  WITH CHECK ((tenant_id = public.current_tenant_id() AND auth.uid() = recorded_by) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin update payments" ON public.payments FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin delete payments" ON public.payments FOR DELETE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- invoices (read only; inserted via triggers) ----------
DROP POLICY IF EXISTS "Authenticated can view invoices" ON public.invoices;
CREATE POLICY "Tenant view invoices" ON public.invoices FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));

-- ---------- purchases (admin manage) ----------
DROP POLICY IF EXISTS "Admins manage purchases" ON public.purchases;
CREATE POLICY "Tenant admin manage purchases" ON public.purchases FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- expenses (admin manage) ----------
DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;
CREATE POLICY "Tenant admin manage expenses" ON public.expenses FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- expense_categories (read tenant, write admin) ----------
DROP POLICY IF EXISTS "Admins manage expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Authenticated can read expense categories" ON public.expense_categories;
CREATE POLICY "Tenant view expense categories" ON public.expense_categories FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin manage expense categories" ON public.expense_categories FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- audit_logs (admin read) ----------
DROP POLICY IF EXISTS "Audit logs viewable by admins" ON public.audit_logs;
CREATE POLICY "Tenant admin view audit logs" ON public.audit_logs FOR SELECT TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- backups (admin manage) ----------
DROP POLICY IF EXISTS "Admins manage backup history" ON public.backups;
CREATE POLICY "Tenant admin manage backups" ON public.backups FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- ---------- employees (admin manage + own row read) ----------
DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users read own employee row" ON public.employees;
CREATE POLICY "Tenant admin manage employees" ON public.employees FOR ALL TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Users read own employee row" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ---------- store_settings (read tenant, write admin) ----------
DROP POLICY IF EXISTS "Admins can read store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Admins can delete store settings" ON public.store_settings;
CREATE POLICY "Tenant view store settings" ON public.store_settings FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin insert store settings" ON public.store_settings FOR INSERT TO authenticated
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin update store settings" ON public.store_settings FOR UPDATE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));
CREATE POLICY "Tenant admin delete store settings" ON public.store_settings FOR DELETE TO authenticated
  USING ((public.has_role(auth.uid(),'admin') AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));