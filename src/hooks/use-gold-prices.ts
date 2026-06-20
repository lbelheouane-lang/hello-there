import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { KARATS } from "@/lib/format";

export interface GoldPrice {
  id: string;
  karat: number;
  price_per_gram: number;
  price_date: string;
  source: string;
}

/** Dernier cours connu pour chaque titre. */
export function useLatestGoldPrices() {
  return useQuery({
    queryKey: ["gold_prices", "latest"],
    queryFn: async (): Promise<Record<number, GoldPrice>> => {
      const { data, error } = await supabase
        .from("gold_prices")
        .select("*")
        .order("price_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      const latest: Record<number, GoldPrice> = {};
      for (const row of data as GoldPrice[]) {
        if (!latest[row.karat]) latest[row.karat] = row;
      }
      return latest;
    },
  });
}

export function priceForKarat(prices: Record<number, GoldPrice> | undefined, karat: number | null | undefined) {
  if (!prices || karat == null) return null;
  return prices[karat]?.price_per_gram ?? null;
}

export { KARATS };
