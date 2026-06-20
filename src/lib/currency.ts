/**
 * Currency utilities. EUR is the application's BASE currency: live gold prices
 * and product values are stored/displayed in EUR by default. These helpers
 * convert EUR into the secondary operating currency (DZD) using the
 * configurable exchange rate stored in store settings, and format amounts with
 * clear currency labels.
 */
import { getStoreSettings } from "@/lib/store-settings";

export const BASE_CURRENCY = "EUR";

export const SUPPORTED_CURRENCIES = ["EUR", "DZD", "USD"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

const DEFAULT_EUR_TO_DZD = 145;

/** Configured EUR → DZD exchange rate (from store settings, with a safe fallback). */
export function eurToDzdRate(): number {
  const r = Number((getStoreSettings() as { eur_to_dzd?: number }).eur_to_dzd);
  return Number.isFinite(r) && r > 0 ? r : DEFAULT_EUR_TO_DZD;
}

/** How many units of `currency` equal 1 EUR. */
function rateFromEur(currency: string): number {
  switch (currency) {
    case "EUR":
      return 1;
    case "DZD":
      return eurToDzdRate();
    default:
      return 1;
  }
}

/** Convert an EUR amount into the target currency. */
export function convertFromEUR(eur: number | null | undefined, currency: string = BASE_CURRENCY): number {
  if (eur == null || Number.isNaN(eur)) return 0;
  return eur * rateFromEur(currency);
}

/** Convenience: EUR → DZD using the configured rate. */
export function dzdFromEur(eur: number | null | undefined): number {
  return convertFromEUR(eur, "DZD");
}

const FRACTION_DIGITS: Record<string, number> = { EUR: 2, USD: 2, DZD: 0 };

/** Format a value already expressed in `currency`, with the currency symbol/label. */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = BASE_CURRENCY,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(currency === "DZD" ? "fr-DZ" : currency === "EUR" ? "fr-FR" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: FRACTION_DIGITS[currency] ?? 2,
  }).format(value);
}

/** Format an EUR amount. */
export function formatEUR(value: number | null | undefined): string {
  return formatCurrency(value, "EUR");
}

/** Format an EUR amount converted to the target currency, labelled in that currency. */
export function formatFromEUR(eur: number | null | undefined, currency: string): string {
  return formatCurrency(convertFromEUR(eur, currency), currency);
}
