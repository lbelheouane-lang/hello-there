-- Dedicated Super Admin passkey access system
CREATE TABLE public.super_admin_passkeys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  label text NOT NULL,
  passkey_hash text NOT NULL,
  passkey_salt text NOT NULL,
  is_master boolean NOT NULL DEFAULT false,
  disabled boolean NOT NULL DEFAULT false,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.super_admin_passkeys TO authenticated;
GRANT ALL ON public.super_admin_passkeys TO service_role;
ALTER TABLE public.super_admin_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage super admin passkeys"
ON public.super_admin_passkeys FOR ALL TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE TRIGGER update_super_admin_passkeys_updated_at
BEFORE UPDATE ON public.super_admin_passkeys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Prevent deleting the master passkey (lockout protection)
CREATE OR REPLACE FUNCTION public.prevent_master_passkey_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_master THEN
    RAISE EXCEPTION 'La passkey maître ne peut pas être supprimée.';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_master_passkey_delete
BEFORE DELETE ON public.super_admin_passkeys
FOR EACH ROW EXECUTE FUNCTION public.prevent_master_passkey_delete();

-- Access attempts log
CREATE TABLE public.super_admin_access_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  success boolean NOT NULL,
  passkey_id uuid REFERENCES public.super_admin_passkeys(id) ON DELETE SET NULL,
  label text,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.super_admin_access_log TO authenticated;
GRANT ALL ON public.super_admin_access_log TO service_role;
ALTER TABLE public.super_admin_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins read access log"
ON public.super_admin_access_log FOR SELECT TO authenticated
USING (public.is_super_admin(auth.uid()));