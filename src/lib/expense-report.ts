import { formatDZD, formatDateTime, formatDate, paymentLabel } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";


export interface ExpenseRow {
  id: string;
  reference: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  supplier_name?: string | null;
  employee_name?: string | null;
  notes?: string | null;
  spent_at: string;
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

const STYLE = `
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 13px; line-height: 1.5; }
  .sheet { max-width: 178mm; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a227; padding-bottom: 16px; margin-bottom: 24px; }
  .store { font-family: Georgia, serif; font-size: 24px; font-weight: 700; color: #b8860b; }
  .sub { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .company { font-size: 11px; color: #555; margin-top: 6px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 19px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px; }
  .doc .meta { font-size: 11px; color: #555; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { background: #faf7ef; border-bottom: 2px solid #c9a227; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; color: #8a6d10; }
  tbody td { padding: 9px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .card { border: 1px solid #e6e1d5; border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; }
  .card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; border-bottom: 1px dashed #eee; }
  .row .l { color: #666; }
  .total { display: flex; justify-content: flex-end; }
  .total .box { border-top: 2px solid #c9a227; padding-top: 10px; font-size: 16px; font-weight: 700; color: #b8860b; }
  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; }
  .sign div { flex: 1; text-align: center; font-size: 11px; color: #555; border-top: 1px solid #999; padding-top: 6px; }
  .foot { text-align: center; font-size: 10px; color: #999; margin-top: 28px; border-top: 1px solid #eee; padding-top: 10px; }
`;

function shell(pageTitle: string, headHtml: string, innerHtml: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>${esc(pageTitle)}</title>
<style>${STYLE}</style></head><body><div class="sheet">
  <div class="top">
    <div>
      <div class="store">${esc(STORE_INFO.name)}</div>
      <div class="sub">${esc(STORE_INFO.tagline)}</div>
      <div class="company">${esc(STORE_INFO.address)}<br/>${esc(STORE_INFO.phone)} · ${esc(STORE_INFO.email)}</div>
    </div>
    <div class="doc">${headHtml}</div>
  </div>
  ${innerHtml}
  <div class="foot">${esc(STORE_INFO.name)} · ${esc(STORE_INFO.phone)}</div>
</div></body></html>`;
}

/** A4 receipt for a single expense. */
export function buildExpenseReceiptHtml(e: ExpenseRow): string {
  const head = `<h1>Reçu de dépense</h1><div class="meta">N° ${esc(e.reference)}</div><div class="meta">${esc(formatDateTime(e.spent_at))}</div>`;
  const inner = `
    <div class="card">
      <h3>Détails de la dépense</h3>
      <div class="row"><span class="l">Référence</span><span>${esc(e.reference)}</span></div>
      <div class="row"><span class="l">Date</span><span>${esc(formatDateTime(e.spent_at))}</span></div>
      <div class="row"><span class="l">Catégorie</span><span>${esc(e.category)}</span></div>
      <div class="row"><span class="l">Description</span><span>${esc(e.description)}</span></div>
      <div class="row"><span class="l">Mode de paiement</span><span>${esc(paymentLabel(e.payment_method))}</span></div>
      <div class="row"><span class="l">Fournisseur</span><span>${esc(e.supplier_name)}</span></div>
      <div class="row"><span class="l">Enregistré par</span><span>${esc(e.employee_name)}</span></div>
      ${e.notes ? `<div class="row"><span class="l">Notes</span><span>${esc(e.notes)}</span></div>` : ""}
    </div>
    <div class="total"><div class="box">Montant : ${esc(formatDZD(e.amount))}</div></div>
    <div class="sign"><div>Signature responsable</div><div>Cachet</div></div>`;
  return shell(`Reçu ${e.reference}`, head, inner);
}

export interface ExpenseReportOptions {
  periodLabel: string;
  rows: ExpenseRow[];
  byCategory: { category: string; total: number; count: number }[];
}

/** A4 expense report for a period with category breakdown. */
export function buildExpenseReportHtml(opts: ExpenseReportOptions): string {
  const total = opts.rows.reduce((s, e) => s + Number(e.amount), 0);
  const head = `<h1>Rapport de dépenses</h1><div class="meta">${esc(opts.periodLabel)}</div><div class="meta">Édité le ${esc(formatDate(new Date()))}</div>`;
  const catRows = opts.byCategory
    .map(
      (c) =>
        `<tr><td>${esc(c.category)}</td><td class="num">${esc(c.count)}</td><td class="num">${esc(formatDZD(c.total))}</td><td class="num">${total ? Math.round((c.total / total) * 100) : 0}%</td></tr>`,
    )
    .join("");
  const detailRows = opts.rows
    .map(
      (e) =>
        `<tr><td>${esc(e.reference)}</td><td>${esc(formatDate(e.spent_at))}</td><td>${esc(e.category)}</td><td>${esc(e.description)}</td><td>${esc(paymentLabel(e.payment_method))}</td><td class="num">${esc(formatDZD(e.amount))}</td></tr>`,
    )
    .join("");
  const inner = `
    <div class="card"><h3>Synthèse</h3>
      <div class="row"><span class="l">Nombre de dépenses</span><span>${opts.rows.length}</span></div>
      <div class="row"><span class="l">Total de la période</span><span><strong>${esc(formatDZD(total))}</strong></span></div>
    </div>
    <h3 style="color:#b8860b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Répartition par catégorie</h3>
    <table><thead><tr><th>Catégorie</th><th class="num">Nb</th><th class="num">Total</th><th class="num">%</th></tr></thead>
      <tbody>${catRows || `<tr><td colspan="4">Aucune donnée</td></tr>`}</tbody></table>
    <h3 style="color:#b8860b;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Détail des dépenses</h3>
    <table><thead><tr><th>Réf.</th><th>Date</th><th>Catégorie</th><th>Description</th><th>Paiement</th><th class="num">Montant</th></tr></thead>
      <tbody>${detailRows || `<tr><td colspan="6">Aucune dépense</td></tr>`}</tbody></table>
    <div class="total"><div class="box">Total : ${esc(formatDZD(total))}</div></div>`;
  return shell("Rapport de dépenses", head, inner);
}

/** Open an HTML document in a new window and trigger the print / save-as-PDF dialog. */
export function printHtmlDocument(html: string): void {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
