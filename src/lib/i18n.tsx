// Lightweight bilingual (FR/AR) i18n layer for ORUS.
// - Language choice is persisted per browser in localStorage ("orus_lang").
// - Layout stays LTR in both languages (per product decision); only the
//   text content changes. The <html lang> attribute is updated for a11y.
// - Missing keys fall back to the French string, then to the key itself.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "fr" | "ar";

const STORAGE_KEY = "orus_lang";

/** Translation dictionary. Keys are stable identifiers; values per language. */
export const MESSAGES: Record<string, { fr: string; ar: string }> = {
  // Generic
  "common.language": { fr: "Langue", ar: "اللغة" },
  "common.french": { fr: "Français", ar: "الفرنسية" },
  "common.arabic": { fr: "العربية", ar: "العربية" },

  // Sidebar / navigation
  "nav.navigation": { fr: "Navigation", ar: "التنقل" },
  "nav.dashboard": { fr: "Tableau de bord", ar: "لوحة القيادة" },
  "nav.new_sale": { fr: "Nouvelle vente", ar: "بيع جديد" },
  "nav.customers": { fr: "Clients", ar: "العملاء" },
  "nav.pending_payments": { fr: "Paiements en attente", ar: "مدفوعات معلقة" },
  "nav.sales": { fr: "Ventes", ar: "المبيعات" },
  "nav.sales_invoices": { fr: "Ventes & Factures", ar: "المبيعات والفواتير" },
  "nav.repairs": { fr: "Réparations", ar: "الإصلاحات" },
  "nav.stock": { fr: "Stock", ar: "المخزون" },
  "nav.sets": { fr: "Parures", ar: "الأطقم" },
  "nav.scrap_gold": { fr: "Or Cassé", ar: "الذهب المكسور" },
  "nav.suppliers": { fr: "Fournisseurs", ar: "الموردون" },
  "nav.expenses": { fr: "Dépenses", ar: "المصاريف" },
  "nav.daily_journal": { fr: "Journal Quotidien", ar: "اليومية" },
  "nav.gold_price": { fr: "Cours de l'or", ar: "سعر الذهب" },
  "nav.store": { fr: "Boutique", ar: "المتجر" },
  "nav.settings": { fr: "Paramètres", ar: "الإعدادات" },

  // Shell footer / roles
  "role.admin": { fr: "Administrateur", ar: "مدير" },
  "role.developer": { fr: "Développeur", ar: "مطور" },
  "role.employee": { fr: "Employé", ar: "موظف" },
  "shell.switch_role": { fr: "Changer de rôle", ar: "تغيير الدور" },
  "shell.sign_out": { fr: "Déconnexion", ar: "تسجيل الخروج" },
  "shell.visitor": { fr: "Visiteur", ar: "زائر" },
  "shell.demo_mode": { fr: "Mode démonstration", ar: "وضع العرض" },
  "shell.exit_demo": { fr: "Quitter la démo", ar: "الخروج من العرض" },
  "shell.demo": { fr: "Démonstration", ar: "عرض توضيحي" },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, fallback?: string) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "ar" ? "ar" : "fr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = lang;
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
    }
  }, []);

  const t = useCallback(
    (key: string, fallback?: string) => {
      const entry = MESSAGES[key];
      if (!entry) return fallback ?? key;
      return entry[lang] || entry.fr || fallback || key;
    },
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Safe fallback so components never crash outside the provider.
    return {
      lang: "fr",
      setLang: () => {},
      t: (key, fallback) => MESSAGES[key]?.fr ?? fallback ?? key,
    };
  }
  return ctx;
}
