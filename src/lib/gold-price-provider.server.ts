// Server-only. Live gold price ingestion + product price recalculation.
// SECURITY: imports the service-role client (client.server). Never import this
// file from client/component code — only from server routes / server fns.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OUNCE_TO_GRAM = 31.1034768;

/** Facteurs de pureté par titre (24K = or pur). */
const PURITY: Record<number, number> = {
  24: 1.0,
  22: 0.916,
  21: 0.875,
  18: 0.75,
  14: 0.585,
};
const KARATS = [24, 22, 21, 18, 14] as const;

/** Taux de conversion USD -> DZD (configurable via secret) pour la valorisation produit. */
function usdToDzd(): number {
  const raw = Number(process.env.GOLD_USD_TO_DZD);
  return Number.isFinite(raw) && raw > 0 ? raw : 268;
}

export interface SpotPrice {
  /** Prix de l'once d'or pur (24K) en USD. */
  pricePerOunce: number;
  currency: string;
  source: string;
}

/**
 * Interface générique d'un fournisseur de cours de l'or.
 * Permet de brancher un autre fournisseur sans toucher au reste de l'app.
 */
export interface GoldPriceSource {
  readonly name: string;
  fetchSpot(): Promise<SpotPrice | null>;
}

async function fetchJson(url: string, timeoutMs = 8000): Promise<any | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: "application/json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Fournisseur GoldRepublic. GoldRepublic n'expose pas d'API publique documentée
 * de cotation en temps réel ; on tente un endpoint connu, sinon on renvoie null
 * et la chaîne de fournisseurs bascule sur le suivant. Cotation en USD.
 */
const goldRepublicSource: GoldPriceSource = {
  name: "goldrepublic",
  async fetchSpot() {
    const data = await fetchJson("https://www.goldrepublic.com/api/v1/quotes/gold");
    const usdPerGram = Number(data?.ask ?? data?.price ?? data?.bid);
    if (!Number.isFinite(usdPerGram) || usdPerGram <= 0) return null;
    return {
      pricePerOunce: usdPerGram * OUNCE_TO_GRAM,
      currency: "USD",
      source: this.name,
    };
  },
};

/** Fournisseur de secours : gold-api.com, gratuit et sans clé (XAU en USD/once). */
const goldApiSource: GoldPriceSource = {
  name: "gold-api",
  async fetchSpot() {
    const data = await fetchJson("https://api.gold-api.com/price/XAU");
    const usdPerOunce = Number(data?.price);
    if (!Number.isFinite(usdPerOunce) || usdPerOunce <= 0) return null;
    return {
      pricePerOunce: usdPerOunce,
      currency: "USD",
      source: this.name,
    };
  },
};

/** Chaîne de fournisseurs, dans l'ordre de priorité. */
const SOURCES: GoldPriceSource[] = [goldRepublicSource, goldApiSource];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Essaie chaque fournisseur avec quelques tentatives + backoff. */
async function fetchSpotWithFallback(): Promise<SpotPrice | null> {
  for (const source of SOURCES) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const spot = await source.fetchSpot();
      if (spot) return spot;
      await sleep(300 * (attempt + 1));
    }
  }
  return null;
}

/** Dernier prix d'once connu en base, utilisé comme ultime repli. */
async function lastKnownOunce(): Promise<SpotPrice | null> {
  const { data } = await supabaseAdmin
    .from("gold_prices")
    .select("price_per_ounce, currency, source")
    .eq("karat", 24)
    .not("price_per_ounce", "is", null)
    .order("fetched_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row?.price_per_ounce) return null;
  return {
    pricePerOunce: Number(row.price_per_ounce),
    currency: row.currency ?? "DZD",
    source: `${row.source ?? "inconnu"} (repli)`,
  };
}

export interface UpdateResult {
  ok: boolean;
  source: string;
  currency: string;
  pricePerOunce: number;
  basePricePerGram: number;
  productsRecalculated: number;
  fallbackUsed: boolean;
}

/**
 * GoldPriceProvider : point d'entrée du module.
 * Récupère le cours, le stocke (latest + historique), recalcule les prix de
 * vente et la valorisation du stock, et journalise tout dans audit_logs.
 */
export async function runGoldPriceUpdate(): Promise<UpdateResult> {
  let spot = await fetchSpotWithFallback();
  let fallbackUsed = false;
  if (!spot) {
    spot = await lastKnownOunce();
    fallbackUsed = true;
  }
  if (!spot) {
    await logAudit("gold_price_update", null, {
      status: "echec",
      message: "Aucun fournisseur disponible et aucun cours antérieur.",
    });
    return {
      ok: false, source: "aucun", currency: "DZD", pricePerOunce: 0,
      basePricePerGram: 0, productsRecalculated: 0, fallbackUsed: true,
    };
  }

  const fetchedAt = new Date().toISOString();
  const priceDate = fetchedAt.slice(0, 10);
  const basePricePerGram = spot.pricePerOunce / OUNCE_TO_GRAM;

  // Une ligne par titre (purity-adjusted). upsert sur (karat, price_date).
  const rows = KARATS.map((k) => ({
    karat: k,
    price_per_gram: Math.round(basePricePerGram * PURITY[k] * 100) / 100,
    price_per_ounce: Math.round(spot!.pricePerOunce * PURITY[k] * 100) / 100,
    currency: spot!.currency,
    price_date: priceDate,
    fetched_at: fetchedAt,
    source: spot!.source,
  }));
  await supabaseAdmin.from("gold_prices").upsert(rows, { onConflict: "karat,price_date" });

  await logAudit("gold_price_update", null, {
    status: "succes",
    source: spot.source,
    currency: spot.currency,
    fallbackUsed,
    pricePerOunce: spot.pricePerOunce,
    basePricePerGram,
    karats: rows.map((r) => ({ karat: r.karat, pricePerGram: r.price_per_gram })),
  });

  const productsRecalculated = await recalcProducts(basePricePerGram, spot.currency);

  return {
    ok: true,
    source: spot.source,
    currency: spot.currency,
    pricePerOunce: spot.pricePerOunce,
    basePricePerGram,
    productsRecalculated,
    fallbackUsed,
  };
}

/**
 * Recalcule le prix de vente de chaque produit en or :
 * Prix = (Poids × Cours or pur × Facteur pureté) + Façon + Pierres + Main d'œuvre
 */
async function recalcProducts(basePricePerGram: number, currency: string): Promise<number> {
  const { data: products } = await supabaseAdmin
    .from("products")
    .select("id, metal_type, gold_karat, weight_grams, making_charge, stone_cost, labor_cost, selling_price")
    .eq("metal_type", "or")
    .neq("status", "vendu");

  if (!products?.length) return 0;

  let count = 0;
  let valuationBefore = 0;
  let valuationAfter = 0;

  for (const p of products as any[]) {
    const purity = PURITY[p.gold_karat as number] ?? 0;
    if (!purity) continue;
    const metalValue = Number(p.weight_grams) * basePricePerGram * purity;
    const selling =
      Math.round(
        (metalValue +
          Number(p.making_charge ?? 0) +
          Number(p.stone_cost ?? 0) +
          Number(p.labor_cost ?? 0)) * 100,
      ) / 100;

    valuationBefore += Number(p.selling_price ?? 0);
    valuationAfter += selling;

    if (selling !== Number(p.selling_price)) {
      const { error } = await supabaseAdmin
        .from("products")
        .update({ selling_price: selling })
        .eq("id", p.id);
      if (!error) {
        count++;
        await logAudit("product_recalc", p.id, {
          oldSellingPrice: Number(p.selling_price ?? 0),
          newSellingPrice: selling,
          basePricePerGram,
          currency,
        });
      }
    }
  }

  await logAudit("inventory_valuation", null, {
    currency,
    valuationBefore: Math.round(valuationBefore * 100) / 100,
    valuationAfter: Math.round(valuationAfter * 100) / 100,
    productsRecalculated: count,
  });

  return count;
}

async function logAudit(eventType: string, entityId: string | null, details: Record<string, unknown>) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      event_type: eventType,
      entity_id: entityId,
      details: details as any,
    });
  } catch {
    // L'audit ne doit jamais faire échouer le job.
  }
}
