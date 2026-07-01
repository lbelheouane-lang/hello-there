-- ============================================================
-- MULTI-TENANT — Migration 1/3 : socle tenants + helpers
-- ============================================================

-- 1. Table tenants -------------------------------------------------
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Clés d'accès tenant (hashées) --------------------------------
CREATE TABLE public.tenant_access_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  label text,
  key_hash text NOT NULL,
  key_salt text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked','used')),
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_access_keys TO authenticated;
GRANT ALL ON public.tenant_access_keys TO service_role;
ALTER TABLE public.tenant_access_keys ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tenant_access_keys_updated_at
  BEFORE UPDATE ON public.tenant_access_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Rattachement utilisateur -> tenant ---------------------------
ALTER TABLE public.profiles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
ALTER TABLE public.user_roles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- 4. Helper: tenant courant (SECURITY DEFINER, pas de récursion RLS)
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 5. Trigger générique: remplit tenant_id à l'insertion -----------
CREATE OR REPLACE FUNCTION public.set_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tenant_id IS NULL THEN
    NEW.tenant_id := public.current_tenant_id();
  END IF;
  RETURN NEW;
END;
$$;

-- 6. RLS des tables tenants ---------------------------------------
-- tenants: super admin gère tout; un utilisateur voit son propre tenant.
CREATE POLICY "Super admin manages tenants"
  ON public.tenants FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Members can view their tenant"
  ON public.tenants FOR SELECT TO authenticated
  USING (id = public.current_tenant_id());

-- tenant_access_keys: super admin uniquement (jamais exposé aux clients)
CREATE POLICY "Super admin manages tenant keys"
  ON public.tenant_access_keys FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 7. Tenant historique + backfill des profils/rôles existants -----
DO $$
DECLARE
  hist_id uuid;
BEGIN
  INSERT INTO public.tenants (name, slug, status)
  VALUES ('Boutique principale', 'boutique-principale', 'active')
  RETURNING id INTO hist_id;

  UPDATE public.profiles SET tenant_id = hist_id WHERE tenant_id IS NULL;
  UPDATE public.user_roles SET tenant_id = hist_id
    WHERE tenant_id IS NULL AND role NOT IN ('super_admin','developer');
END $$;