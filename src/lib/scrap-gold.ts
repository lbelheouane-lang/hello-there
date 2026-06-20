import { Recycle, Flame, Sparkles, CheckCircle2, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";
import { getStoreSettings } from "@/lib/store-settings";

/** Gold purities handled for scrap / pre-owned jewelry. */
export const SCRAP_KARATS = [24, 22, 21, 18, 14] as const;

export interface ScrapStatusDef {
  value: string;
  label: string;
  className: string;
  icon: LucideIcon;
}

/** Lifecycle statuses for a scrap-gold purchase. */
export const SCRAP_STATUSES: ScrapStatusDef[] = [
  { value: "en_stock", label: "En stock", className: "bg-amber-100 text-amber-800 hover:bg-amber-100", icon: Recycle },
  { value: "vendu", label: "Vendu", className: "bg-slate-200 text-slate-700 hover:bg-slate-200", icon: ShoppingCart },
  { value: "fondu", label: "Fondu", className: "bg-orange-100 text-orange-800 hover:bg-orange-100", icon: Flame },
  { value: "transforme", label: "Transformé en bijou", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100", icon: Sparkles },
];

export function scrapStatusDef(value: string): ScrapStatusDef {
  return SCRAP_STATUSES.find((s) => s.value === value) ?? SCRAP_STATUSES[0];
}

export function scrapStatusLabel(value: string): string {
  return scrapStatusDef(value).label;
}

/** Human label for an audit-trail event type. */
const EVENT_LABELS: Record<string, string> = {
  created: "Création de l'achat",
  weight_modified: "Modification du poids",
  status_changed: "Changement de statut",
  sold: "Vente",
  melted: "Fonte",
  transformed: "Transformation en bijou",
};

export function scrapEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export const SCRAP_EVENT_ICON: Record<string, LucideIcon> = {
  created: Recycle,
  weight_modified: Recycle,
  status_changed: CheckCircle2,
  sold: ShoppingCart,
  melted: Flame,
  transformed: Sparkles,
};
