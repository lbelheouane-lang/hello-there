import { useEffect, useMemo, useState } from "react";
import { Printer, QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { METAL_TYPES, formatGrams } from "@/lib/format";
import { generateLabelQr, type QrAdminPayload } from "@/lib/qr";

export interface LabelProduct {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  metal_purchase_price: number;
  labor_cost: number;
  origin?: string | null;
  created_at?: string | null;
  supplier_name?: string | null;
}

type LabelSize = "compact" | "xs" | "legacy";

interface SizeSpec {
  w: string;
  h: string;
  label: string;
  /** QR side in mm */
  qr: number;
  /** font sizes (px) for sku / line / weight */
  sku: number;
  line: number;
  weight: number;
  pad: number;
  gap: number;
}

const SIZES: Record<LabelSize, SizeSpec> = {
  compact: { w: "30mm", h: "20mm", label: "Ultra-compacte (30 × 20 mm) — recommandée", qr: 15, sku: 6, line: 5, weight: 7, pad: 1, gap: 1 },
  xs: { w: "25mm", h: "15mm", label: "Extra-petite (25 × 15 mm)", qr: 12, sku: 5, line: 4, weight: 5.5, pad: 0.5, gap: 0.8 },
  legacy: { w: "50mm", h: "30mm", label: "Format hérité (50 × 30 mm)", qr: 24, sku: 9, line: 8, weight: 11, pad: 2, gap: 2 },
};

const SIZE_ORDER: LabelSize[] = ["compact", "xs", "legacy"];

function metalLabel(p: LabelProduct): string {
  if (p.metal_type === "or") return "Or";
  return METAL_TYPES.find((m) => m.value === p.metal_type)?.label ?? p.metal_type;
}

function purityLabel(p: LabelProduct): string {
  if (p.gold_karat) return `${p.gold_karat}K`;
  return "—";
}

function toPayload(p: LabelProduct): QrAdminPayload {
  return {
    id: p.id,
    sku: p.internal_code,
    pc: Number(p.metal_purchase_price) || 0,
    lc: Number(p.labor_cost) || 0,
    sup: p.supplier_name ?? null,
    org: p.origin ?? null,
    inv: p.created_at ?? null,
  };
}

function SingleLabel({
  product, qr, size,
}: {
  product: LabelProduct; qr: string | undefined; size: LabelSize;
}) {
  const s = SIZES[size];
  return (
    <div
      className="jewel-label flex items-center overflow-hidden rounded-[1mm] border border-foreground/30 bg-white text-black"
      style={{ width: s.w, height: s.h, padding: `${s.pad}mm`, gap: `${s.gap}mm` }}
    >
      {qr && (
        <img
          src={qr}
          alt={`QR ${product.internal_code}`}
          style={{ width: `${s.qr}mm`, height: `${s.qr}mm` }}
          className="shrink-0"
        />
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center leading-none">
        <p style={{ fontSize: `${s.sku}pt` }} className="truncate font-mono font-bold tracking-tight">
          {product.internal_code}
        </p>
        <p style={{ fontSize: `${s.line}pt`, marginTop: `${s.gap * 0.6}mm` }} className="truncate font-medium">
          {metalLabel(product)} · {purityLabel(product)}
        </p>
        <p style={{ fontSize: `${s.weight}pt`, marginTop: `${s.gap * 0.4}mm` }} className="font-bold">
          {formatGrams(Number(product.weight_grams))}
        </p>
      </div>
    </div>
  );
}

export function LabelDialog({
  products, onClose, isAdmin,
}: {
  products: LabelProduct[] | null;
  onClose: () => void;
  isAdmin: boolean;
}) {
  const [size, setSize] = useState<LabelSize>("compact");
  const [copies, setCopies] = useState("1");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const list = products ?? [];
  const ids = useMemo(() => list.map((p) => p.id).join(","), [list]);

  useEffect(() => {
    let active = true;
    if (list.length === 0) return;
    Promise.all(
      list.map(async (p) => [p.id, await generateLabelQr(toPayload(p), isAdmin)] as const),
    ).then((pairs) => {
      if (!active) return;
      setQrMap(Object.fromEntries(pairs));
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, version, isAdmin]);

  const copyCount = Math.max(1, Math.min(100, Number(copies) || 1));
  const rendered = useMemo(
    () => list.flatMap((p) => Array.from({ length: copyCount }, () => p)),
    [list, copyCount],
  );

  function print() {
    window.print();
  }

  const isBatch = list.length > 1;
  const preview = list[0];

  return (
    <Dialog open={list.length > 0} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isBatch ? `Étiquettes (${list.length} produits)` : "Étiquette produit"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Taille d'étiquette</Label>
            <Select value={size} onValueChange={(v) => setSize(v as LabelSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SIZE_ORDER.map((k) => (
                  <SelectItem key={k} value={k}>{SIZES[k].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Copies par produit</Label>
            <input
              type="number" min={1} max={100} value={copies}
              onChange={(e) => setCopies(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
            />
          </div>
        </div>

        {/* Size selector visual previews */}
        <div className="flex flex-wrap items-end gap-3">
          {SIZE_ORDER.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSize(k)}
              className={`flex flex-col items-center gap-1 rounded-md border p-2 transition ${
                size === k ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/40"
              }`}
            >
              <div
                className="rounded-[1px] border border-foreground/40 bg-white"
                style={{ width: SIZES[k].w, height: SIZES[k].h }}
              />
              <span className="text-[10px] text-muted-foreground">{SIZES[k].w} × {SIZES[k].h}</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Le QR encode les données confidentielles (coût d'achat, main-d'œuvre, fournisseur, origine, date d'entrée) — invisibles sur l'étiquette.
          </p>
        )}

        {/* Real-size print preview */}
        <div>
          <p className="mb-1.5 text-xs text-muted-foreground">Aperçu à l'échelle réelle</p>
          <div id="label-print-area" className="flex flex-wrap justify-center gap-3 rounded-lg bg-muted/40 p-4">
            {rendered.map((p, i) => (
              <SingleLabel
                key={`${p.id}-${i}`}
                product={p}
                qr={qrMap[p.id]}
                size={size}
              />
            ))}
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Optimisé pour l'imprimante SMART SP2120TU — marges minimales, densité élevée, sans rognage ni déformation du QR.
        </p>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setVersion((v) => v + 1)}>
            <RefreshCw className="mr-2 h-4 w-4" /> Régénérer le QR
          </Button>
          <Button onClick={print}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer {rendered.length > 1 ? `(${rendered.length})` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { QrCode };
