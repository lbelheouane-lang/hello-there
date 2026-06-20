-- Employees directory (admin-managed)
CREATE TABLE public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL DEFAULT '',
  last_name text NOT NULL DEFAULT '',
  username text NOT NULL UNIQUE,
  phone text,
  role app_role NOT NULL DEFAULT 'employe',
  is_active boolean NOT NULL DEFAULT true,
  permissions text[] NOT NULL DEFAULT '{}',
  last_login_at timestamptz,
  is_bootstrap boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage employees" ON public.employees FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users read own employee row" ON public.employees FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Sensitive credentials: backend (service role) only, no authenticated access
CREATE TABLE public.employee_credentials (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  backing_email text NOT NULL,
  backing_password text NOT NULL,
  pin_hash text NOT NULL,
  pin_salt text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.employee_credentials TO service_role;
ALTER TABLE public.employee_credentials ENABLE ROW LEVEL SECURITY;

-- PIN change/reset history
CREATE TABLE public.pin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid,
  actor_name text,
  target_user_id uuid,
  target_name text,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pin_audit_log TO authenticated;
GRANT ALL ON public.pin_audit_log TO service_role;
ALTER TABLE public.pin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pin audit" ON public.pin_audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_employees_updated BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_emp_creds_updated BEFORE UPDATE ON public.employee_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();