import { Recycle, Flame, Sparkles, CheckCircle2, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";
import { getStoreSettings } from "@/lib/store-settings";

/** Gold purities handled for scrap / pre-owned jewelry. */
export const SCRAP_KARATS = [24, 22, 21, 18, 14] as const;

export interface ScrapStatusDef {
  value: string;
  label: string;
  className: string;
  icon: LucideIcon;
}

/** Lifecycle statuses for a scrap-gold purchase. */
export const SCRAP_STATUSES: ScrapStatusDef[] = [
  { value: "en_stock", label: "En stock", className: "bg-amber-100 text-amber-800 hover:bg-amber-100", icon: Recycle },
  { value: "vendu", label: "Vendu", className: "bg-slate-200 text-slate-700 hover:bg-slate-200", icon: ShoppingCart },
  { value: "fondu", label: "Fondu", className: "bg-orange-100 text-orange-800 hover:bg-orange-100", icon: Flame },
  { value: "transforme", label: "Transformé en bijou", className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100", icon: Sparkles },
];

export function scrapStatusDef(value: string): ScrapStatusDef {
  return SCRAP_STATUSES.find((s) => s.value === value) ?? SCRAP_STATUSES[0];
}

export function scrapStatusLabel(value: string): string {
  return scrapStatusDef(value).label;
}

/** Human label for an audit-trail event type. */
const EVENT_LABELS: Record<string, string> = {
  created: "Création de l'achat",
  weight_modified: "Modification du poids",
  status_changed: "Changement de statut",
  sold: "Vente",
  melted: "Fonte",
  transformed: "Transformation en bijou",
};

export function scrapEventLabel(type: string): string {
  return EVENT_LABELS[type] ?? type;
}

export const SCRAP_EVENT_ICON: Record<string, LucideIcon> = {
  created: Recycle,
  weight_modified: Recycle,
  status_changed: CheckCircle2,
  sold: ShoppingCart,
  melted: Flame,
  transformed: Sparkles,
};

// ─────────────────────────────────────────────────────────────────────────────
// Purchase invoice (Bon d'achat d'or) — immutable, reprintable, PDF via print.
// ─────────────────────────────────────────────────────────────────────────────

export interface ScrapInvoiceData {
  reference: string;
  purchasedAt: string;
  customerName: string | null;
  weightGrams: number;
  goldKarat: number;
  pricePerGram: number;
  totalAmount: number;
  notes: string | null;
}

/** Stable invoice number permanently linked to the purchase reference. */
export function scrapInvoiceNumber(reference: string): string {
  return reference.replace(/^OC-/, "BA-");
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

/** Build a self-contained A4 HTML purchase invoice for a scrap-gold record. */
export function buildScrapInvoiceHtml(d: ScrapInvoiceData): string {
  const store = getStoreInfo();
  const s = getStoreSettings();
  const invoiceNo = scrapInvoiceNumber(d.reference);
  const contactLine = [store.phone, store.email].filter(Boolean).map(esc).join(" · ");
  const logoHtml = store.logo
    ? `<img class="logo-img" src="${esc(store.logo)}" alt="${esc(store.name)}" />`
    : `<div class="logo">${esc(store.name.charAt(0).toUpperCase() || "M")}</div>`;
  const dt = new Date(d.purchasedAt);
  const timeStr = dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>Bon d'achat ${esc(invoiceNo)}</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 13px; line-height: 1.5; }
  .sheet { max-width: 178mm; margin: 0 auto; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #c9a227; padding-bottom: 16px; margin-bottom: 24px; }
  .brand { display: flex; gap: 14px; align-items: center; }
  .logo { width: 56px; height: 56px; border-radius: 14px; background: linear-gradient(135deg,#c9a227,#8a6d10); color: #fff; display: flex; align-items: center; justify-content: center; font-family: Georgia, serif; font-size: 30px; font-weight: 700; }
  .logo-img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; }
  .store { font-family: Georgia, serif; font-size: 26px; font-weight: 700; color: #b8860b; }
  .sub { font-size: 11px; color: #666; text-transform: uppercase; letter-spacing: 1px; }
  .company { font-size: 11px; color: #555; margin-top: 6px; }
  .doc { text-align: right; }
  .doc h1 { font-size: 20px; margin: 0 0 6px; text-transform: uppercase; letter-spacing: 1px; }
  .doc .no { font-size: 15px; font-weight: 700; color: #b8860b; }
  .doc .meta { font-size: 11px; color: #555; margin-top: 4px; }
  .parties { display: flex; gap: 24px; margin-bottom: 18px; }
  .card { flex: 1; border: 1px solid #e6e1d5; border-radius: 12px; padding: 12px 14px; }
  .card h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .card p { margin: 2px 0; font-size: 12px; }
  .block { border: 1px solid #e6e1d5; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
  .block h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #eee; }
  .row .l { color: #666; }
  .total { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; padding: 10px 14px; border-radius: 12px; background: #fbf6e9; border: 1px solid #ecddb0; }
  .total .l { font-size: 12px; text-transform: uppercase; letter-spacing: 1px; color: #8a6d10; }
  .total .v { font-family: Georgia, serif; font-size: 22px; font-weight: 700; color: #b8860b; }
  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 56px; }
  .sign div { flex: 1; text-align: center; font-size: 11px; color: #555; border-top: 1px solid #999; padding-top: 6px; }
  .foot { text-align: center; font-size: 10px; color: #999; margin-top: 24px; border-top: 1px solid #eee; padding-top: 10px; }
</style></head><body><div class="sheet">
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
      <h1>Bon d'achat d'or</h1>
      <div class="no">N° ${esc(invoiceNo)}</div>
      <div class="meta">Réf. achat : ${esc(d.reference)}</div>
      <div class="meta">Date : ${esc(formatDate(d.purchasedAt))} · ${esc(timeStr)}</div>
    </div>
  </div>

  <div class="parties">
    <div class="card">
      <h3>Vendeur (client)</h3>
      <p><strong>${esc(d.customerName || "Client de passage")}</strong></p>
    </div>
    <div class="card">
      <h3>Acheteur</h3>
      <p><strong>${esc(store.name)}</strong></p>
      <p>${esc(store.address)}</p>
    </div>
  </div>

  <div class="block">
    <h3>Détail de l'achat</h3>
    <div class="row"><span class="l">Poids</span><span><strong>${esc(formatGrams(d.weightGrams))}</strong></span></div>
    <div class="row"><span class="l">Titre / Carat</span><span>${esc(d.goldKarat)}K</span></div>
    <div class="row"><span class="l">Prix d'achat / gramme</span><span>${esc(formatDZD(d.pricePerGram))}</span></div>
    <div class="total"><span class="l">Montant total d'achat</span><span class="v">${esc(formatDZD(d.totalAmount))}</span></div>
  </div>

  ${d.notes ? `<div class="block"><h3>Notes</h3><p>${esc(d.notes)}</p></div>` : ""}

  <div class="sign">
    <div>${esc(s.signature_left || "Signature du client")}</div>
    <div>${esc(s.signature_right || "Cachet & signature de la bijouterie")}</div>
  </div>

  <div class="foot">${esc(s.invoice_footer || `Merci de votre confiance — ${store.name}`)}${store.phone ? ` · ${esc(store.phone)}` : ""}</div>
</div></body></html>`;
}

/** Open the purchase invoice in a new window and trigger print / save-as-PDF. */
export function printScrapInvoice(d: ScrapInvoiceData): void {
  const html = buildScrapInvoiceHtml(d);
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 350);
}
