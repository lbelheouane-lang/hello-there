CREATE TABLE public.daily_journals (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  journal_date date NOT NULL,
  date_to date,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by uuid,
  generated_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_journals TO authenticated;
GRANT ALL ON public.daily_journals TO service_role;

ALTER TABLE public.daily_journals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view journals"
  ON public.daily_journals FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can create journals"
  ON public.daily_journals FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update journals"
  ON public.daily_journals FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete journals"
  ON public.daily_journals FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_daily_journals_updated_at
  BEFORE UPDATE ON public.daily_journals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();