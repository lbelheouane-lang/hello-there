// Server-only. Live gold price ingestion (EUR base) + product price
// recalculation + full diagnostics logging.
// SECURITY: imports the service-role client (client.server). Never import this
// file from client/component code — only from server routes / server fns.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const OUNCE_TO_GRAM = 31.1034768;
const DEFAULT_EUR_TO_DZD = 280;
const DEFAULT_THRESHOLD_PCT = 2;

/** Facteurs de pureté par titre (24K = or pur). */
const PURITY: Record<number, number> = {
  24: 1.0,
  22: 0.916,
  21: 0.875,
  18: 0.75,
  14: 0.585,
};
const KARATS = [24, 22, 21, 18, 14] as const;

interface GoldConfig {
  eurToDzd: number;
  autoSync: boolean;
  manualOverride: boolean;
  manualPriceEurPerGram: number | null; // 24K EUR / gram
  thresholdPct: number;
}

async function loadConfig(): Promise<GoldConfig> {
  const { data } = await supabaseAdmin
    .from("store_settings")
    .select("eur_to_dzd, gold_auto_sync, gold_manual_override, gold_manual_price_eur, gold_discrepancy_threshold_pct")
    .eq("singleton", true)
    .maybeSingle();
  const eur = Number(data?.eur_to_dzd);
  const thr = Number(data?.gold_discrepancy_threshold_pct);
  return {
    eurToDzd: Number.isFinite(eur) && eur > 0 ? eur : DEFAULT_EUR_TO_DZD,
    autoSync: data?.gold_auto_sync !== false,
    manualOverride: data?.gold_manual_override === true,
    manualPriceEurPerGram:
      data?.gold_manual_price_eur != null && Number(data.gold_manual_price_eur) > 0
        ? Number(data.gold_manual_price_eur)
        : null,
    thresholdPct: Number.isFinite(thr) && thr >= 0 ? thr : DEFAULT_THRESHOLD_PCT,
  };
}

/** Résultat d'une tentative de cotation en EUR. */
export interface SpotPriceEur {
  pricePerOunceEur: number; // once d'or pur (24K) en EUR
  pricePerGramEur: number; // gramme d'or pur (24K) en EUR
  usdEurRate: number | null;
  source: string; // libellé de la source effective
  dataSource: string; // identifiant technique
  raw: Record<string, unknown>;
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
 * GoldRepublic n'expose pas d'API publique de cotation documentée
 * (api.goldrepublic.com requiert un en-tête `source` privé / authentification).
 * On tente un endpoint connu ; en cas d'échec on bascule sur le cours spot
 * officiel en EUR, qui est la base des prix affichés par GoldRepublic.
 */
async function fetchGoldRepublic(): Promise<{ eurPerGram: number; eurPerOunce: number } | null> {
  const data = await fetchJson("https://api.goldrepublic.com/prices");
  const eurPerGram = Number(data?.gold?.ask ?? data?.gold?.price ?? data?.ask);
  if (!Number.isFinite(eurPerGram) || eurPerGram <= 0) return null;
  return { eurPerGram, eurPerOunce: eurPerGram * OUNCE_TO_GRAM };
}

/**
 * Cours spot or en EUR : prix XAU en USD/once (gold-api.com) converti via le
 * taux USD→EUR en direct (frankfurter.dev). C'est l'équivalent fiable du cours
 * affiché par GoldRepublic.
 */
async function fetchLiveEurSpot(): Promise<SpotPriceEur | null> {
  const gold = await fetchJson("https://api.gold-api.com/price/XAU");
  const usdPerOunce = Number(gold?.price);
  if (!Number.isFinite(usdPerOunce) || usdPerOunce <= 0) return null;

  const fx = await fetchJson("https://api.frankfurter.dev/v1/latest?base=USD&symbols=EUR");
  const usdEur = Number(fx?.rates?.EUR);
  if (!Number.isFinite(usdEur) || usdEur <= 0) return null;

  const pricePerOunceEur = usdPerOunce * usdEur;
  return {
    pricePerOunceEur,
    pricePerGramEur: pricePerOunceEur / OUNCE_TO_GRAM,
    usdEurRate: usdEur,
    source: "Cours spot EUR (live)",
    dataSource: "live-eur-spot",
    raw: { usdPerOunce, usdEur, goldUpdatedAt: gold?.updatedAt ?? null, fxDate: fx?.date ?? null },
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Récupère le cours spot EUR avec plusieurs tentatives + backoff. Renvoie aussi le nb de tentatives. */
async function fetchSpotWithRetry(): Promise<{ spot: SpotPriceEur | null; attempts: number; lastError: string | null }> {
  let attempts = 0;
  let lastError: string | null = null;
  for (let i = 0; i < 3; i++) {
    attempts++;
    try {
      const spot = await fetchLiveEurSpot();
      if (spot) return { spot, attempts, lastError: null };
      lastError = "Fournisseur de cours indisponible (réponse vide).";
    } catch (e) {
      lastError = (e as Error).message;
    }
    await sleep(400 * (i + 1));
  }
  return { spot: null, attempts, lastError };
}

/** Dernier prix d'once 24K connu en base (EUR), ultime repli. */
async function lastKnownEur(): Promise<SpotPriceEur | null> {
  const { data } = await supabaseAdmin
    .from("gold_prices")
    .select("price_per_ounce, price_per_gram, currency, source")
    .eq("karat", 24)
    .not("price_per_gram", "is", null)
    .order("fetched_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row?.price_per_gram) return null;
  const gram = Number(row.price_per_gram);
  return {
    pricePerOunceEur: row.price_per_ounce ? Number(row.price_per_ounce) : gram * OUNCE_TO_GRAM,
    pricePerGramEur: gram,
    usdEurRate: null,
    source: `${row.source ?? "inconnu"} (repli)`,
    dataSource: "fallback-last-known",
    raw: {},
  };
}

export interface UpdateResult {
  ok: boolean;
  source: string;
  dataSource: string;
  currency: string;
  pricePerOunceEur: number;
  basePricePerGramEur: number;
  eurToDzd: number;
  goldRepublicPriceEur: number | null;
  appPriceEur: number;
  discrepancyEur: number;
  discrepancyPct: number;
  thresholdPct: number;
  alert: boolean;
  manualOverride: boolean;
  fallbackUsed: boolean;
  attempts: number;
  productsRecalculated: number;
  error: string | null;
}

/**
 * GoldPriceProvider : point d'entrée du module.
 * Récupère le cours en EUR, le compare à GoldRepublic, le stocke (latest +
 * historique), recalcule les prix de vente et la valorisation, et journalise
 * tout dans gold_sync_logs + audit_logs.
 */
export async function runGoldPriceUpdate(): Promise<UpdateResult> {
  const cfg = await loadConfig();

  // 1) Référence GoldRepublic (best effort).
  const gr = await fetchGoldRepublic();
  const goldRepublicPriceEur = gr?.eurPerGram ?? null;

  // 2) Cours live EUR avec retries.
  const { spot: liveSpot, attempts, lastError } = await fetchSpotWithRetry();

  let spot: SpotPriceEur | null = liveSpot;
  let fallbackUsed = false;
  if (!spot) {
    spot = await lastKnownEur();
    fallbackUsed = true;
  }

  // 3) Override manuel.
  let manualUsed = false;
  let basePerGram: number | null = null;
  let source: string;
  let dataSource: string;

  if (cfg.manualOverride && cfg.manualPriceEurPerGram) {
    basePerGram = cfg.manualPriceEurPerGram;
    manualUsed = true;
    source = "Override manuel";
    dataSource = "manuel";
  } else if (spot) {
    basePerGram = spot.pricePerGramEur;
    source = spot.source;
    dataSource = spot.dataSource;
    if (cfg.manualOverride && !cfg.manualPriceEurPerGram) {
      source += " (override activé sans prix manuel)";
    }
  } else {
    // Rien de disponible et pas de prix manuel.
    await logSync({
      status: "failed",
      source: "aucun",
      dataSource: "aucun",
      eurToDzd: cfg.eurToDzd,
      thresholdPct: cfg.thresholdPct,
      manualOverride: cfg.manualOverride,
      attempts,
      error: lastError ?? "Aucun fournisseur disponible et aucun cours antérieur.",
      goldRepublicPriceEur,
    });
    await logAudit("gold_price_update", null, {
      status: "echec",
      message: "Aucun fournisseur disponible et aucun cours antérieur.",
    });
    return {
      ok: false, source: "aucun", dataSource: "aucun", currency: "EUR", pricePerOunceEur: 0,
      basePricePerGramEur: 0, eurToDzd: cfg.eurToDzd, goldRepublicPriceEur,
      appPriceEur: 0, discrepancyEur: 0, discrepancyPct: 0, thresholdPct: cfg.thresholdPct,
      alert: false, manualOverride: cfg.manualOverride, fallbackUsed: true, attempts,
      productsRecalculated: 0, error: lastError ?? "Aucun fournisseur disponible.",
    };
  }

  const pricePerOunceEur = basePerGram * OUNCE_TO_GRAM;
  const fetchedAt = new Date().toISOString();
  const priceDate = fetchedAt.slice(0, 10);

  // 4) Calcul de l'écart : prix appliqué par l'app vs référence (GoldRepublic
  //    si dispo, sinon cours live spot EUR).
  const reference = goldRepublicPriceEur ?? liveSpot?.pricePerGramEur ?? basePerGram;
  const discrepancyEur = Math.round((basePerGram - reference) * 100) / 100;
  const discrepancyPct = reference ? Math.round((discrepancyEur / reference) * 10000) / 100 : 0;
  const alert = Math.abs(discrepancyPct) > cfg.thresholdPct;

  // 5) Stockage : une ligne par titre (purity-adjusted), en EUR.
  const rows = KARATS.map((k) => ({
    karat: k,
    price_per_gram: Math.round(basePerGram! * PURITY[k] * 100) / 100,
    price_per_ounce: Math.round(pricePerOunceEur * PURITY[k] * 100) / 100,
    currency: "EUR",
    price_date: priceDate,
    fetched_at: fetchedAt,
    source: dataSource,
  }));
  await supabaseAdmin.from("gold_prices").upsert(rows, { onConflict: "karat,price_date" });

  // 6) Recalcul des produits : le métal (calculé en EUR) est converti en DZD,
  //    puis additionné aux coûts (déjà en DZD). Le prix de vente est stocké en DZD.
  const productsRecalculated = await recalcProducts(basePerGram, cfg.eurToDzd);

  // 7) Journalisation.
  await logSync({
    status: manualUsed ? "manual" : fallbackUsed ? "fallback" : "success",
    source,
    dataSource,
    eurToDzd: cfg.eurToDzd,
    thresholdPct: cfg.thresholdPct,
    manualOverride: cfg.manualOverride,
    attempts,
    error: fallbackUsed ? lastError : null,
    goldRepublicPriceEur,
    pricePerOunceEur,
    pricePerGramEur: basePerGram,
    usdEurRate: liveSpot?.usdEurRate ?? null,
    appPriceEur: basePerGram,
    discrepancyEur,
    discrepancyPct,
    alert,
    fallbackUsed,
    productsRecalculated,
    raw: liveSpot?.raw ?? null,
  });
  await logAudit("gold_price_update", null, {
    status: "succes",
    source,
    currency: "EUR",
    fallbackUsed,
    manualOverride: manualUsed,
    pricePerOunceEur,
    basePricePerGramEur: basePerGram,
    goldRepublicPriceEur,
    discrepancyPct,
    alert,
  });

  return {
    ok: true,
    source,
    dataSource,
    currency: "EUR",
    pricePerOunceEur,
    basePricePerGramEur: basePerGram,
    eurToDzd: cfg.eurToDzd,
    goldRepublicPriceEur,
    appPriceEur: basePerGram,
    discrepancyEur,
    discrepancyPct,
    thresholdPct: cfg.thresholdPct,
    alert,
    manualOverride: manualUsed,
    fallbackUsed,
    attempts,
    productsRecalculated,
    error: null,
  };
}

/**
 * Recalcule le prix de vente de chaque produit en or. La valeur du métal est
 * calculée à partir du cours EUR puis convertie en DZD via le taux configuré.
 * Prix DZD = (Poids × Cours EUR/g × Pureté × Taux EUR→DZD) + Façon + Pierres + Main d'œuvre
 * (les coûts façon/pierres/main d'œuvre sont déjà stockés en DZD).
 */
async function recalcProducts(baseEurPerGram: number, eurToDzd: number): Promise<number> {
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
    const metalValueDzd = Number(p.weight_grams) * baseEurPerGram * purity * eurToDzd;
    const selling =
      Math.round(
        metalValueDzd +
          Number(p.making_charge ?? 0) +
          Number(p.stone_cost ?? 0) +
          Number(p.labor_cost ?? 0),
      );

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
          baseEurPerGram,
          eurToDzd,
          currency: "DZD",
        });
      }
    }
  }

  await logAudit("inventory_valuation", null, {
    currency: "DZD",
    valuationBefore: Math.round(valuationBefore),
    valuationAfter: Math.round(valuationAfter),
    productsRecalculated: count,
  });

  return count;
}

interface SyncLog {
  status: string;
  source: string;
  dataSource: string;
  currency?: string;
  eurToDzd: number;
  thresholdPct: number;
  manualOverride: boolean;
  attempts: number;
  error?: string | null;
  goldRepublicPriceEur?: number | null;
  pricePerOunceEur?: number | null;
  pricePerGramEur?: number | null;
  usdEurRate?: number | null;
  appPriceEur?: number | null;
  discrepancyEur?: number | null;
  discrepancyPct?: number | null;
  alert?: boolean;
  fallbackUsed?: boolean;
  productsRecalculated?: number;
  raw?: Record<string, unknown> | null;
}

async function logSync(l: SyncLog) {
  try {
    await supabaseAdmin.from("gold_sync_logs").insert({
      status: l.status,
      source: l.source,
      data_source: l.dataSource,
      currency: l.currency ?? "EUR",
      price_per_ounce_eur: l.pricePerOunceEur ?? null,
      price_per_gram_eur: l.pricePerGramEur ?? null,
      usd_eur_rate: l.usdEurRate ?? null,
      eur_dzd_rate: l.eurToDzd,
      goldrepublic_price_eur: l.goldRepublicPriceEur ?? null,
      app_price_eur: l.appPriceEur ?? null,
      discrepancy_eur: l.discrepancyEur ?? null,
      discrepancy_pct: l.discrepancyPct ?? null,
      threshold_pct: l.thresholdPct,
      alert: l.alert ?? false,
      fallback_used: l.fallbackUsed ?? false,
      manual_override: l.manualOverride,
      attempts: l.attempts,
      products_recalculated: l.productsRecalculated ?? 0,
      error: l.error ?? null,
      raw_response: (l.raw ?? null) as any,
    });
  } catch {
    // La journalisation ne doit jamais faire échouer le job.
  }
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
