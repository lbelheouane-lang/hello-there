-- Harden role checks and tenant-scoped visibility.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (
        ur.tenant_id IS NULL
        OR ur.tenant_id = public.current_tenant_id()
        OR _role IN ('super_admin'::public.app_role, 'developer'::public.app_role)
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_tenant(_user_id uuid, _role app_role, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND (ur.tenant_id = _tenant_id OR ur.role IN ('super_admin'::public.app_role, 'developer'::public.app_role))
  )
$$;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
$$;

-- Suppliers were globally open. Replace with tenant-scoped policies.
DROP POLICY IF EXISTS "Authenticated manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Suppliers viewable by authenticated" ON public.suppliers;
DROP POLICY IF EXISTS "Tenant manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Tenant view suppliers" ON public.suppliers;

CREATE POLICY "Tenant view suppliers"
ON public.suppliers
FOR SELECT
TO authenticated
USING ((tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant manage suppliers"
ON public.suppliers
FOR ALL
TO authenticated
USING (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employe'::public.app_role)) AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()))
WITH CHECK (((public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'employe'::public.app_role)) AND tenant_id = public.current_tenant_id()) OR public.is_super_admin(auth.uid()));

-- Profiles contained personal data and were globally visible.
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Tenant admins view tenant profiles" ON public.profiles;

CREATE POLICY "Users view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Tenant admins view tenant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND tenant_id = public.current_tenant_id()
);

-- User roles must not leak globally to any tenant admin.
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Tenant admins view roles" ON public.user_roles;

CREATE POLICY "Tenant admins view roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin(auth.uid())
  OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND tenant_id = public.current_tenant_id())
);

CREATE POLICY "Tenant admins manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND tenant_id = public.current_tenant_id()))
WITH CHECK (public.is_super_admin(auth.uid()) OR (public.has_role(auth.uid(), 'admin'::public.app_role) AND tenant_id = public.current_tenant_id()));

-- Keep backup/restore tenant-scoped so an admin cannot export or erase another boutique's data.
CREATE OR REPLACE FUNCTION public.backup_all()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbls text[];
  t text;
  part jsonb;
  result jsonb := '{}'::jsonb;
  tid uuid := public.current_tenant_id();
  has_tenant boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent créer une sauvegarde.';
  END IF;

  IF tid IS NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Aucune boutique associée à ce compte.';
  END IF;

  tbls := public.backup_table_list();
  FOREACH t IN ARRAY tbls LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
    ) INTO has_tenant;

    IF has_tenant AND NOT public.is_super_admin(auth.uid()) THEN
      EXECUTE format(
        'SELECT COALESCE(jsonb_agg(row_to_json(x)), ''[]''::json)::jsonb FROM public.%I x WHERE tenant_id = $1', t
      ) INTO part USING tid;
    ELSE
      EXECUTE format(
        'SELECT COALESCE(jsonb_agg(row_to_json(x)), ''[]''::json)::jsonb FROM public.%I x', t
      ) INTO part;
    END IF;
    result := result || jsonb_build_object(t, part);
  END LOOP;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_backup(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tbls text[];
  t text;
  i int;
  inserted int;
  result jsonb := '{}'::jsonb;
  tid uuid := public.current_tenant_id();
  has_tenant boolean;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Seuls les administrateurs peuvent restaurer une sauvegarde.';
  END IF;

  IF tid IS NULL AND NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Aucune boutique associée à ce compte.';
  END IF;

  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' THEN
    RAISE EXCEPTION 'Fichier de sauvegarde invalide.';
  END IF;

  tbls := public.backup_table_list();

  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER USER', t);
  END LOOP;

  FOR i IN REVERSE array_length(tbls, 1)..1 LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbls[i] AND column_name = 'tenant_id'
    ) INTO has_tenant;

    IF has_tenant AND NOT public.is_super_admin(auth.uid()) THEN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = $1', tbls[i]) USING tid;
    ELSIF public.is_super_admin(auth.uid()) THEN
      EXECUTE format('DELETE FROM public.%I', tbls[i]);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY tbls LOOP
    IF payload ? t AND jsonb_typeof(payload->t) = 'array' THEN
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = t AND column_name = 'tenant_id'
      ) INTO has_tenant;

      EXECUTE format(
        'INSERT INTO public.%I SELECT * FROM jsonb_populate_recordset(NULL::public.%I, $1->%L)',
        t, t, t
      ) USING payload;

      IF has_tenant AND NOT public.is_super_admin(auth.uid()) THEN
        EXECUTE format('UPDATE public.%I SET tenant_id = $1 WHERE tenant_id IS NULL OR tenant_id <> $1', t) USING tid;
      END IF;

      GET DIAGNOSTICS inserted = ROW_COUNT;
      result := result || jsonb_build_object(t, inserted);
    END IF;
  END LOOP;

  FOREACH t IN ARRAY tbls LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER USER', t);
  END LOOP;

  RETURN result;
END;
$$;

-- Function execution hardening.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.has_role_in_tenant(uuid, public.app_role, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role_in_tenant(uuid, public.app_role, uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.current_tenant_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_tenant_id() TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.backup_all() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.backup_all() TO authenticated;
REVOKE ALL ON FUNCTION public.restore_backup(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.restore_backup(jsonb) TO authenticated;