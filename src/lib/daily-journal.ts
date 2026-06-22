import { supabase } from "@/integrations/supabase/client";
import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";
import { getStoreSettings } from "@/lib/store-settings";

/** Complete aggregated summary of a day's (or range's) activity. */
export interface JournalSummary {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (same as from for single day)
  sales: {
    count: number;
    totalAmount: number;
    cashCount: number;
    cashAmount: number;
    pendingCreatedCount: number;
    pendingCreatedAmount: number;
    paymentsReceivedCount: number;
    paymentsReceivedAmount: number;
    initialPaid: number;
  };
  inventory: {
    itemsAdded: number;
    itemsAddedWeight: number;
    itemsSold: number;
    quantityChanges: number;
    setsCreated: number;
    setsPartiallySold: number;
    setsFullySold: number;
  };
  scrap: {
    count: number;
    totalWeight: number;
    avgPricePerGram: number;
    totalAmount: number;
  };
  expenses: {
    count: number;
    totalAmount: number;
    byCategory: { category: string; count: number; amount: number }[];
    stockPurchaseCount: number;
    stockPurchaseAmount: number;
  };
  suppliers: { supplier: string; count: number; amount: number }[];
  customers: {
    newCount: number;
    newNames: string[];
    paymentsReceived: number;
    outstandingBalance: number;
  };
  goldPrices: {
    karat: number;
    previous: number | null;
    current: number;
    source: string;
    at: string;
    user: string;
  }[];
  userActivity: {
    user: string;
    sales: number;
    inventory: number;
    payments: number;
    expenses: number;
    scrap: number;
  }[];
  activityLog: { time: string; user: string; action: string; detail: string }[];
  financial: {
    totalSales: number;
    totalExpenses: number;
    totalScrap: number;
    paymentsReceived: number;
    outstandingBalance: number;
    netResult: number;
  };
}

function dayBounds(from: string, to: string) {
  return { start: `${from}T00:00:00.000`, end: `${to}T23:59:59.999` };
}

type Row = Record<string, unknown>;

/** Fetch and aggregate all activity for the given date (range). */
export async function fetchJournalSummary(from: string, to: string): Promise<JournalSummary> {
  const { start, end } = dayBounds(from, to);

  const [
    profilesRes,
    salesRes,
    paymentsRes,
    productsRes,
    qtyEventsRes,
    setsRes,
    setEventsRes,
    scrapRes,
    expensesRes,
    purchasesRes,
    customersRes,
    openSalesRes,
    goldRes,
    goldPrevRes,
    auditRes,
  ] = await Promise.all([
    supabase.from("profiles").select("id, full_name"),
    supabase.from("sales").select("total_amount, amount_paid, payment_method, sold_by, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("payments").select("amount, recorded_by, paid_at").gte("paid_at", start).lte("paid_at", end),
    supabase.from("products").select("weight_grams, created_by, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("product_quantity_events").select("event_type, changed_by, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("jewelry_sets").select("created_by, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("jewelry_set_events").select("set_id, event_type, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("scrap_gold").select("weight_grams, total_amount, price_per_gram, created_by, purchased_at").gte("purchased_at", start).lte("purchased_at", end),
    supabase.from("expenses").select("category, amount, recorded_by, supplier_id, spent_at").gte("spent_at", start).lte("spent_at", end),
    supabase.from("purchases").select("supplier_name, total_cost, purchased_at").gte("purchased_at", start).lte("purchased_at", end),
    supabase.from("customers").select("full_name, created_at").gte("created_at", start).lte("created_at", end),
    supabase.from("sales").select("total_amount, amount_paid"),
    supabase.from("gold_prices").select("karat, price_per_gram, source, fetched_at, created_at").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: true }),
    supabase.from("gold_prices").select("karat, price_per_gram, created_at").lt("created_at", start).order("created_at", { ascending: false }).limit(100),
    supabase.from("audit_logs").select("event_type, details, created_at").gte("created_at", start).lte("created_at", end).order("created_at", { ascending: true }),
  ]);

  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as Row[]) {
    nameById.set(p.id as string, (p.full_name as string) || "—");
  }
  const uname = (id: unknown) => (id ? nameById.get(id as string) ?? "Utilisateur" : "Système");

  // --- Sales ---
  const sales = (salesRes.data ?? []) as Row[];
  let totalAmount = 0, cashCount = 0, cashAmount = 0, pendingCount = 0, pendingAmount = 0, initialPaid = 0;
  for (const s of sales) {
    const total = Number(s.total_amount) || 0;
    const paid = Number(s.amount_paid) || 0;
    totalAmount += total;
    initialPaid += paid;
    if (s.payment_method === "especes") { cashCount++; cashAmount += paid; }
    if (total - paid > 0) { pendingCount++; pendingAmount += total - paid; }
  }
  const payments = (paymentsRes.data ?? []) as Row[];
  const paymentsAmount = payments.reduce((t, p) => t + (Number(p.amount) || 0), 0);

  // --- Inventory ---
  const products = (productsRes.data ?? []) as Row[];
  const itemsAddedWeight = products.reduce((t, p) => t + (Number(p.weight_grams) || 0), 0);
  const qtyEvents = (qtyEventsRes.data ?? []) as Row[];
  const itemsSold = qtyEvents.filter((e) => e.event_type === "quantity_sold").length;
  const quantityChanges = qtyEvents.filter((e) => e.event_type === "quantity_adjusted").length;
  const setEvents = (setEventsRes.data ?? []) as Row[];
  const soldSetIds = new Set<string>();
  for (const e of setEvents) if (e.event_type === "item_sold") soldSetIds.add(e.set_id as string);
  // Determine fully vs partially sold for affected sets
  let setsFullySold = 0, setsPartiallySold = 0;
  if (soldSetIds.size > 0) {
    const { data: setProducts } = await supabase
      .from("products")
      .select("set_id, status")
      .in("set_id", Array.from(soldSetIds));
    const grouped = new Map<string, { total: number; sold: number }>();
    for (const p of (setProducts ?? []) as Row[]) {
      const sid = p.set_id as string;
      const g = grouped.get(sid) ?? { total: 0, sold: 0 };
      g.total++;
      if (p.status === "vendu") g.sold++;
      grouped.set(sid, g);
    }
    for (const g of grouped.values()) {
      if (g.total > 0 && g.sold >= g.total) setsFullySold++;
      else if (g.sold > 0) setsPartiallySold++;
    }
  }

  // --- Scrap ---
  const scrap = (scrapRes.data ?? []) as Row[];
  const scrapWeight = scrap.reduce((t, r) => t + (Number(r.weight_grams) || 0), 0);
  const scrapAmount = scrap.reduce((t, r) => t + (Number(r.total_amount) || 0), 0);
  const scrapAvg = scrapWeight > 0 ? scrapAmount / scrapWeight : 0;

  // --- Expenses ---
  const expenses = (expensesRes.data ?? []) as Row[];
  const expensesTotal = expenses.reduce((t, e) => t + (Number(e.amount) || 0), 0);
  const catMap = new Map<string, { count: number; amount: number }>();
  for (const e of expenses) {
    const c = (e.category as string) || "Autre";
    const g = catMap.get(c) ?? { count: 0, amount: 0 };
    g.count++; g.amount += Number(e.amount) || 0;
    catMap.set(c, g);
  }
  const byCategory = Array.from(catMap.entries()).map(([category, v]) => ({ category, ...v })).sort((a, b) => b.amount - a.amount);
  const stockExp = expenses.filter((e) => e.category === "Achat de stock");
  const stockPurchaseAmount = stockExp.reduce((t, e) => t + (Number(e.amount) || 0), 0);

  // --- Suppliers ---
  const purchases = (purchasesRes.data ?? []) as Row[];
  const supMap = new Map<string, { count: number; amount: number }>();
  for (const p of purchases) {
    const name = (p.supplier_name as string) || "—";
    const g = supMap.get(name) ?? { count: 0, amount: 0 };
    g.count++; g.amount += Number(p.total_cost) || 0;
    supMap.set(name, g);
  }
  const suppliers = Array.from(supMap.entries()).map(([supplier, v]) => ({ supplier, ...v })).sort((a, b) => b.amount - a.amount);

  // --- Customers ---
  const customers = (customersRes.data ?? []) as Row[];
  const openSales = (openSalesRes.data ?? []) as Row[];
  const outstandingBalance = openSales.reduce((t, s) => t + Math.max((Number(s.total_amount) || 0) - (Number(s.amount_paid) || 0), 0), 0);

  // --- Gold prices ---
  const gold = (goldRes.data ?? []) as Row[];
  const goldPrev = (goldPrevRes.data ?? []) as Row[];
  const prevByKarat = new Map<number, number>();
  for (const g of goldPrev) {
    const k = Number(g.karat);
    if (!prevByKarat.has(k)) prevByKarat.set(k, Number(g.price_per_gram));
  }
  const goldPrices: JournalSummary["goldPrices"] = [];
  for (const g of gold) {
    const k = Number(g.karat);
    const entry = {
      karat: k,
      previous: prevByKarat.has(k) ? prevByKarat.get(k)! : null,
      current: Number(g.price_per_gram),
      source: (g.source as string) || "—",
      at: (g.fetched_at as string) || (g.created_at as string),
      user: (g.source as string) === "manual" ? "Manuel" : "Synchronisation",
    };
    const existingIdx = goldPrices.findIndex((x) => x.karat === k);
    if (existingIdx >= 0) goldPrices[existingIdx] = entry; // keep latest per karat
    else goldPrices.push(entry);
  }
  goldPrices.sort((a, b) => b.karat - a.karat);

  // --- User activity ---
  type ActKey = "sales" | "inventory" | "payments" | "expenses" | "scrap";
  const actMap = new Map<string, Record<ActKey, number>>();
  const bump = (id: unknown, key: ActKey) => {
    const name = uname(id);
    const g = actMap.get(name) ?? { sales: 0, inventory: 0, payments: 0, expenses: 0, scrap: 0 };
    g[key]++;
    actMap.set(name, g);
  };
  for (const s of sales) bump(s.sold_by, "sales");
  for (const p of products) bump(p.created_by, "inventory");
  for (const e of qtyEvents) bump(e.changed_by, "inventory");
  for (const p of payments) bump(p.recorded_by, "payments");
  for (const e of expenses) bump(e.recorded_by, "expenses");
  for (const r of scrap) bump(r.created_by, "scrap");
  const userActivity = Array.from(actMap.entries()).map(([user, v]) => ({ user, ...v }));

  // --- Activity log (critical actions) ---
  const audit = (auditRes.data ?? []) as Row[];
  const AUDIT_LABEL: Record<string, string> = {
    stock_purchase_created: "Achat de stock enregistré",
  };
  const activityLog: JournalSummary["activityLog"] = audit.map((a) => {
    const d = (a.details as Record<string, unknown>) || {};
    return {
      time: a.created_at as string,
      user: (d.employee_name as string) || "Système",
      action: AUDIT_LABEL[a.event_type as string] || (a.event_type as string),
      detail: [d.reference, d.supplier_name, d.amount ? formatDZD(Number(d.amount)) : null].filter(Boolean).join(" · "),
    };
  });

  const paymentsReceived = initialPaid + paymentsAmount;
  const netResult = totalAmount - expensesTotal - scrapAmount;

  return {
    from,
    to,
    sales: {
      count: sales.length,
      totalAmount,
      cashCount,
      cashAmount,
      pendingCreatedCount: pendingCount,
      pendingCreatedAmount: pendingAmount,
      paymentsReceivedCount: payments.length,
      paymentsReceivedAmount: paymentsAmount,
      initialPaid,
    },
    inventory: {
      itemsAdded: products.length,
      itemsAddedWeight,
      itemsSold,
      quantityChanges,
      setsCreated: (setsRes.data ?? []).length,
      setsPartiallySold,
      setsFullySold,
    },
    scrap: { count: scrap.length, totalWeight: scrapWeight, avgPricePerGram: scrapAvg, totalAmount: scrapAmount },
    expenses: {
      count: expenses.length,
      totalAmount: expensesTotal,
      byCategory,
      stockPurchaseCount: stockExp.length,
      stockPurchaseAmount,
    },
    suppliers,
    customers: {
      newCount: customers.length,
      newNames: customers.map((c) => (c.full_name as string) || "—"),
      paymentsReceived,
      outstandingBalance,
    },
    goldPrices,
    userActivity,
    activityLog,
    financial: {
      totalSales: totalAmount,
      totalExpenses: expensesTotal,
      totalScrap: scrapAmount,
      paymentsReceived,
      outstandingBalance,
      netResult,
    },
  };
}

// ---------- PDF / printable HTML ----------

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function statRow(label: string, value: string): string {
  return `<div class="stat"><span class="sl">${esc(label)}</span><span class="sv">${esc(value)}</span></div>`;
}

function section(title: string, body: string): string {
  return `<section class="block"><h2>${esc(title)}</h2>${body}</section>`;
}

function table(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return `<p class="empty">Aucune activité enregistrée.</p>`;
  return `<table>
    <thead><tr>${headers.map((h, i) => `<th class="${i === 0 ? "" : "num"}">${esc(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td class="${i === 0 ? "" : "num"}">${c}</td>`).join("")}</tr>`).join("")}</tbody>
  </table>`;
}

/** Build a self-contained A4 HTML document for the daily journal. */
export function buildJournalHtml(j: JournalSummary, generatedBy: string): string {
  const store = getStoreInfo();
  const s = getStoreSettings();
  const logoHtml = store.logo
    ? `<img class="logo-img" src="${esc(store.logo)}" alt="${esc(store.name)}" />`
    : `<div class="logo">${esc(store.name.charAt(0).toUpperCase() || "M")}</div>`;
  const contactLine = [store.phone, store.email].filter(Boolean).map(esc).join(" · ");
  const dateLabel = j.from === j.to ? formatDate(j.from) : `${formatDate(j.from)} → ${formatDate(j.to)}`;
  const genAt = formatDateTime(new Date());

  const salesBody =
    statRow("Nombre de ventes", String(j.sales.count)) +
    statRow("Montant total des ventes", formatDZD(j.sales.totalAmount)) +
    statRow("Ventes en espèces", `${j.sales.cashCount} · ${formatDZD(j.sales.cashAmount)}`) +
    statRow("Paiements en attente créés", `${j.sales.pendingCreatedCount} · ${formatDZD(j.sales.pendingCreatedAmount)}`) +
    statRow("Versements reçus (soldes)", `${j.sales.paymentsReceivedCount} · ${formatDZD(j.sales.paymentsReceivedAmount)}`);

  const invBody =
    statRow("Articles ajoutés au stock", `${j.inventory.itemsAdded} · ${formatGrams(j.inventory.itemsAddedWeight)}`) +
    statRow("Articles vendus", String(j.inventory.itemsSold)) +
    statRow("Modifications de quantité", String(j.inventory.quantityChanges)) +
    statRow("Parures créées", String(j.inventory.setsCreated)) +
    statRow("Parures partiellement vendues", String(j.inventory.setsPartiallySold)) +
    statRow("Parures entièrement vendues", String(j.inventory.setsFullySold));

  const scrapBody =
    statRow("Nombre d'achats", String(j.scrap.count)) +
    statRow("Poids total acheté", formatGrams(j.scrap.totalWeight)) +
    statRow("Prix moyen / gramme", formatDZD(j.scrap.avgPricePerGram)) +
    statRow("Montant total dépensé", formatDZD(j.scrap.totalAmount));

  const expBody =
    statRow("Nombre de dépenses", String(j.expenses.count)) +
    statRow("Montant total des dépenses", formatDZD(j.expenses.totalAmount)) +
    statRow("Achats de stock", `${j.expenses.stockPurchaseCount} · ${formatDZD(j.expenses.stockPurchaseAmount)}`) +
    table(["Catégorie", "Nb", "Montant"], j.expenses.byCategory.map((c) => [esc(c.category), String(c.count), formatDZD(c.amount)]));

  const supBody = table(
    ["Fournisseur", "Achats", "Montant"],
    j.suppliers.map((s2) => [esc(s2.supplier), String(s2.count), formatDZD(s2.amount)]),
  );

  const custBody =
    statRow("Nouveaux clients", String(j.customers.newCount)) +
    statRow("Versements clients reçus", formatDZD(j.customers.paymentsReceived)) +
    statRow("Soldes clients en attente (total)", formatDZD(j.customers.outstandingBalance)) +
    (j.customers.newNames.length ? `<p class="names">${j.customers.newNames.map(esc).join(", ")}</p>` : "");

  const goldBody = table(
    ["Titre", "Ancien cours", "Nouveau cours", "Source", "Heure"],
    j.goldPrices.map((g) => [
      `${g.karat}K`,
      g.previous != null ? formatDZD(g.previous) : "—",
      formatDZD(g.current),
      esc(g.user),
      esc(formatDateTime(g.at)),
    ]),
  );

  const userBody = table(
    ["Utilisateur", "Ventes", "Stock", "Versements", "Dépenses", "Or cassé"],
    j.userActivity.map((u) => [esc(u.user), String(u.sales), String(u.inventory), String(u.payments), String(u.expenses), String(u.scrap)]),
  );

  const logBody = table(
    ["Date & heure", "Utilisateur", "Action"],
    j.activityLog.map((a) => [esc(formatDateTime(a.time)), esc(a.user), `${esc(a.action)}${a.detail ? ` · ${esc(a.detail)}` : ""}`]),
  );

  const finBody = `<div class="fin">
    ${statRow("Total des ventes", formatDZD(j.financial.totalSales))}
    ${statRow("Total des dépenses", formatDZD(j.financial.totalExpenses))}
    ${statRow("Total achats d'or cassé", formatDZD(j.financial.totalScrap))}
    ${statRow("Versements reçus", formatDZD(j.financial.paymentsReceived))}
    ${statRow("Soldes en attente", formatDZD(j.financial.outstandingBalance))}
    <div class="stat grand"><span class="sl">Résultat net du jour</span><span class="sv">${esc(formatDZD(j.financial.netResult))}</span></div>
  </div>`;

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>Journal Quotidien ${esc(dateLabel)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; line-height: 1.5; }
  .sheet { max-width: 182mm; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a227; padding-bottom: 14px; margin-bottom: 18px; }
  .brand { display: flex; gap: 12px; align-items: center; }
  .logo { width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg,#c9a227,#8a6d10); color: #fff; display: flex; align-items: center; justify-content: center; font-family: Georgia, serif; font-size: 26px; font-weight: 700; }
  .logo-img { width: 60px; height: 60px; object-fit: contain; border-radius: 10px; }
  .store { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #b8860b; }
  .sub { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .company { font-size: 10px; color: #555; margin-top: 4px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 17px; margin: 0 0 4px; text-transform: uppercase; letter-spacing: 1px; }
  .doc .meta { font-size: 10px; color: #555; }
  .block { margin-bottom: 16px; break-inside: avoid; }
  h2 { font-size: 13px; color: #8a6d10; text-transform: uppercase; letter-spacing: .5px; border-bottom: 1px solid #e6e1d5; padding-bottom: 4px; margin: 0 0 8px; }
  .stat { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px dotted #eee; }
  .sl { color: #555; }
  .sv { font-weight: 600; }
  .names { font-size: 11px; color: #666; margin: 6px 0 0; }
  .empty { font-size: 11px; color: #999; font-style: italic; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  thead th { background: #faf7ef; border-bottom: 2px solid #c9a227; text-align: left; padding: 5px 8px; font-size: 10px; text-transform: uppercase; color: #8a6d10; }
  tbody td { padding: 5px 8px; border-bottom: 1px solid #eee; }
  .num { text-align: right; white-space: nowrap; }
  .fin { border: 1px solid #c9a227; border-radius: 10px; padding: 10px 14px; background: #faf7ef; }
  .fin .grand { border-top: 2px solid #c9a227; border-bottom: none; margin-top: 6px; padding-top: 8px; font-size: 14px; color: #b8860b; }
  .fin .grand .sv { color: #b8860b; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 40px; }
  .sign div { flex: 1; text-align: center; font-size: 10px; color: #555; border-top: 1px solid #999; padding-top: 6px; }
  .foot { text-align: center; font-size: 9px; color: #999; margin-top: 20px; border-top: 1px solid #eee; padding-top: 8px; }
  .pageno { position: fixed; bottom: 6mm; right: 14mm; font-size: 9px; color: #999; }
</style></head><body>
  <div class="sheet">
    <div class="top">
      <div class="brand">
        ${logoHtml}
        <div>
          <div class="store">${esc(store.name)}</div>
          <div class="sub">${esc(store.tagline)}</div>
          <div class="company">${esc(store.address)}${contactLine ? `<br/>${contactLine}` : ""}${store.rc ? `<br/>${esc(store.rc)}` : ""}</div>
        </div>
      </div>
      <div class="doc">
        <h1>Journal Quotidien</h1>
        <div class="meta">Période : <strong>${esc(dateLabel)}</strong></div>
        <div class="meta">Généré le : ${esc(genAt)}</div>
        <div class="meta">Par : ${esc(generatedBy)}</div>
      </div>
    </div>

    ${section("Résumé financier", finBody)}

    <div class="grid2">
      ${section("1. Ventes", salesBody)}
      ${section("2. Mouvements de stock", invBody)}
      ${section("3. Or cassé", scrapBody)}
      ${section("4. Dépenses", expBody)}
    </div>

    ${section("5. Fournisseurs", supBody)}
    ${section("6. Clients", custBody)}
    ${section("7. Cours de l'or", goldBody)}
    ${section("8. Activité par utilisateur", userBody)}
    ${section("Actions critiques", logBody)}

    <div class="sign">
      <div>${esc(s.signature_left || "Signature du responsable")}</div>
      <div>${esc(s.signature_right || "Cachet & signature")}</div>
    </div>

    <div class="foot">${esc(store.name)} · Journal Quotidien généré le ${esc(genAt)}${store.phone ? ` · ${esc(store.phone)}` : ""}</div>
  </div>
</body></html>`;
}

/** Open the journal in a new window and trigger the print / save-as-PDF dialog. */
export function printJournal(j: JournalSummary, generatedBy: string): void {
  const html = buildJournalHtml(j, generatedBy);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
