import QRCode from "qrcode";

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
  return QRCode.toDataURL(productUrl(id), {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
    color: { dark: "#000000", light: "#ffffff" },
  });
}
