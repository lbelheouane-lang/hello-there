CREATE TABLE public.mobile_pairings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  token text NOT NULL UNIQUE,
  store_id text,
  store_name text,
  license_id text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  device_name text,
  device_user_agent text,
  paired_at timestamptz,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mobile_pairings_status_check CHECK (status IN ('pending','connected','revoked','expired'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mobile_pairings TO authenticated;
GRANT ALL ON public.mobile_pairings TO service_role;

ALTER TABLE public.mobile_pairings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage mobile pairings"
  ON public.mobile_pairings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_mobile_pairings_updated_at
  BEFORE UPDATE ON public.mobile_pairings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_mobile_pairings_status ON public.mobile_pairings (status);