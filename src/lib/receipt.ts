import { formatDZD, formatDateTime, paymentLabel } from "@/lib/format";
import { getStoreInfo } from "@/lib/invoice";
import { getStoreSettings } from "@/lib/store-settings";

export interface ReceiptData {
  storeName: string;
  receiptNumber: string;
  customerName: string;
  customerPhone: string | null;
  invoiceNumber: string;
  paidAt: string;
  paymentMethod: string;
  amount: number;
  totalAmount: number;
  totalPaid: number;
  balance: number;
  employeeName: string;
  notes?: string | null;
}

function esc(v: string | null | undefined): string {
  return String(v ?? "—").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] as string));
}

function row(label: string, value: string, strong = false): string {
  return `<div class="r"><span class="l">${esc(label)}</span><span class="v${strong ? " strong" : ""}">${esc(value)}</span></div>`;
}

/** Build a self-contained HTML document for a payment voucher. */
export function buildReceiptHtml(d: ReceiptData): string {
  const store = getStoreInfo();
  const s = getStoreSettings();
  const name = store.name || d.storeName;
  const logoHtml = store.logo
    ? `<img class="logo-img" src="${esc(store.logo)}" alt="${esc(name)}" />`
    : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8" />
<title>Reçu ${esc(d.receiptNumber)}</title>
<style>
  @page { margin: 8mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Outfit', Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 16px; max-width: 80mm; margin-inline: auto; }
  .head { text-align: center; border-bottom: 2px solid #c9a227; padding-bottom: 10px; margin-bottom: 12px; }
  .store { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #b8860b; letter-spacing: .5px; }
  .sub { font-size: 11px; color: #666; margin-top: 2px; text-transform: uppercase; letter-spacing: 1px; }
  .title { text-align: center; font-size: 14px; font-weight: 700; margin: 8px 0 12px; }
  .r { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; padding: 3px 0; }
  .l { color: #666; }
  .v { font-weight: 600; text-align: right; }
  .strong { color: #b8860b; font-size: 14px; }
  .sep { border-top: 1px dashed #bbb; margin: 10px 0; }
  .sign { display: flex; justify-content: space-between; gap: 16px; margin-top: 36px; }
  .sign div { flex: 1; text-align: center; font-size: 10px; color: #666; border-top: 1px solid #999; padding-top: 4px; }
  .foot { text-align: center; font-size: 10px; color: #999; margin-top: 16px; }
</style></head><body>
  <div class="head">
    ${logoHtml}
    <div class="store">${esc(name)}</div>
    <div class="sub">${esc(store.tagline || "Bijouterie · Or & Joaillerie")}</div>
  </div>
  <div class="title">REÇU DE PAIEMENT — VERSEMENT</div>

  ${row("Reçu n°", d.receiptNumber)}
  ${row("Date & heure", formatDateTime(d.paidAt))}
  ${row("Facture n°", d.invoiceNumber)}
  <div class="sep"></div>
  ${row("Client", d.customerName)}
  ${row("Téléphone", d.customerPhone ?? "—")}
  <div class="sep"></div>
  ${row("Montant versé", formatDZD(d.amount), true)}
  ${row("Mode de paiement", paymentLabel(d.paymentMethod))}
  <div class="sep"></div>
  ${row("Montant total facture", formatDZD(d.totalAmount))}
  ${row("Total déjà payé", formatDZD(d.totalPaid))}
  ${row("Reste à payer", formatDZD(d.balance), true)}
  ${d.notes ? `<div class="sep"></div>${row("Notes", d.notes)}` : ""}
  <div class="sep"></div>
  ${row("Encaissé par", d.employeeName)}
  <div class="sign">
    <div>Signature client</div>
    <div>Cachet & signature</div>
  </div>
  <div class="foot">Merci de votre confiance — ${esc(d.storeName)}</div>
</body></html>`;
}

/** Open the receipt in a new window and trigger the print dialog (supports PDF & thermal). */
export function printReceipt(d: ReceiptData): void {
  const html = buildReceiptHtml(d);
  const w = window.open("", "_blank", "width=420,height=640");
  if (!w) return;
  w.document.open();
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 300);
}
