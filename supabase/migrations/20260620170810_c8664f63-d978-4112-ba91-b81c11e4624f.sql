-- Sequence + reference number generator
CREATE SEQUENCE IF NOT EXISTS public.repair_number_seq START 1;

CREATE OR REPLACE FUNCTION public.next_repair_number()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 'REP-' || to_char(now(), 'YYYY') || '-' ||
         lpad(nextval('public.repair_number_seq')::text, 5, '0');
$$;

-- Main repairs table
CREATE TABLE public.repairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE DEFAULT public.next_repair_number(),
  tracking_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name text NOT NULL,
  customer_phone text,
  intake_at timestamptz NOT NULL DEFAULT now(),
  jewelry_type text NOT NULL,
  metal_type text,
  purity text,
  weight_grams numeric,
  jewelry_description text,
  repair_description text NOT NULL,
  estimated_completion date,
  estimated_cost numeric,
  status text NOT NULL DEFAULT 'received',
  notes text,
  photos text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repairs TO authenticated;
GRANT ALL ON public.repairs TO service_role;

ALTER TABLE public.repairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view repairs" ON public.repairs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can create repairs" ON public.repairs
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Staff can update repairs" ON public.repairs
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff can delete repairs" ON public.repairs
  FOR DELETE TO authenticated USING (true);

-- Status history table
CREATE TABLE public.repair_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repair_id uuid NOT NULL REFERENCES public.repairs(id) ON DELETE CASCADE,
  status text NOT NULL,
  note text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_status_history TO authenticated;
GRANT ALL ON public.repair_status_history TO service_role;

ALTER TABLE public.repair_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view repair history" ON public.repair_status_history
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff can add repair history" ON public.repair_status_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE INDEX idx_repair_status_history_repair ON public.repair_status_history(repair_id);

-- updated_at trigger
CREATE TRIGGER update_repairs_updated_at
  BEFORE UPDATE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto status history on insert and on status change
CREATE OR REPLACE FUNCTION public.log_repair_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.repair_status_history (repair_id, status, note, changed_by)
    VALUES (NEW.id, NEW.status, 'Réparation enregistrée', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.repair_status_history (repair_id, status, note, changed_by)
    VALUES (NEW.id, NEW.status, NULL, NEW.created_by);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_repair_status_insert
  AFTER INSERT ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.log_repair_status();

CREATE TRIGGER trg_log_repair_status_update
  AFTER UPDATE ON public.repairs
  FOR EACH ROW EXECUTE FUNCTION public.log_repair_status();

-- Public, read-only tracking via SECURITY DEFINER RPCs (only safe columns exposed)
CREATE OR REPLACE FUNCTION public.get_repair_tracking(_token uuid)
RETURNS TABLE (
  reference text,
  intake_at timestamptz,
  jewelry_type text,
  status text,
  estimated_completion date,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.reference, r.intake_at, r.jewelry_type, r.status, r.estimated_completion, r.updated_at
  FROM public.repairs r
  WHERE r.tracking_token = _token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_repair_tracking_history(_token uuid)
RETURNS TABLE (
  status text,
  note text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.status, h.note, h.created_at
  FROM public.repair_status_history h
  JOIN public.repairs r ON r.id = h.repair_id
  WHERE r.tracking_token = _token
  ORDER BY h.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_repair_tracking(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_repair_tracking_history(uuid) TO anon, authenticated;
