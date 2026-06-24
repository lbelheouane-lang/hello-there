type QrOptions = {
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
  margin?: number;
  width?: number;
  color?: { dark?: string; light?: string };
};

export async function qrToDataUrl(text: string, options: QrOptions = {}): Promise<string> {
  const QRCode = (await import("qrcode")).default;
  return QRCode.toDataURL(text, options);
}