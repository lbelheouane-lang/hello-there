import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";

/** A single inventory line in the stock report. */
export interface StockReportRow {
  entryDate: string;
  name: string;
  category: string;
  metalLabel: string;
  originLabel: string;
  country: string;
  quantity: number;
  weight: number;
  sellingPrice: number;
}

/** Aggregated total for a group (metal type, origin or category). */
export interface StockGroupTotal {
  label: string;
  count: number;
  quantity: number;
  weight: number;
  value: number;
}

export interface StockReportData {
  rows: StockReportRow[];
  generatedBy: string;
  sortLabel: string;
  totals: {
    products: number;
    quantity: number;
    weight: number;
    value: number;
  };
  byMetal: StockGroupTotal[];
  byOrigin: StockGroupTotal[];
  byCategory: StockGroupTotal[];
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

const STYLE = `
  @page { size: A4 landscape; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; line-height: 1.45; }
  .sheet { margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a227; padding-bottom: 14px; margin-bottom: 18px; }
  .store { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #b8860b; }
  .sub { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .company { font-size: 10px; color: #555; margin-top: 5px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 17px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px; }
  .doc .meta { font-size: 10px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead th { background: #faf7ef; border-bottom: 2px solid #c9a227; text-align: left; padding: 7px 8px; font-size: 10px; text-transform: uppercase; color: #8a6d10; }
  tbody td { padding: 6px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tbody tr:nth-child(even) { background: #fcfaf4; }
  .num { text-align: right; white-space: nowrap; }
  .grids { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; }
  .grids .block { flex: 1; min-width: 220px; }
  .grids h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .summary { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  .summary .box { flex: 1; min-width: 150px; border: 1px solid #e6e1d5; border-radius: 10px; padding: 10px 12px; }
  .summary .l { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: .5px; }
  .summary .v { font-size: 18px; font-weight: 700; color: #b8860b; margin-top: 2px; }
  .foot { text-align: center; font-size: 10px; color: #999; margin-top: 22px; border-top: 1px solid #eee; padding-top: 10px; }
`;

function groupTable(title: string, groups: StockGroupTotal[]): string {
  const rows = groups
    .map(
      (g) =>
        `<tr><td>${esc(g.label)}</td><td class="num">${esc(g.count)}</td><td class="num">${esc(g.quantity)}</td><td class="num">${esc(formatGrams(g.weight))}</td><td class="num">${esc(formatDZD(g.value))}</td></tr>`,
    )
    .join("");
  return `<div class="block"><h3>${esc(title)}</h3>
    <table><thead><tr><th>${esc(title)}</th><th class="num">Réf.</th><th class="num">Qté</th><th class="num">Poids</th><th class="num">Valeur</th></tr></thead>
    <tbody>${rows || `<tr><td colspan="5">Aucune donnée</td></tr>`}</tbody></table></div>`;
}

/** Build a self-contained A4 (landscape) HTML stock inventory report. */
export function buildStockReportHtml(data: StockReportData): string {
  const store = getStoreInfo();
  const contact = [store.phone, store.email].filter(Boolean).map(esc).join(" · ");
  const logoHtml = store.logo
    ? `<img src="${esc(store.logo)}" alt="${esc(store.name)}" style="width:56px;height:56px;object-fit:contain;border-radius:10px;" />`
    : "";

  const detailRows = data.rows
    .map(
      (r) =>
        `<tr>
          <td>${esc(formatDate(r.entryDate))}</td>
          <td>${esc(r.name)}</td>
          <td>${esc(r.category)}</td>
          <td>${esc(r.metalLabel)}</td>
          <td>${esc(r.originLabel)}</td>
          <td>${esc(r.country)}</td>
          <td class="num">${esc(r.quantity)}</td>
          <td class="num">${esc(formatGrams(r.weight))}</td>
          <td class="num">${esc(formatDZD(r.sellingPrice))}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>Rapport d'inventaire — ${esc(store.name)}</title>
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
    <div class="doc">
      <h1>Rapport d'inventaire du stock</h1>
      <div class="meta">Généré le : ${esc(formatDateTime(new Date()))}</div>
      <div class="meta">Généré par : ${esc(data.generatedBy)}</div>
      <div class="meta">Tri : ${esc(data.sortLabel)}</div>
    </div>
  </div>

  <div class="summary">
    <div class="box"><div class="l">Nombre de produits</div><div class="v">${esc(data.totals.products)}</div></div>
    <div class="box"><div class="l">Quantité totale</div><div class="v">${esc(data.totals.quantity)}</div></div>
    <div class="box"><div class="l">Poids total</div><div class="v">${esc(formatGrams(data.totals.weight))}</div></div>
    <div class="box"><div class="l">Valeur totale du stock</div><div class="v">${esc(formatDZD(data.totals.value))}</div></div>
  </div>

  <table>
    <thead><tr>
      <th>Date d'entrée</th><th>Produit</th><th>Catégorie</th><th>Type de métal</th>
      <th>Origine</th><th>Pays</th><th class="num">Qté</th><th class="num">Poids</th><th class="num">Prix de vente (DZD)</th>
    </tr></thead>
    <tbody>${detailRows || `<tr><td colspan="9">Aucun produit en stock</td></tr>`}</tbody>
  </table>

  <div class="grids">
    ${groupTable("Type de métal", data.byMetal)}
    ${groupTable("Origine", data.byOrigin)}
    ${groupTable("Catégorie", data.byCategory)}
  </div>

  <div class="foot">${esc(store.name)}${store.phone ? ` · ${esc(store.phone)}` : ""} — Document destiné à l'audit et à la comptabilité</div>
</div></body></html>`;
}

/** Open the report in a new window and trigger the print / save-as-PDF dialog. */
export function printStockReport(data: StockReportData): void {
  const html = buildStockReportHtml(data);
  const w = window.open("", "_blank", "width=1100,height=900");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}

/** Build an Excel-compatible (HTML table) workbook and download it as .xls. */
export function exportStockReportExcel(data: StockReportData): void {
  const head = `<tr>
    <th>Date d'entrée</th><th>Produit</th><th>Catégorie</th><th>Type de métal</th>
    <th>Origine</th><th>Pays d'origine</th><th>Quantité</th><th>Poids (g)</th><th>Prix de vente (DZD)</th>
  </tr>`;
  const rows = data.rows
    .map(
      (r) =>
        `<tr>
          <td>${esc(formatDate(r.entryDate))}</td>
          <td>${esc(r.name)}</td>
          <td>${esc(r.category)}</td>
          <td>${esc(r.metalLabel)}</td>
          <td>${esc(r.originLabel)}</td>
          <td>${esc(r.country)}</td>
          <td>${esc(r.quantity)}</td>
          <td>${esc(r.weight)}</td>
          <td>${esc(r.sellingPrice)}</td>
        </tr>`,
    )
    .join("");
  const totalRow = `<tr>
    <td colspan="6"><b>TOTAUX</b></td>
    <td><b>${esc(data.totals.quantity)}</b></td>
    <td><b>${esc(data.totals.weight)}</b></td>
    <td><b>${esc(data.totals.value)}</b></td>
  </tr>`;

  const groupBlock = (title: string, groups: StockGroupTotal[]): string => {
    const gRows = groups
      .map(
        (g) =>
          `<tr><td>${esc(g.label)}</td><td>${esc(g.count)}</td><td>${esc(g.quantity)}</td><td>${esc(g.weight)}</td><td>${esc(g.value)}</td></tr>`,
      )
      .join("");
    return `<tr><td colspan="9"></td></tr>
      <tr><th colspan="5">Totaux par ${esc(title)}</th></tr>
      <tr><th>${esc(title)}</th><th>Réf.</th><th>Quantité</th><th>Poids (g)</th><th>Valeur (DZD)</th></tr>
      ${gRows}`;
  };

  const store = getStoreInfo();
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8" /></head><body>
  <table>
    <tr><th colspan="9">${esc(store.name)} — Rapport d'inventaire du stock</th></tr>
    <tr><td colspan="9">Généré le ${esc(formatDateTime(new Date()))} · par ${esc(data.generatedBy)} · ${esc(data.sortLabel)}</td></tr>
    <tr><td colspan="9"></td></tr>
    ${head}
    ${rows}
    ${totalRow}
    ${groupBlock("Type de métal", data.byMetal)}
    ${groupBlock("Origine", data.byOrigin)}
    ${groupBlock("Catégorie", data.byCategory)}
  </table>
</body></html>`;

  const blob = new Blob(["\ufeff", html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `inventaire-stock-${new Date().toISOString().slice(0, 10)}.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
