/**
 * Parse the raw text decoded from a scanned QR code or USB barcode scanner.
 *
 * Supported payloads (in priority order):
 *  - Admin label JSON: `{"u":"…/produit/<id>", "id":"<id>", "sku":"…"}`
 *  - Product URL: `https://…/produit/<id>`
 *  - Set URL: `https://…/parures?set=<id>` or `…/parures/<id>`
 *  - Raw UUID (treated as a product id)
 *  - Anything else: treated as an SKU / internal code
 */
export interface ScannedCode {
  productId: string | null;
  setId: string | null;
  sku: string | null;
  raw: string;
}

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function parseScannedCode(input: string): ScannedCode {
  const raw = input.trim();
  const result: ScannedCode = { productId: null, setId: null, sku: null, raw };
  if (!raw) return result;

  // 1) Admin label JSON payload
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw) as { u?: string; id?: string; sku?: string };
      if (obj.id) result.productId = obj.id;
      if (obj.sku) result.sku = obj.sku;
      if (!result.productId && obj.u) {
        const m = obj.u.match(/\/produit\/([^/?#]+)/);
        if (m) result.productId = decodeURIComponent(m[1]);
      }
      if (result.productId || result.sku) return result;
    } catch {
      /* fall through */
    }
  }

  // 2) Product URL
  const prod = raw.match(/\/produit\/([^/?#]+)/);
  if (prod) {
    result.productId = decodeURIComponent(prod[1]);
    return result;
  }

  // 3) Set URL (query param or path)
  const setQuery = raw.match(/[?&]set=([^&#]+)/);
  if (setQuery) {
    result.setId = decodeURIComponent(setQuery[1]);
    return result;
  }
  const setPath = raw.match(/\/parures\/([^/?#]+)/);
  if (setPath) {
    result.setId = decodeURIComponent(setPath[1]);
    return result;
  }

  // 4) Bare UUID → product id
  const uuid = raw.match(UUID_RE);
  if (uuid && uuid[0] === raw) {
    result.productId = raw;
    return result;
  }

  // 5) Fallback: treat as SKU / internal code
  result.sku = raw;
  return result;
}
