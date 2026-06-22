import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StoreSettings {
  id: string | null;
  store_name: string;
  slogan: string | null;
  tagline: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  social: Record<string, string>;
  tax_id: string | null;
  currency: string;
  language: string;
  invoice_prefix: string;
  receipt_prefix: string;
  invoice_header: string | null;
  invoice_footer: string | null;
  thank_you_message: string | null;
  terms: string | null;
  signature_left: string | null;
  signature_right: string | null;
  eur_to_dzd: number;
  gold_auto_sync: boolean;
  gold_manual_override: boolean;
  gold_manual_price_eur: number | null;
  gold_discrepancy_threshold_pct: number;
  default_theme: string;
  default_mode: string;
  login_logo_url: string | null;
  login_background_url: string | null;
  favicon_url: string | null;
  auto_backup_enabled: boolean;
  auto_backup_frequency: string;
  auto_backup_time: string;
  last_auto_backup_at: string | null;
}

export const DEFAULT_SETTINGS: StoreSettings = {
  id: null,
  store_name: "Maison d'Or",
  slogan: null,
  tagline: "Bijouterie · Or & Joaillerie",
  logo_url: null,
  address: "Rue Didouche Mourad, Alger, Algérie",
  phone: "+213 555 00 00 00",
  email: "contact@maisondor.dz",
  website: null,
  social: {},
  tax_id: "RC 16/00-1234567",
  currency: "DZD",
  language: "fr",
  invoice_prefix: "FACT",
  receipt_prefix: "REC",
  invoice_header: null,
  invoice_footer: "Merci de votre confiance.",
  thank_you_message: "Merci de votre confiance — au plaisir de vous revoir.",
  terms: null,
  signature_left: "Signature du client",
  signature_right: "Cachet & signature du représentant",
  eur_to_dzd: 280,
  gold_auto_sync: true,
  gold_manual_override: false,
  gold_manual_price_eur: null,
  gold_discrepancy_threshold_pct: 2,
  default_theme: "gold",
  default_mode: "light",
  login_logo_url: null,
  login_background_url: null,
  favicon_url: null,
  auto_backup_enabled: false,
  auto_backup_frequency: "weekly",
  auto_backup_time: "02:00",
  last_auto_backup_at: null,
};

export const STORE_SETTINGS_QUERY_KEY = ["store-settings"] as const;

/** Module-level cache so non-React document builders can read branding synchronously. */
let cachedSettings: StoreSettings = DEFAULT_SETTINGS;

export function getStoreSettings(): StoreSettings {
  return cachedSettings;
}

export function setStoreSettingsCache(s: StoreSettings): void {
  cachedSettings = s;
}

function normalize(row: Record<string, unknown> | null): StoreSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    ...DEFAULT_SETTINGS,
    ...row,
    social: (row.social as Record<string, string>) ?? {},
  } as StoreSettings;
}

export async function fetchStoreSettings(): Promise<StoreSettings> {
  // Signed-in users read the full settings row; anonymous visitors (login,
  // public repair tracking) only get safe branding fields via a public view.
  const { data: auth } = await supabase.auth.getSession();

  if (auth.session) {
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    if (error) throw error;
    const settings = normalize(data as Record<string, unknown> | null);
    setStoreSettingsCache(settings);
    return settings;
  }

  const { data, error } = await supabase
    .from("store_branding_public")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  const settings = normalize(data as Record<string, unknown> | null);
  setStoreSettingsCache(settings);
  return settings;
}

/** Loads store branding settings and keeps the module cache in sync. */
export function useStoreSettings() {
  return useQuery({
    queryKey: STORE_SETTINGS_QUERY_KEY,
    queryFn: fetchStoreSettings,
    staleTime: 60_000,
  });
}

const CURRENCY_LABELS: Record<string, string> = {
  DZD: "Dinar algérien (DZD)",
  EUR: "Euro (EUR)",
  USD: "Dollar US (USD)",
  MAD: "Dirham marocain (MAD)",
  TND: "Dinar tunisien (TND)",
  SAR: "Riyal saoudien (SAR)",
  AED: "Dirham des EAU (AED)",
};

export const CURRENCY_OPTIONS = Object.entries(CURRENCY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

export const LANGUAGE_OPTIONS = [
  { value: "fr", label: "Français" },
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
];
