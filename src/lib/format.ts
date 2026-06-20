export const KARATS = [24, 22, 21, 18] as const;
export type Karat = (typeof KARATS)[number];

export const KARAT_PURITY: Record<number, number> = {
  24: 0.999,
  22: 0.916,
  21: 0.875,
  18: 0.75,
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

const dzd = new Intl.NumberFormat("fr-DZ", {
  style: "currency",
  currency: "DZD",
  maximumFractionDigits: 0,
});

export function formatDZD(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return dzd.format(value);
}

export function formatGrams(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${new Intl.NumberFormat("fr-DZ", { maximumFractionDigits: 3 }).format(value)} g`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-DZ", { dateStyle: "medium" }).format(new Date(value));
}

export function statusLabel(value: string): string {
  return PRODUCT_STATUSES.find((s) => s.value === value)?.label ?? value;
}

/** Valeur estimée du métal selon poids × cours du gramme pour le titre donné. */
export function metalValue(weight: number, pricePerGram: number | null | undefined): number {
  if (!pricePerGram) return 0;
  return weight * pricePerGram;
}
