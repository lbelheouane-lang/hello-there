-- Per-administrator interface preferences (theme & personalization)
CREATE TABLE public.user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'gold',
  mode text NOT NULL DEFAULT 'light',
  density text NOT NULL DEFAULT 'comfortable',
  sidebar_default text NOT NULL DEFAULT 'expanded',
  landing_page text NOT NULL DEFAULT '/dashboard',
  primary_color text,
  secondary_color text,
  accent_color text,
  sidebar_color text,
  header_color text,
  menu_order text[],
  hidden_widgets text[] NOT NULL DEFAULT '{}',
  widget_order text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT ALL ON public.user_preferences TO service_role;

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own preferences"
  ON public.user_preferences FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- System default theme (super admin / store-wide). New users inherit until they personalize.
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS default_theme text NOT NULL DEFAULT 'gold',
  ADD COLUMN IF NOT EXISTS default_mode text NOT NULL DEFAULT 'light',
  ADD COLUMN IF NOT EXISTS login_logo_url text,
  ADD COLUMN IF NOT EXISTS login_background_url text,
  ADD COLUMN IF NOT EXISTS favicon_url text;