/**
 * Currency utilities. The gold price module stores and displays values in USD
 * by default. These helpers convert from USD to other operating currencies
 * (DZD, EUR, …) and format amounts with clear currency labels.
 *
 * FX rates are approximate and configurable via VITE_ env vars. They express
 * how many units of the target currency equal 1 USD.
 */
export const BASE_CURRENCY = "USD";

export const FX_FROM_USD: Record<string, number> = {
  USD: 1,
  DZD: Number(import.meta.env.VITE_USD_TO_DZD) || 268,
  EUR: Number(import.meta.env.VITE_USD_TO_EUR) || 0.92,
};

export const SUPPORTED_CURRENCIES = ["USD", "DZD", "EUR"] as const;
export type Currency = (typeof SUPPORTED_CURRENCIES)[number];

/** Convert a USD amount into the target currency. */
export function convertFromUSD(usd: number | null | undefined, currency: string = BASE_CURRENCY): number {
  if (usd == null || Number.isNaN(usd)) return 0;
  return usd * (FX_FROM_USD[currency] ?? 1);
}

/** Convenience: USD → DZD (the store's operating currency for sales). */
export function dzdFromUsd(usd: number | null | undefined): number {
  return convertFromUSD(usd, "DZD");
}

const FRACTION_DIGITS: Record<string, number> = { USD: 2, EUR: 2, DZD: 0 };

/** Format a value already expressed in `currency`, with the currency symbol/label. */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = BASE_CURRENCY,
): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(currency === "DZD" ? "fr-DZ" : "en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: FRACTION_DIGITS[currency] ?? 2,
  }).format(value);
}

/** Format a USD amount. */
export function formatUSD(value: number | null | undefined): string {
  return formatCurrency(value, "USD");
}

/** Format a USD amount converted to the target currency, labelled in that currency. */
export function formatFromUSD(usd: number | null | undefined, currency: string): string {
  return formatCurrency(convertFromUSD(usd, currency), currency);
}
