import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KARATS } from "@/lib/format";

export interface GoldPrice {
  id: string;
  karat: number;
  price_per_gram: number;
  price_per_ounce: number | null;
  currency: string;
  price_date: string;
  fetched_at: string;
  source: string;
}

/** Dernier cours connu pour chaque titre. */
export function useLatestGoldPrices() {
  return useQuery({
    queryKey: ["gold_prices", "latest"],
    refetchInterval: 60_000,
    queryFn: async (): Promise<Record<number, GoldPrice>> => {
      const { data, error } = await supabase
        .from("gold_prices")
        .select("*")
        .order("fetched_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      const latest: Record<number, GoldPrice> = {};
      for (const row of data as GoldPrice[]) {
        if (!latest[row.karat]) latest[row.karat] = row;
      }
      return latest;
    },
  });
}

export interface GoldChange {
  current: number;
  previous: number | null;
  diff: number;
  percent: number;
  direction: "up" | "down" | "flat";
  fetchedAt: string | null;
}

/** Variation du cours pour un titre donné (par défaut 18K), 2 derniers points distincts. */
export function useGoldPriceChange(karat = 18) {
  return useQuery({
    queryKey: ["gold_prices", "change", karat],
    refetchInterval: 60_000,
    queryFn: async (): Promise<GoldChange | null> => {
      const { data, error } = await supabase
        .from("gold_prices")
        .select("price_per_gram, fetched_at")
        .eq("karat", karat)
        .order("fetched_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as { price_per_gram: number; fetched_at: string }[];
      if (rows.length === 0) return null;
      const current = Number(rows[0].price_per_gram);
      const prevRow = rows.find((r) => Number(r.price_per_gram) !== current);
      const previous = prevRow ? Number(prevRow.price_per_gram) : null;
      const diff = previous == null ? 0 : current - previous;
      const percent = previous ? (diff / previous) * 100 : 0;
      return {
        current,
        previous,
        diff,
        percent,
        direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
        fetchedAt: rows[0].fetched_at,
      };
    },
  });
}

export function priceForKarat(prices: Record<number, GoldPrice> | undefined, karat: number | null | undefined) {
  if (!prices || karat == null) return null;
  return prices[karat]?.price_per_gram ?? null;
}

export { KARATS };
