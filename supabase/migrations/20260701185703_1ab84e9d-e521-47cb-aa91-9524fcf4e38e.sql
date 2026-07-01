CREATE OR REPLACE FUNCTION public.provision_tenant_for_user(
  _tenant_id uuid,
  _user_id uuid,
  _key_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _already uuid;
BEGIN
  -- Ne rien faire si l'utilisateur a déjà un tenant
  SELECT tenant_id INTO _already FROM public.profiles WHERE id = _user_id;
  IF _already IS NOT NULL THEN
    RAISE EXCEPTION 'Utilisateur déjà rattaché à un espace.';
  END IF;

  -- Lier le profil au tenant
  UPDATE public.profiles SET tenant_id = _tenant_id WHERE id = _user_id;

  -- Rôle admin (propriétaire de la boutique) dans ce tenant
  INSERT INTO public.user_roles (user_id, role, tenant_id)
  VALUES (_user_id, 'admin', _tenant_id)
  ON CONFLICT DO NOTHING;

  -- Paramètres de boutique par défaut (un par tenant)
  IF NOT EXISTS (SELECT 1 FROM public.store_settings WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.store_settings (tenant_id) VALUES (_tenant_id);
  END IF;

  -- Catégories de produits par défaut
  IF NOT EXISTS (SELECT 1 FROM public.product_categories WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.product_categories (tenant_id, name)
    VALUES (_tenant_id,'Bagues'),(_tenant_id,'Colliers'),(_tenant_id,'Bracelets'),
           (_tenant_id,'Boucles d''oreilles'),(_tenant_id,'Alliances');
  END IF;

  -- Catégories de dépenses par défaut
  IF NOT EXISTS (SELECT 1 FROM public.expense_categories WHERE tenant_id = _tenant_id) THEN
    INSERT INTO public.expense_categories (tenant_id, name)
    VALUES (_tenant_id,'Loyer'),(_tenant_id,'Salaires'),(_tenant_id,'Fournitures'),(_tenant_id,'Divers');
  END IF;

  -- Marquer la clé comme utilisée
  UPDATE public.tenant_access_keys
  SET used_count = used_count + 1,
      status = CASE WHEN used_count + 1 >= max_uses THEN 'used' ELSE status END,
      updated_at = now()
  WHERE id = _key_id;

  -- Activer le tenant
  UPDATE public.tenants SET status = 'active', updated_at = now() WHERE id = _tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.provision_tenant_for_user(uuid,uuid,uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_tenant_for_user(uuid,uuid,uuid) TO service_role;