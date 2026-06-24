// Per-administrator interface preferences (theme & personalization).
// Saved per account in `user_preferences`; new users inherit the system
// default theme from store_settings until they personalize.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/data-client";
import { getTheme, type ColorMode, type Density } from "@/lib/themes";

export interface UserPreferences {
  theme: string;
  mode: ColorMode;
  density: Density;
  sidebar_default: "expanded" | "collapsed";
  landing_page: string;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  sidebar_color: string | null;
  header_color: string | null;
  menu_order: string[] | null;
  hidden_widgets: string[];
  widget_order: string[] | null;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "gold",
  mode: "light",
  density: "comfortable",
  sidebar_default: "expanded",
  landing_page: "/dashboard",
  primary_color: null,
  secondary_color: null,
  accent_color: null,
  sidebar_color: null,
  header_color: null,
  menu_order: null,
  hidden_widgets: [],
  widget_order: null,
};

export const LANDING_PAGE_OPTIONS = [
  { value: "/dashboard", label: "Tableau de bord" },
  { value: "/nouvelle-vente", label: "Nouvelle vente" },
  { value: "/stock", label: "Stock" },
  { value: "/factures", label: "Ventes" },
  { value: "/clients", label: "Clients" },
  { value: "/cours-or", label: "Cours de l'or" },
];

export const DASHBOARD_WIDGETS = [
  { key: "stats", label: "Cartes de statistiques" },
  { key: "gold_widget", label: "Widget cours de l'or" },
  { key: "gold_grid", label: "Grille des cours au gramme" },
  { key: "top_categories", label: "Catégories les plus vendues" },
];

export const USER_PREFERENCES_QUERY_KEY = ["user-preferences"] as const;

function normalize(row: Record<string, unknown> | null): UserPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  return {
    ...DEFAULT_PREFERENCES,
    ...row,
    hidden_widgets: (row.hidden_widgets as string[]) ?? [],
  } as UserPreferences;
}

/** Navigation items available for menu-order personalization (admin view). */
export const MENU_ITEMS = [
  { to: "/dashboard", label: "Tableau de bord" },
  { to: "/nouvelle-vente", label: "Nouvelle vente" },
  { to: "/clients", label: "Clients" },
  { to: "/paiements-en-attente", label: "Paiements en attente" },
  { to: "/factures", label: "Ventes" },
  { to: "/reparations", label: "Réparations" },
  { to: "/stock", label: "Stock" },
  { to: "/parures", label: "Parures" },
  { to: "/or-casse", label: "Or Cassé" },
  { to: "/fournisseurs", label: "Fournisseurs" },
  { to: "/depenses", label: "Dépenses" },
  { to: "/cours-or", label: "Cours de l'or" },
  { to: "/boutique", label: "Boutique" },
  { to: "/parametres", label: "Paramètres" },
];

export async function fetchUserPreferences(): Promise<UserPreferences> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return DEFAULT_PREFERENCES;

  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw error;

  if (data) return normalize(data as Record<string, unknown>);

  // New user: inherit the system default theme from store settings.
  const { data: store } = await supabase
    .from("store_settings")
    .select("default_theme, default_mode")
    .eq("singleton", true)
    .maybeSingle();
  const s = store as { default_theme?: string; default_mode?: ColorMode } | null;
  return {
    ...DEFAULT_PREFERENCES,
    theme: s?.default_theme ?? DEFAULT_PREFERENCES.theme,
    mode: s?.default_mode ?? DEFAULT_PREFERENCES.mode,
  };
}

export function useUserPreferences() {
  return useQuery({
    queryKey: USER_PREFERENCES_QUERY_KEY,
    queryFn: fetchUserPreferences,
    staleTime: 30_000,
  });
}

export async function saveUserPreferences(
  patch: Partial<UserPreferences>,
): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) throw new Error("Non authentifié.");
  const { error } = await supabase
    .from("user_preferences")
    .upsert({ user_id: uid, ...patch }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Applies a set of preferences to the document root (live theme switching). */
export function applyPreferences(prefs: UserPreferences): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const theme = getTheme(prefs.theme);

  // Resolve effective color mode (some themes force a mode).
  const mode: ColorMode = theme.forceMode ?? prefs.mode;
  root.classList.toggle("dark", mode === "dark");

  // Clear previously applied theme/custom overrides.
  const managedVars = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--border", "--input", "--ring",
    "--sidebar", "--sidebar-foreground", "--sidebar-primary",
    "--sidebar-primary-foreground", "--sidebar-accent",
    "--sidebar-accent-foreground", "--sidebar-border", "--header-background",
  ];
  for (const v of managedVars) root.style.removeProperty(v);

  // Apply theme tokens.
  for (const [k, v] of Object.entries(theme.vars)) root.style.setProperty(k, v);

  // Apply per-user custom color overrides (take precedence over the theme).
  if (prefs.primary_color) root.style.setProperty("--primary", prefs.primary_color);
  if (prefs.secondary_color) root.style.setProperty("--secondary", prefs.secondary_color);
  if (prefs.accent_color) root.style.setProperty("--accent", prefs.accent_color);
  if (prefs.sidebar_color) root.style.setProperty("--sidebar", prefs.sidebar_color);
  if (prefs.header_color) root.style.setProperty("--header-background", prefs.header_color);

  // Density.
  root.classList.toggle("density-compact", prefs.density === "compact");
  root.dataset.theme = prefs.theme;
}
