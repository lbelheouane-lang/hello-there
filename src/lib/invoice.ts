import { formatDZD, formatDateTime, formatGrams, paymentLabel } from "@/lib/format";
import { getStoreSettings } from "@/lib/store-settings";

/** Live store identity derived from configurable settings (with fallbacks). */
export function getStoreInfo() {
  const s = getStoreSettings();
  return {
    name: s.store_name || "Maison d'Or",
    tagline: s.slogan || s.tagline || "Bijouterie · Or & Joaillerie",
    address: s.address || "",
    phone: s.phone || "",
    email: s.email || "",
    website: s.website || "",
    rc: s.tax_id || "",
    logo: s.logo_url || "",
  };
}

/** @deprecated kept for compatibility — prefer getStoreInfo() */
export const STORE_INFO = {
  get name() { return getStoreInfo().name; },
  get tagline() { return getStoreInfo().tagline; },
  get address() { return getStoreInfo().address; },
  get phone() { return getStoreInfo().phone; },
  get email() { return getStoreInfo().email; },
  get rc() { return getStoreInfo().rc; },
};

export type InvoicePaymentStatus = "paid" | "partial" | "overdue" | "unpaid";

export interface InvoiceRecord {
  id: string;
  invoice_number: string;
  invoice_type: string; // 'sale' | 'payment'
  sale_number: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  product_sku: string | null;
  product_name: string | null;
  metal_type: string | null;
  gold_karat: number | null;
  weight_grams: number | null;
  purchase_price_per_gram: number | null;
  gold_value: number | null;
  quantity: number;
  unit_price: number;
  discount: number;
  total_amount: number;
  amount_this_tx: number;
  total_paid: number;
  balance: number;
  payment_method: string | null;
  payment_status: string;
  sale_type: string | null;
  employee_name: string | null;
  notes: string | null;
  issued_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  paid: "Soldé",
  partial: "Partiellement payé",
  overdue: "En retard",
  unpaid: "Impayé",
};

const STATUS_COLOR: Record<string, string> = {
  paid: "#15803d",
  partial: "#b45309",
  overdue: "#b91c1c",
  unpaid: "#6b7280",
};

const METAL_LABEL: Record<string, string> = {
  or: "Or",
  argent: "Argent",
  platine: "Platine",
};

export function invoiceStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function invoiceTypeLabel(type: string): string {
  return type === "payment" ? "Reçu de versement" : "Facture de vente";
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function purityLabel(inv: InvoiceRecord): string {
  if (inv.gold_karat) return `${inv.gold_karat}K`;
  return inv.metal_type ? (METAL_LABEL[inv.metal_type] ?? inv.metal_type) : "—";
}

/** Build a self-contained A4 HTML document for an invoice / receipt. */
export function buildInvoiceHtml(inv: InvoiceRecord): string {
  const isPayment = inv.invoice_type === "payment";
  const statusColor = STATUS_COLOR[inv.payment_status] ?? "#6b7280";
  const store = getStoreInfo();
  const s = getStoreSettings();
  const logoHtml = store.logo
    ? `<img class="logo-img" src="${esc(store.logo)}" alt="${esc(store.name)}" />`
    : `<div class="logo">${esc(store.name.charAt(0).toUpperCase() || "M")}</div>`;
  const contactLine = [store.phone, store.email].filter(Boolean).map(esc).join(" · ");


  const productRows = inv.product_name
    ? `<tr>
         <td>${esc(inv.product_sku)}</td>
         <td>
           <strong>${esc(inv.product_name)}</strong>
           <div class="muted">${esc(inv.metal_type ? (METAL_LABEL[inv.metal_type] ?? inv.metal_type) : "—")} · ${esc(purityLabel(inv))} · ${esc(formatGrams(inv.weight_grams))}</div>
         </td>
         <td class="num">${esc(inv.quantity)}</td>
         <td class="num">${esc(formatDZD(inv.unit_price))}</td>
         <td class="num">${esc(formatDZD(inv.unit_price * inv.quantity))}</td>
       </tr>`
    : "";

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>${esc(invoiceTypeLabel(inv.invoice_type))} ${esc(inv.invoice_number)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; }
  .sheet { max-width: 178mm; margin: 0 auto; padding: 8mm 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a227; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .logo { width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg,#c9a227,#8a6d10); color: #fff; display: flex; align-items: center; justify-content: center; font-family: Georgia, serif; font-size: 30px; font-weight: 700; }
  .logo-img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; }
  .header-note { font-size: 11px; color: #555; margin: 0 0 16px; white-space: pre-line; }
  .terms { margin: 18px 0 0; font-size: 10px; color: #777; white-space: pre-line; border-top: 1px dashed #ddd; padding-top: 8px; }
  .store { font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 700; color: #b8860b; letter-spacing: .5px; }
  .sub { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .company { font-size: 11px; color: #555; margin-top: 6px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 20px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px; color: #1a1a1a; }
  .doc .no { font-size: 15px; font-weight: 700; color: #b8860b; }
  .doc .meta { font-size: 11px; color: #555; margin-top: 4px; }
  .badge { display: inline-block; margin-top: 8px; padding: 3px 12px; border-radius: 999px; color: #fff; font-size: 11px; font-weight: 700; }
  .parties { display: flex; gap: 24px; margin-bottom: 22px; }
  .card { flex: 1; border: 1px solid #e6e1d5; border-radius: 12px; padding: 12px 14px; }
  .card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .card p { margin: 2px 0; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
  thead th { background: #faf7ef; border-bottom: 2px solid #c9a227; text-align: left; padding: 8px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: #8a6d10; }
  tbody td { padding: 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  .muted { color: #777; font-size: 11px; margin-top: 2px; }
  .totals { display: flex; justify-content: flex-end; }
  .totals table { width: 56%; }
  .totals td { padding: 6px 10px; border: none; font-size: 13px; }
  .totals .lbl { color: #666; }
  .totals .val { text-align: right; font-weight: 600; }
  .totals .grand td { border-top: 2px solid #c9a227; font-size: 15px; font-weight: 700; color: #b8860b; padding-top: 10px; }
  .totals .bal td { color: ${statusColor}; font-weight: 700; }
  .notes { margin: 18px 0; font-size: 12px; color: #555; border-left: 3px solid #c9a227; padding: 6px 12px; background: #faf7ef; border-radius: 0 8px 8px 0; }
  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; }
  .sign div { flex: 1; text-align: center; font-size: 11px; color: #555; border-top: 1px solid #999; padding-top: 6px; }
  .foot { text-align: center; font-size: 10px; color: #999; margin-top: 28px; border-top: 1px solid #eee; padding-top: 10px; }
</style></head><body>
  <div class="sheet">
    <div class="top">
      <div class="brand">
        ${logoHtml}
        <div>
          <div class="store">${esc(store.name)}</div>
          <div class="sub">${esc(store.tagline)}</div>
          <div class="company">${esc(store.address)}${contactLine ? `<br/>${contactLine}` : ""}${store.website ? `<br/>${esc(store.website)}` : ""}${store.rc ? `<br/>${esc(store.rc)}` : ""}</div>
        </div>
      </div>
      <div class="doc">
        <h1>${esc(invoiceTypeLabel(inv.invoice_type))}</h1>
        <div class="no">N° ${esc(inv.invoice_number)}</div>
        <div class="meta">Date : ${esc(formatDateTime(inv.issued_at))}</div>
        ${isPayment && inv.sale_number ? `<div class="meta">Facture liée : ${esc(inv.sale_number)}</div>` : ""}
        <div class="badge" style="background:${statusColor}">${esc(invoiceStatusLabel(inv.payment_status))}</div>
      </div>
    </div>

    ${s.invoice_header ? `<div class="header-note">${esc(s.invoice_header)}</div>` : ""}


    <div class="parties">
      <div class="card">
        <h3>Client</h3>
        <p><strong>${esc(inv.customer_name)}</strong></p>
        <p>${esc(inv.customer_phone)}</p>
        ${inv.customer_address ? `<p>${esc(inv.customer_address)}</p>` : ""}
      </div>
      <div class="card">
        <h3>Transaction</h3>
        <p>Type : ${esc(inv.sale_type === "installment" ? "Paiement échelonné" : "Paiement intégral")}</p>
        <p>Mode de paiement : ${esc(inv.payment_method ? paymentLabel(inv.payment_method) : "—")}</p>
        <p>Traité par : ${esc(inv.employee_name)}</p>
      </div>
    </div>

    ${productRows ? `<table>
      <thead><tr><th>Référence</th><th>Désignation</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr></thead>
      <tbody>${productRows}</tbody>
    </table>` : ""}

    ${inv.weight_grams != null || inv.purchase_price_per_gram != null ? `<div class="totals">
      <table>
        <tr><td class="lbl">Poids (grammes)</td><td class="val">${esc(formatGrams(inv.weight_grams))}</td></tr>
        <tr><td class="lbl">Prix d'achat par gramme</td><td class="val">${esc(inv.purchase_price_per_gram != null ? `${formatDZD(inv.purchase_price_per_gram)}/g` : "—")}</td></tr>
        <tr><td class="lbl">Valeur or calculée</td><td class="val">${esc(inv.gold_value != null ? formatDZD(inv.gold_value) : "—")}</td></tr>
      </table>
    </div>` : ""}

    <div class="totals">
      <table>
        <tr><td class="lbl">Sous-total</td><td class="val">${esc(formatDZD(inv.total_amount + inv.discount))}</td></tr>
        ${inv.discount ? `<tr><td class="lbl">Remise</td><td class="val">- ${esc(formatDZD(inv.discount))}</td></tr>` : ""}
        <tr class="grand"><td>Montant total</td><td class="val">${esc(formatDZD(inv.total_amount))}</td></tr>
        ${isPayment ? `<tr><td class="lbl">Montant versé (ce reçu)</td><td class="val">${esc(formatDZD(inv.amount_this_tx))}</td></tr>` : `<tr><td class="lbl">Montant payé</td><td class="val">${esc(formatDZD(inv.amount_this_tx))}</td></tr>`}
        <tr><td class="lbl">Total déjà payé</td><td class="val">${esc(formatDZD(inv.total_paid))}</td></tr>
        <tr class="bal"><td>Reste à payer</td><td class="val">${esc(formatDZD(inv.balance))}</td></tr>
      </table>
    </div>

    ${inv.notes ? `<div class="notes">${esc(inv.notes)}</div>` : ""}

    ${s.thank_you_message ? `<div class="notes">${esc(s.thank_you_message)}</div>` : ""}

    <div class="sign">
      <div>${esc(s.signature_left || "Signature du client")}</div>
      <div>${esc(s.signature_right || "Cachet & signature du représentant")}</div>
    </div>

    ${s.terms ? `<div class="terms">${esc(s.terms)}</div>` : ""}

    <div class="foot">${esc(s.invoice_footer || `Merci de votre confiance — ${store.name}`)}${store.phone ? ` · ${esc(store.phone)}` : ""}</div>
  </div>
</body></html>`;
}


/** Open the invoice in a new window and trigger the print / save-as-PDF dialog. */
export function printInvoice(inv: InvoiceRecord): void {
  const html = buildInvoiceHtml(inv);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
