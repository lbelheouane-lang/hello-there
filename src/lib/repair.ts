import QRCode from "qrcode";
import { printHtml } from "@/lib/print";
import { formatDZD, formatDate, formatDateTime } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";
import { getStoreSettings } from "@/lib/store-settings";

export interface RepairStatusDef {
  value: string;
  label: string;
  /** Hex color used for badges and print. */
  color: string;
  /** Tailwind classes for in-app badge. */
  className: string;
  /** Ordering for progress timeline. Cancelled is special (-1). */
  order: number;
}

export const REPAIR_STATUSES: RepairStatusDef[] = [
  { value: "received", label: "Reçu", color: "#6b7280", className: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200", order: 0 },
  { value: "inspection", label: "En inspection", color: "#7c3aed", className: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200", order: 1 },
  { value: "waiting_parts", label: "En attente de pièces", color: "#b45309", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200", order: 2 },
  { value: "in_progress", label: "Réparation en cours", color: "#2563eb", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200", order: 3 },
  { value: "ready", label: "Prêt à récupérer", color: "#15803d", className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-200", order: 4 },
  { value: "completed", label: "Terminé", color: "#0f766e", className: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-200", order: 5 },
  { value: "delivered", label: "Remis au client", color: "#334155", className: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-100", order: 6 },
  { value: "cancelled", label: "Annulé", color: "#b91c1c", className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200", order: -1 },
];

export const REPAIR_FLOW = REPAIR_STATUSES.filter((s) => s.order >= 0).sort((a, b) => a.order - b.order);

export function repairStatusDef(value: string): RepairStatusDef {
  return REPAIR_STATUSES.find((s) => s.value === value) ?? REPAIR_STATUSES[0];
}

export function repairStatusLabel(value: string): string {
  return repairStatusDef(value).label;
}

export const JEWELRY_TYPES = [
  "Bague",
  "Collier",
  "Bracelet",
  "Boucles d'oreilles",
  "Pendentif",
  "Chaîne",
  "Alliance",
  "Montre",
  "Broche",
  "Autre",
] as const;

export const PURITY_OPTIONS = ["24K", "22K", "21K", "18K", "14K", "925 (argent)", "950 (platine)", "Autre"] as const;

export function trackingUrl(token: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/suivi/${token}`;
}

export async function generateQrDataUrl(text: string): Promise<string> {
  return QRCode.toDataURL(text, { margin: 1, width: 240, errorCorrectionLevel: "M" });
}

export interface RepairReceiptData {
  reference: string;
  trackingToken: string;
  qrDataUrl: string;
  customerName: string;
  customerPhone: string | null;
  intakeAt: string;
  jewelryType: string;
  metalType: string | null;
  purity: string | null;
  weightGrams: number | null;
  jewelryDescription: string | null;
  repairDescription: string;
  estimatedCompletion: string | null;
  estimatedCost: number | null;
}

function esc(v: string | number | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

/** Build a self-contained A4 HTML repair receipt with QR tracking code. */
export function buildRepairReceiptHtml(d: RepairReceiptData): string {
  const store = getStoreInfo();
  const s = getStoreSettings();
  const contactLine = [store.phone, store.email].filter(Boolean).map(esc).join(" · ");
  const logoHtml = store.logo
    ? `<img class="logo-img" src="${esc(store.logo)}" alt="${esc(store.name)}" />`
    : `<div class="logo">${esc(store.name.charAt(0).toUpperCase() || "M")}</div>`;
  const metalLine = [d.metalType, d.purity, d.weightGrams != null ? `${d.weightGrams} g` : null]
    .filter(Boolean)
    .map(esc)
    .join(" · ");

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>Bon de réparation ${esc(d.reference)}</title>
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
  .qr { text-align: center; border: 1px solid #e6e1d5; border-radius: 12px; padding: 10px; width: 168px; }
  .qr img { width: 130px; height: 130px; }
  .qr p { margin: 6px 0 0; font-size: 9px; color: #777; }
  .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; border-bottom: 1px dashed #eee; }
  .row .l { color: #666; }
  .block { border: 1px solid #e6e1d5; border-radius: 12px; padding: 12px 14px; margin-bottom: 14px; }
  .block h3 { margin: 0 0 6px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #b8860b; }
  .sign { display: flex; justify-content: space-between; gap: 40px; margin-top: 48px; }
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
      <h1>Bon de réparation</h1>
      <div class="no">N° ${esc(d.reference)}</div>
      <div class="meta">Déposé le : ${esc(formatDateTime(d.intakeAt))}</div>
      ${d.estimatedCompletion ? `<div class="meta">Fin estimée : ${esc(formatDate(d.estimatedCompletion))}</div>` : ""}
    </div>
  </div>

  <div class="parties">
    <div class="card">
      <h3>Client</h3>
      <p><strong>${esc(d.customerName)}</strong></p>
      <p>${esc(d.customerPhone)}</p>
    </div>
    <div class="qr">
      <img src="${esc(d.qrDataUrl)}" alt="QR suivi" />
      <p>Scannez pour suivre l'état de votre réparation en temps réel</p>
    </div>
  </div>

  <div class="block">
    <h3>Bijou confié</h3>
    <div class="row"><span class="l">Type</span><span>${esc(d.jewelryType)}</span></div>
    ${metalLine ? `<div class="row"><span class="l">Métal / titre</span><span>${metalLine}</span></div>` : ""}
    ${d.jewelryDescription ? `<div class="row"><span class="l">Description</span><span>${esc(d.jewelryDescription)}</span></div>` : ""}
  </div>

  <div class="block">
    <h3>Réparation demandée</h3>
    <p>${esc(d.repairDescription)}</p>
    ${d.estimatedCost != null ? `<div class="row" style="margin-top:8px;"><span class="l">Coût estimé</span><span><strong>${esc(formatDZD(d.estimatedCost))}</strong></span></div>` : ""}
  </div>

  <div class="sign">
    <div>${esc(s.signature_left || "Signature du client")}</div>
    <div>${esc(s.signature_right || "Cachet & signature du représentant")}</div>
  </div>

  <div class="foot">${esc(s.invoice_footer || `Merci de votre confiance — ${store.name}`)}${store.phone ? ` · ${esc(store.phone)}` : ""}</div>
</div></body></html>`;
}

/** Open the repair receipt in a new window and trigger print / save-as-PDF. */
export function printRepairReceipt(d: RepairReceiptData): void {
  printHtml(buildRepairReceiptHtml(d));
}
