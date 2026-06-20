export const KARATS = [24, 22, 21, 18, 14] as const;
export type Karat = (typeof KARATS)[number];

/** Facteur de pureté (titre) appliqué au cours de l'or pur (24K = 100%). */
export const KARAT_PURITY: Record<number, number> = {
  24: 1.0,
  22: 0.916,
  21: 0.875,
  18: 0.75,
  14: 0.585,
};

export const PRODUCT_STATUSES = [
  { value: "en_stock", label: "En stock" },
  { value: "vendu", label: "Vendu" },
  { value: "en_reparation", label: "En réparation" },
] as const;

export const METAL_TYPES = [
  { value: "or", label: "Or" },
  { value: "argent", label: "Argent" },
  { value: "platine", label: "Platine" },
] as const;

export const PAYMENT_METHODS = [
  { value: "especes", label: "Espèces" },
  { value: "cheque", label: "Chèque" },
  { value: "carte", label: "Carte" },
  { value: "virement", label: "Virement" },
] as const;

export function paymentLabel(value: string): string {
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export const CATEGORIES = [
  "Bague",
  "Collier",
  "Bracelet",
  "Boucles d'oreilles",
  "Pendentif",
  "Chaîne",
  "Alliance",
  "Montre",
  "Autre",
] as const;

import { getStoreSettings } from "@/lib/store-settings";

const formatterCache = new Map<string, Intl.NumberFormat>();

function moneyFormatter(currency: string): Intl.NumberFormat {
  let f = formatterCache.get(currency);
  if (!f) {
    try {
      f = new Intl.NumberFormat("fr-DZ", { style: "currency", currency, maximumFractionDigits: 0 });
    } catch {
      f = new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 0 });
    }
    formatterCache.set(currency, f);
  }
  return f;
}

/** Formats an amount using the store's configured currency (defaults to DZD). */
export function formatDZD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return moneyFormatter(getStoreSettings().currency || "DZD").format(value);
}

export function formatGrams(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 3 }).format(value)} g`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium" }).format(new Date(value));
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export function formatRelativeTime(value: string | Date | null | undefined): string {
  if (!value) return "jamais";
  const diffMs = Date.now() - new Date(value).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return formatDateTime(value);
}

export function statusLabel(value: string): string {
  return PRODUCT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

/** Valeur estimée du métal selon poids × cours du gramme pour le titre donné. */
export function metalValue(weight: number, pricePerGram: number | null | undefined): number {
  if (!pricePerGram) return 0;
  return weight * pricePerGram;
}
