import { useEffect, useMemo, useState } from "react";
import { Printer, QrCode, RefreshCw } from "lucide-react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { METAL_TYPES, formatGrams, formatDZD } from "@/lib/format";
import { generateProductQr } from "@/lib/qr";

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

type LabelMode = "qr" | "full";
type LabelSize = "small" | "medium" | "large";

const SIZES: Record<LabelSize, { w: string; h: string; label: string }> = {
  small: { w: "50mm", h: "30mm", label: "Petite (50 × 30 mm)" },
  medium: { w: "60mm", h: "40mm", label: "Moyenne (60 × 40 mm)" },
  large: { w: "80mm", h: "50mm", label: "Grande (80 × 50 mm)" },
};

function metalLabel(p: LabelProduct): string {
  if (p.gold_karat) return `Or ${p.gold_karat}K`;
  return METAL_TYPES.find((m) => m.value === p.metal_type)?.label ?? p.metal_type;
}

function entryDate(p: LabelProduct): string {
  if (!p.created_at) return "—";
  return new Date(p.created_at).toLocaleDateString("fr-DZ");
}

function SingleLabel({
  product, qr, mode, size, isAdmin,
}: {
  product: LabelProduct; qr: string | undefined; mode: LabelMode; size: LabelSize; isAdmin: boolean;
}) {
  const dims = SIZES[size];
  return (
    <div
      className="jewel-label flex flex-col items-center justify-center overflow-hidden rounded-md border border-foreground/30 bg-white p-2 text-center text-black"
      style={{ width: dims.w, height: dims.h }}
    >
      {mode === "qr" ? (
        <>
          {qr && <img src={qr} alt={`QR ${product.internal_code}`} className="h-[70%] w-auto" />}
          <p className="mt-1 font-mono text-[8px] font-semibold tracking-wider">{product.internal_code}</p>
        </>
      ) : (
        <div className="flex h-full w-full items-stretch gap-2 text-left">
          <div className="flex shrink-0 flex-col items-center justify-center">
            {qr && <img src={qr} alt={`QR ${product.internal_code}`} className="h-12 w-12" />}
            <p className="mt-0.5 font-mono text-[7px] font-semibold">{product.internal_code}</p>
          </div>
          <div className="flex min-w-0 flex-col justify-center leading-tight">
            <p className="truncate text-[10px] font-bold">{product.name}</p>
            <p className="text-[8px]">{metalLabel(product)} · {formatGrams(Number(product.weight_grams))}</p>
            {product.supplier_name && <p className="truncate text-[7px]">Fourn.: {product.supplier_name}</p>}
            {product.origin && <p className="truncate text-[7px]">Origine: {product.origin}</p>}
            <p className="text-[7px]">Entrée: {entryDate(product)}</p>
            {isAdmin && (
              <p className="text-[7px] font-medium">
                Achat: {formatDZD(Number(product.metal_purchase_price))} · M.O.: {formatDZD(Number(product.labor_cost))}
              </p>
            )}
          </div>
        </div>
      )}
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
  const [mode, setMode] = useState<LabelMode>("full");
  const [size, setSize] = useState<LabelSize>("medium");
  const [copies, setCopies] = useState("1");
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [version, setVersion] = useState(0);

  const list = products ?? [];
  const ids = useMemo(() => list.map((p) => p.id).join(","), [list]);

  useEffect(() => {
    let active = true;
    if (list.length === 0) return;
    Promise.all(list.map(async (p) => [p.id, await generateProductQr(p.id)] as const)).then((pairs) => {
      if (!active) return;
      setQrMap(Object.fromEntries(pairs));
    });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, version]);

  const copyCount = Math.max(1, Math.min(100, Number(copies) || 1));
  const rendered = useMemo(
    () => list.flatMap((p) => Array.from({ length: copyCount }, () => p)),
    [list, copyCount],
  );

  function print() {
    window.print();
  }

  const isBatch = list.length > 1;

  return (
    <Dialog open={list.length > 0} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isBatch ? `Étiquettes (${list.length} produits)` : "Étiquette produit"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Contenu</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as LabelMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="qr">QR uniquement</SelectItem>
                <SelectItem value="full">QR + informations</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Taille</Label>
            <Select value={size} onValueChange={(v) => setSize(v as LabelSize)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SIZES) as LabelSize[]).map((k) => (
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

        <div id="label-print-area" className="flex flex-wrap justify-center gap-3 rounded-lg bg-muted/40 p-4">
          {rendered.map((p, i) => (
            <SingleLabel
              key={`${p.id}-${i}`}
              product={p}
              qr={qrMap[p.id]}
              mode={mode}
              size={size}
              isAdmin={isAdmin}
            />
          ))}
        </div>

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
