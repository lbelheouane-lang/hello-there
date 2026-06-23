import { formatDZD, formatGrams, formatDateTime, formatDate } from "@/lib/format";
import { printHtml } from "@/lib/print";
import { getStoreInfo } from "@/lib/invoice";

export interface PurchaseRow {
  id: string;
  reference: string;
  sku: string;
  product_name: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  quantity: number;
  metal_purchase_price: number;
  labor_cost: number;
  unit_cost: number;
  total_cost: number;
  employee_name?: string | null;
  origin?: string | null;
  created_at: string;
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

const METAL_LABELS: Record<string, string> = { or: "Or", argent: "Argent", platine: "Platine" };
function metalLabel(m: string): string {
  return METAL_LABELS[m] ?? m;
}
function purity(p: PurchaseRow): string {
  return p.gold_karat ? `${p.gold_karat}K` : "—";
}

const STYLE = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; line-height: 1.5; }
  .sheet { max-width: 182mm; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a227; padding-bottom: 16px; margin-bottom: 22px; }
  .store { font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #b8860b; }
  .sub { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .company { font-size: 11px; color: #555; margin-top: 6px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 18px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px; }
  .doc .meta { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { background: #faf7ef; border-bottom: 2px solid #c9a227; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; color: #8a6d10; }
  tbody td { padding: 7px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 18px; }
  .stat { flex: 1; min-width: 110px; border: 1px solid #e6e1d5; border-radius: 10px; padding: 10px 12px; }
  .stat .l { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #999; }
  .stat .v { font-size: 15px; font-weight: 700; color: #b8860b; margin-top: 3px; }
  .card { border: 1px solid #e6e1d5; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
  .card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .rowi { display: flex; justify-content: space-between; padding: 4px 0; font-size: 12px; border-bottom: 1px dashed #eee; }
  .rowi .l { color: #666; }
  .total { display: flex; justify-content: flex-end; }
  .total .box { border-top: 2px solid #c9a227; padding-top: 10px; font-size: 16px; font-weight: 700; color: #b8860b; }
  .foot { text-align: center; font-size: 10px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 10px; }
  h2.sec { color:#b8860b; font-size:12px; text-transform:uppercase; letter-spacing:1px; margin: 14px 0 6px; }
`;

function shell(pageTitle: string, headHtml: string, innerHtml: string): string {
  const store = getStoreInfo();
  const contact = [store.phone, store.email].filter(Boolean).map(esc).join(" · ");
  const logoHtml = store.logo
    ? `<img src="${esc(store.logo)}" alt="${esc(store.name)}" style="width:60px;height:60px;object-fit:contain;border-radius:10px;" />`
    : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>${esc(pageTitle)}</title>
<style>${STYLE}</style></head><body><div class="sheet">
  <div class="top">
    <div style="display:flex;gap:12px;align-items:center;">
      ${logoHtml}
      <div>
        <div class="store">${esc(store.name)}</div>
        <div class="sub">${esc(store.tagline)}</div>
        <div class="company">${esc(store.address)}${contact ? `<br/>${contact}` : ""}</div>
      </div>
    </div>
    <div class="doc">${headHtml}</div>
  </div>
  ${innerHtml}
  <div class="foot">${esc(store.name)}${store.phone ? ` · ${esc(store.phone)}` : ""}</div>
</div></body></html>`;
}

export interface SupplierSummary {
  count: number;
  totalWeight: number;
  totalLabor: number;
  totalSpent: number;
  lastPurchase: string | null;
}

export function summarize(rows: PurchaseRow[]): SupplierSummary {
  return {
    count: rows.reduce((s, r) => s + r.quantity, 0),
    totalWeight: rows.reduce((s, r) => s + Number(r.weight_grams) * r.quantity, 0),
    totalLabor: rows.reduce((s, r) => s + Number(r.labor_cost) * r.quantity, 0),
    totalSpent: rows.reduce((s, r) => s + Number(r.total_cost), 0),
    lastPurchase: rows.length
      ? rows.reduce((m, r) => (r.created_at > m ? r.created_at : m), rows[0].created_at)
      : null,
  };
}

function statCards(s: SupplierSummary): string {
  return `<div class="cards">
    <div class="stat"><div class="l">Achats</div><div class="v">${s.count}</div></div>
    <div class="stat"><div class="l">Poids total</div><div class="v">${esc(formatGrams(s.totalWeight))}</div></div>
    <div class="stat"><div class="l">Main-d'œuvre</div><div class="v">${esc(formatDZD(s.totalLabor))}</div></div>
    <div class="stat"><div class="l">Total dépensé</div><div class="v">${esc(formatDZD(s.totalSpent))}</div></div>
    <div class="stat"><div class="l">Dernier achat</div><div class="v" style="font-size:12px;">${s.lastPurchase ? esc(formatDate(s.lastPurchase)) : "—"}</div></div>
  </div>`;
}

function detailTable(rows: PurchaseRow[]): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${esc(r.reference)}</td><td>${esc(formatDate(r.created_at))}</td><td>${esc(r.sku)}</td><td>${esc(r.product_name)}</td><td>${esc(metalLabel(r.metal_type))}</td><td>${esc(purity(r))}</td><td class="num">${esc(formatGrams(Number(r.weight_grams)))}</td><td class="num">${esc(r.quantity)}</td><td class="num">${esc(formatDZD(r.labor_cost))}</td><td class="num">${esc(formatDZD(r.total_cost))}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr>
    <th>Réf.</th><th>Date</th><th>SKU</th><th>Produit</th><th>Métal</th><th>Titre</th>
    <th class="num">Poids</th><th class="num">Qté</th><th class="num">M.O.</th><th class="num">Total</th>
  </tr></thead><tbody>${body || `<tr><td colspan="10">Aucun achat</td></tr>`}</tbody></table>`;
}

/** A4 purchase history report for one supplier. */
export function buildSupplierReportHtml(supplierName: string, periodLabel: string, rows: PurchaseRow[]): string {
  const s = summarize(rows);
  const head = `<h1>Historique d'achats</h1><div class="meta">${esc(supplierName)}</div><div class="meta">${esc(periodLabel)}</div><div class="meta">Édité le ${esc(formatDate(new Date()))}</div>`;
  // weight by metal type
  const byMetal = new Map<string, number>();
  rows.forEach((r) => byMetal.set(r.metal_type, (byMetal.get(r.metal_type) ?? 0) + Number(r.weight_grams) * r.quantity));
  const metalRows = [...byMetal.entries()]
    .map(([m, w]) => `<tr><td>${esc(metalLabel(m))}</td><td class="num">${esc(formatGrams(w))}</td></tr>`)
    .join("");
  const inner = `
    ${statCards(s)}
    <h2 class="sec">Poids acheté par type de métal</h2>
    <table><thead><tr><th>Métal</th><th class="num">Poids total</th></tr></thead>
      <tbody>${metalRows || `<tr><td colspan="2">Aucune donnée</td></tr>`}</tbody></table>
    <h2 class="sec">Détail des achats</h2>
    ${detailTable(rows)}
    <div class="total"><div class="box">Total dépensé : ${esc(formatDZD(s.totalSpent))}</div></div>`;
  return shell(`Achats ${supplierName}`, head, inner);
}

/** A4 receipt for a single purchase record. */
export function buildPurchaseReceiptHtml(supplierName: string, r: PurchaseRow): string {
  const head = `<h1>Bon d'achat</h1><div class="meta">N° ${esc(r.reference)}</div><div class="meta">${esc(formatDateTime(r.created_at))}</div>`;
  const inner = `
    <div class="card"><h3>Fournisseur</h3>
      <div class="rowi"><span class="l">Nom</span><span>${esc(supplierName)}</span></div>
    </div>
    <div class="card"><h3>Détails de l'achat</h3>
      <div class="rowi"><span class="l">Référence</span><span>${esc(r.reference)}</span></div>
      <div class="rowi"><span class="l">Date</span><span>${esc(formatDateTime(r.created_at))}</span></div>
      <div class="rowi"><span class="l">SKU produit</span><span>${esc(r.sku)}</span></div>
      <div class="rowi"><span class="l">Produit</span><span>${esc(r.product_name)}</span></div>
      <div class="rowi"><span class="l">Métal</span><span>${esc(metalLabel(r.metal_type))}</span></div>
      <div class="rowi"><span class="l">Titre</span><span>${esc(purity(r))}</span></div>
      <div class="rowi"><span class="l">Poids</span><span>${esc(formatGrams(Number(r.weight_grams)))}</span></div>
      <div class="rowi"><span class="l">Quantité</span><span>${esc(r.quantity)}</span></div>
      <div class="rowi"><span class="l">Prix du métal</span><span>${esc(formatDZD(r.metal_purchase_price))}</span></div>
      <div class="rowi"><span class="l">Main-d'œuvre</span><span>${esc(formatDZD(r.labor_cost))}</span></div>
      <div class="rowi"><span class="l">Coût unitaire</span><span>${esc(formatDZD(r.unit_cost))}</span></div>
      ${r.origin ? `<div class="rowi"><span class="l">Origine</span><span>${esc(r.origin)}</span></div>` : ""}
      <div class="rowi"><span class="l">Enregistré par</span><span>${esc(r.employee_name)}</span></div>
    </div>
    <div class="total"><div class="box">Coût total : ${esc(formatDZD(r.total_cost))}</div></div>`;
  return shell(`Bon d'achat ${r.reference}`, head, inner);
}

/** Open an HTML document in a new window and trigger the print / save-as-PDF dialog. */
export function printHtmlDocument(html: string): void {
  printHtml(html);
}

export { metalLabel as purchaseMetalLabel };
