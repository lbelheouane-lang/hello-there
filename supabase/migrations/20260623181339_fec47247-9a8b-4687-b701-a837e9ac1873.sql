CREATE TABLE public.owner_access (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  backing_email text NOT NULL,
  backing_password text NOT NULL,
  passkey_hash text NOT NULL,
  passkey_salt text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.owner_access TO service_role;

ALTER TABLE public.owner_access ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_owner_access_updated_at
BEFORE UPDATE ON public.owner_access
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();