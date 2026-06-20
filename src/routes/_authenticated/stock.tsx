import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Package, Pencil, Trash2, Tag, Search, Printer, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  KARATS, CATEGORIES, METAL_TYPES, PRODUCT_STATUSES,
  formatGrams, statusLabel, metalValue,
} from "@/lib/format";
import { formatUSD, formatFromUSD } from "@/lib/currency";
import { useLatestGoldPrices, priceForKarat } from "@/hooks/use-gold-prices";
import { LabelDialog, type LabelProduct } from "@/components/LabelDialog";

export const Route = createFileRoute("/_authenticated/stock")({
  component: StockPage,
});

interface Product {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  metal_purchase_price: number;
  labor_cost: number;
  supplier_id: string | null;
  origin: string | null;
  created_at: string;
  status: string;
}

const empty: Record<string, string> = {
  name: "", category: CATEGORIES[0], metal_type: "or", gold_karat: "21",
  weight_grams: "", metal_purchase_price: "", labor_cost: "", supplier_id: "",
  origin: "", status: "en_stock",
};

function statusVariant(s: string): "default" | "secondary" | "destructive" {
  if (s === "vendu") return "secondary";
  if (s === "en_reparation") return "destructive";
  return "default";
}

function StockPage() {
  const qc = useQueryClient();
  const { data: prices } = useLatestGoldPrices();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [labelProducts, setLabelProducts] = useState<LabelProduct[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id, name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const supplierName = useMemo(() => {
    const m = new Map<string, string>();
    suppliers?.forEach((s) => m.set(s.id, s.name));
    return (id: string | null) => (id ? m.get(id) ?? null : null);
  }, [suppliers]);

  function toLabel(p: Product): LabelProduct {
    return { ...p, supplier_name: supplierName(p.supplier_id) };
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function batchPrint() {
    const items = (products ?? []).filter((p) => selected.has(p.id)).map(toLabel);
    if (items.length === 0) {
      toast.error("Sélectionnez au moins un produit.");
      return;
    }
    setLabelProducts(items);
  }


  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.internal_code.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [products, search]);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, category: p.category, metal_type: p.metal_type,
      gold_karat: p.gold_karat ? String(p.gold_karat) : "",
      weight_grams: String(p.weight_grams), metal_purchase_price: String(p.metal_purchase_price),
      labor_cost: String(p.labor_cost), supplier_id: p.supplier_id ?? "", status: p.status,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Le nom du bijou est obligatoire.");
      const payload = {
        name: form.name.trim(),
        category: form.category,
        metal_type: form.metal_type,
        gold_karat: form.metal_type === "or" && form.gold_karat ? Number(form.gold_karat) : null,
        weight_grams: Number(form.weight_grams) || 0,
        metal_purchase_price: Number(form.metal_purchase_price) || 0,
        labor_cost: Number(form.labor_cost) || 0,
        supplier_id: form.supplier_id || null,
        status: form.status,
      };
      if (editing) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const code = `BJ-${Date.now().toString(36).toUpperCase().slice(-6)}`;
        const { data: inserted, error } = await supabase
          .from("products")
          .insert({ ...payload, internal_code: code, created_by: u.user?.id })
          .select("id")
          .single();
        if (error) throw error;
        await supabase.from("stock_movements").insert({
          product_id: inserted.id, movement_type: "entree", notes: "Création produit", created_by: u.user?.id,
        });
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Produit mis à jour" : "Produit ajouté au stock");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit supprimé");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Stock" allow={["admin"]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Rechercher un bijou…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}>
              <Plus className="mr-2 h-4 w-4" /> Nouveau bijou
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Modifier le bijou" : "Nouveau bijou"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom du bijou *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Catégorie</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type de métal</Label>
                  <Select value={form.metal_type} onValueChange={(v) => setForm({ ...form, metal_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {METAL_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {form.metal_type === "or" && (
                  <div className="space-y-2">
                    <Label>Titre de l'or</Label>
                    <Select value={form.gold_karat} onValueChange={(v) => setForm({ ...form, gold_karat: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {KARATS.map((k) => <SelectItem key={k} value={String(k)}>{k}K</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Poids (grammes)</Label>
                  <Input type="number" min={0} step="0.001" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Prix d'achat du métal (DZD)</Label>
                  <Input type="number" min={0} step="0.01" value={form.metal_purchase_price} onChange={(e) => setForm({ ...form, metal_purchase_price: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Coût main-d'œuvre (DZD)</Label>
                  <Input type="number" min={0} step="0.01" value={form.labor_cost} onChange={(e) => setForm({ ...form, labor_cost: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Fournisseur</Label>
                  <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun</SelectItem>
                      {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRODUCT_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Bijou</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Poids</TableHead>
                <TableHead>Valeur métal (USD)</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const ppg = p.metal_type === "or" ? priceForKarat(prices, p.gold_karat) : null;
                const value = metalValue(Number(p.weight_grams), ppg);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.internal_code}</TableCell>
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.category}</div>
                    </TableCell>
                    <TableCell>{p.gold_karat ? `${p.gold_karat}K` : METAL_TYPES.find((m) => m.value === p.metal_type)?.label}</TableCell>
                    <TableCell>{formatGrams(Number(p.weight_grams))}</TableCell>
                    <TableCell>
                      {ppg ? (
                        <div>
                          <div>{formatUSD(value)}</div>
                          <div className="text-xs text-muted-foreground">≈ {formatFromUSD(value, "DZD")}</div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">cours manquant</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Étiquette" onClick={() => setLabelProduct(p)}>
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Aucun bijou en stock.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <LabelDialog product={labelProduct} onClose={() => setLabelProduct(null)} />
    </AppShell>
  );
}

function LabelDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  function print() {
    window.print();
  }
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Étiquette produit</DialogTitle>
        </DialogHeader>
        {product && (
          <div id="label-print" className="mx-auto w-64 rounded-lg border-2 border-dashed border-border p-4 text-center">
            <p className="font-serif text-lg font-semibold">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              {product.gold_karat ? `Or ${product.gold_karat}K` : METAL_TYPES.find((m) => m.value === product.metal_type)?.label}
              {" · "}{formatGrams(Number(product.weight_grams))}
            </p>
            <div className="my-3 flex justify-center">
              <img
                alt={`QR ${product.internal_code}`}
                className="h-28 w-28"
                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(product.internal_code)}`}
              />
            </div>
            <p className="font-mono text-sm font-semibold tracking-wider">{product.internal_code}</p>
          </div>
        )}
        <DialogFooter>
          <Button onClick={print}>
            <Printer className="mr-2 h-4 w-4" /> Imprimer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
