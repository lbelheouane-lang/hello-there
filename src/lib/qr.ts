import { qrToDataUrl } from "@/lib/qrcode-client";

/** Build the absolute URL that a product QR code points to. Scanning it opens
 *  the product details page directly in the app. */
export function productUrl(id: string): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/produit/${id}`;
  }
  return `/produit/${id}`;
}

/** Generate a PNG data-URL QR code that encodes the product details URL. */
export async function generateProductQr(id: string): Promise<string> {
  return qrToDataUrl(productUrl(id), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** Confidential payload embedded in admin labels (cost / supplier / origin…). */
export interface QrAdminPayload {
  id: string;
  sku?: string | null;
  /** Purchase (metal) cost */
  pc?: number | null;
  /** Labor cost */
  lc?: number | null;
  /** Supplier */
  sup?: string | null;
  /** Origin */
  org?: string | null;
  /** Inventory / entry date (ISO) */
  inv?: string | null;
}

/**
 * Generate the QR code for a product label.
 * - Non-admin: encodes only the public product URL.
 * - Admin: encodes a compact JSON object with the product URL plus confidential
 *   data (purchase cost, labor cost, supplier, origin, inventory date) so the
 *   sensitive details travel inside the QR and never on the visible label.
 * Uses a high error-correction level so the code stays scannable when printed
 * tiny on an ultra-compact jewelry tag.
 */
export async function generateLabelQr(
  payload: QrAdminPayload,
  isAdmin: boolean,
): Promise<string> {
  const data = isAdmin
    ? JSON.stringify({ u: productUrl(payload.id), ...payload })
    : productUrl(payload.id);
  return qrToDataUrl(data, {
    errorCorrectionLevel: isAdmin ? "Q" : "H",
    margin: 0,
    width: 320,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
