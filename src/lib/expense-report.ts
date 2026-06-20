import { formatDZD, formatDateTime, formatDate, paymentLabel } from "@/lib/format";
import { STORE_INFO } from "@/lib/invoice";

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

function shell(title: string, inner: string): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
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
</style></head><body><div class="sheet">
  <div class="top">
    <div>
      <div class="store">${esc(STORE_INFO.name)}</div>
      <div class="sub">${esc(STORE_INFO.tagline)}</div>
      <div class="company">${esc(STORE_INFO.address)}<br/>${esc(STORE_INFO.phone)} · ${esc(STORE_INFO.email)}</div>
    </div>
    <div class="doc">${title}</div>
  </div>
  ${inner}
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
  return shell(`Reçu ${e.reference}`, shell ? head + "" : "").replace("</div>\n  ${inner}", "") , // placeholder
  shell(`Reçu ${e.reference}`, inner.replace("${head}", "")), inner, head;
}
