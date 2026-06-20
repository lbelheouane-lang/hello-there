import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Package, Pencil, Trash2, Tag, Search, Printer, ExternalLink,
  ChevronRight, LayoutGrid, AlertTriangle, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  formatGrams, statusLabel, metalValue, formatDZD,
} from "@/lib/format";
import { formatFromEUR } from "@/lib/currency";
import { useLatestGoldPrices, priceForKarat } from "@/hooks/use-gold-prices";
import { LabelDialog, type LabelProduct } from "@/components/LabelDialog";
import { productImage } from "@/lib/product-image";
import { categoryIcon } from "@/lib/category-meta";
import { useCategories, useCategoryNames, useSubcategories } from "@/hooks/use-categories";

export const Route = createFileRoute("/_authenticated/stock")({
  component: StockPage,
});

const LOW_STOCK_THRESHOLD = 3;

interface Product {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  subcategory: string | null;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  metal_purchase_price: number;
  labor_cost: number;
  supplier_id: string | null;
  origin: string | null;
  created_at: string;
  status: string;
  is_demo: boolean;
}

const empty: Record<string, string> = {
  name: "", category: CATEGORIES[0], subcategory: "", metal_type: "or", gold_karat: "21",
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
  const categoryNames = useCategoryNames();
  const { data: subcategories } = useSubcategories();
  const { data: prices } = useLatestGoldPrices();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(empty);
  const [search, setSearch] = useState("");
  const [labelProducts, setLabelProducts] = useState<LabelProduct[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Filters
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [subFilter, setSubFilter] = useState<string | null>(null);
  const [metalFilter, setMetalFilter] = useState("all");
  const [karatFilter, setKaratFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [minWeight, setMinWeight] = useState("");
  const [maxWeight, setMaxWeight] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const { data: categories } = useCategories();

  // Map category name -> list of its subcategory names
  const subsByCatName = useMemo(() => {
    const idToName = new Map<string, string>();
    (categories ?? []).forEach((c) => idToName.set(c.id, c.name));
    const m = new Map<string, string[]>();
    (subcategories ?? []).forEach((s) => {
      const name = idToName.get(s.category_id);
      if (!name) return;
      const arr = m.get(name) ?? [];
      arr.push(s.name);
      m.set(name, arr);
    });
    return m;
  }, [subcategories, categories]);
  const subsForCat = (name: string): string[] => subsByCatName.get(name) ?? [];

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

  // Per-category statistics (count, weight, value, low-stock)
  const stats = useMemo(() => {
    const ppg = (p: Product) => (p.metal_type === "or" ? priceForKarat(prices, p.gold_karat) : null);
    const inStock = (products ?? []).filter((p) => p.status === "en_stock");
    const byCat = new Map<string, { count: number; weight: number; value: number }>();
    for (const p of inStock) {
      const e = byCat.get(p.category) ?? { count: 0, weight: 0, value: 0 };
      e.count += 1;
      e.weight += Number(p.weight_grams) || 0;
      e.value += metalValue(Number(p.weight_grams), ppg(p));
      byCat.set(p.category, e);
    }
    return byCat;
  }, [products, prices]);

  const filtered = useMemo(() => {
    if (!products) return [];
    const q = search.toLowerCase().trim();
    const min = minWeight ? Number(minWeight) : null;
    const max = maxWeight ? Number(maxWeight) : null;
    return products.filter((p) => {
      if (catFilter && p.category !== catFilter) return false;
      if (subFilter && p.subcategory !== subFilter) return false;
      if (metalFilter !== "all" && p.metal_type !== metalFilter) return false;
      if (karatFilter !== "all" && String(p.gold_karat ?? "") !== karatFilter) return false;
      if (supplierFilter !== "all" && p.supplier_id !== supplierFilter) return false;
      if (min != null && Number(p.weight_grams) < min) return false;
      if (max != null && Number(p.weight_grams) > max) return false;
      if (q && !(
        p.name.toLowerCase().includes(q) ||
        p.internal_code.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.subcategory ?? "").toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [products, search, catFilter, subFilter, metalFilter, karatFilter, supplierFilter, minWeight, maxWeight]);

  const activeFilters =
    (catFilter ? 1 : 0) + (subFilter ? 1 : 0) +
    (metalFilter !== "all" ? 1 : 0) + (karatFilter !== "all" ? 1 : 0) +
    (supplierFilter !== "all" ? 1 : 0) + (minWeight ? 1 : 0) + (maxWeight ? 1 : 0);

  function clearFilters() {
    setCatFilter(null); setSubFilter(null); setMetalFilter("all");
    setKaratFilter("all"); setSupplierFilter("all"); setMinWeight(""); setMaxWeight("");
  }

  // Subcategories available for the form's selected category
  const formSubs = useMemo(() => {
    const cat = (subcategories ?? []).map((s) => s).filter(Boolean);
    return cat;
  }, [subcategories]);

  function openNew() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, category: p.category, subcategory: p.subcategory ?? "", metal_type: p.metal_type,
      gold_karat: p.gold_karat ? String(p.gold_karat) : "",
      weight_grams: String(p.weight_grams), metal_purchase_price: String(p.metal_purchase_price),
      labor_cost: String(p.labor_cost), supplier_id: p.supplier_id ?? "",
      origin: p.origin ?? "", status: p.status,
    });
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Le nom du bijou est obligatoire.");
      if (!form.category) throw new Error("La catégorie est obligatoire.");
      const payload = {
        name: form.name.trim(),
        category: form.category,
        subcategory: form.subcategory || null,
        metal_type: form.metal_type,
        gold_karat: form.metal_type === "or" && form.gold_karat ? Number(form.gold_karat) : null,
        weight_grams: Number(form.weight_grams) || 0,
        metal_purchase_price: Number(form.metal_purchase_price) || 0,
        labor_cost: Number(form.labor_cost) || 0,
        supplier_id: form.supplier_id || null,
        origin: form.origin.trim() || null,
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
      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Category panel */}
        <aside className="space-y-1.5">
          <button
            onClick={() => { setCatFilter(null); setSubFilter(null); }}
            className={cn(
              "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors",
              !catFilter ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <span className="flex items-center gap-2"><LayoutGrid className="h-4 w-4" /> Toutes les catégories</span>
            <Badge variant="secondary">{products?.filter((p) => p.status === "en_stock").length ?? 0}</Badge>
          </button>

          {categoryNames.map((cat) => {
            const Icon = categoryIcon(cat);
            const st = stats.get(cat);
            const subs = subcatNames(subcategories, cat);
            const isOpen = expanded.has(cat);
            const low = st && st.count > 0 && st.count <= LOW_STOCK_THRESHOLD;
            return (
              <Collapsible key={cat} open={isOpen} onOpenChange={(o) => {
                setExpanded((prev) => { const n = new Set(prev); o ? n.add(cat) : n.delete(cat); return n; });
              }}>
                <div className={cn(
                  "flex items-center rounded-lg border transition-colors",
                  catFilter === cat ? "border-primary bg-primary/10" : "hover:bg-muted",
                )}>
                  <button
                    onClick={() => { setCatFilter(cat); setSubFilter(null); }}
                    className="flex flex-1 items-center gap-2 px-3 py-2.5 text-sm"
                  >
                    <Icon className={cn("h-4 w-4", catFilter === cat ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate">{cat}</span>
                    {low && <AlertTriangle className="h-3.5 w-3.5 text-destructive" title="Stock faible" />}
                  </button>
                  <Badge variant="secondary" className="mr-1">{st?.count ?? 0}</Badge>
                  {subs.length > 0 && (
                    <CollapsibleTrigger className="px-2 py-2.5 text-muted-foreground">
                      <ChevronRight className={cn("h-4 w-4 transition-transform", isOpen && "rotate-90")} />
                    </CollapsibleTrigger>
                  )}
                </div>
                {subs.length > 0 && (
                  <CollapsibleContent className="ml-4 mt-1 space-y-1 border-l pl-2">
                    {subs.map((sub) => {
                      const cnt = products?.filter((p) => p.status === "en_stock" && p.category === cat && p.subcategory === sub).length ?? 0;
                      return (
                        <button
                          key={sub}
                          onClick={() => { setCatFilter(cat); setSubFilter(sub); }}
                          className={cn(
                            "flex w-full items-center justify-between rounded-md px-3 py-1.5 text-xs transition-colors",
                            subFilter === sub ? "bg-primary/10 text-primary" : "hover:bg-muted",
                          )}
                        >
                          <span className="truncate">{sub}</span>
                          <Badge variant="outline" className="text-[10px]">{cnt}</Badge>
                        </button>
                      );
                    })}
                  </CollapsibleContent>
                )}
              </Collapsible>
            );
          })}
        </aside>

        {/* Main content */}
        <div className="min-w-0 space-y-4">
          {/* Stats for current category selection */}
          {catFilter && stats.get(catFilter) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Articles en stock</p>
                <p className="text-2xl font-semibold">{stats.get(catFilter)!.count}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Poids total</p>
                <p className="text-2xl font-semibold">{formatGrams(stats.get(catFilter)!.weight)}</p>
              </CardContent></Card>
              <Card><CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Valeur métal</p>
                <p className="text-2xl font-semibold">{formatFromEUR(stats.get(catFilter)!.value, "DZD")}</p>
              </CardContent></Card>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
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
                      <Label>Catégorie *</Label>
                      <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v, subcategory: "" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Sous-catégorie</Label>
                      <Select
                        value={form.subcategory || "none"}
                        onValueChange={(v) => setForm({ ...form, subcategory: v === "none" ? "" : v })}
                        disabled={subcatNames(subcategories, form.category).length === 0}
                      >
                        <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Aucune</SelectItem>
                          {subcatNames(subcategories, form.category).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type de métal</Label>
                      <Select value={form.metal_type} onValueChange={(v) => setForm({ ...form, metal_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {METAL_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
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
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Poids (grammes)</Label>
                      <Input type="number" min={0} step="0.001" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Prix d'achat du métal (DZD)</Label>
                      <Input type="number" min={0} step="0.01" value={form.metal_purchase_price} onChange={(e) => setForm({ ...form, metal_purchase_price: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Coût main-d'œuvre (DZD)</Label>
                      <Input type="number" min={0} step="0.01" value={form.labor_cost} onChange={(e) => setForm({ ...form, labor_cost: e.target.value })} />
                    </div>
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
                  <div className="space-y-2">
                    <Label>Origine du produit</Label>
                    <Input
                      placeholder="Ex. Italie, Dubaï, fabrication locale…"
                      value={form.origin}
                      onChange={(e) => setForm({ ...form, origin: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Filter bar */}
          <Card>
            <CardContent className="flex flex-wrap items-end gap-3 p-3">
              <div className="space-y-1">
                <Label className="text-xs">Métal</Label>
                <Select value={metalFilter} onValueChange={setMetalFilter}>
                  <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {METAL_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Titre</Label>
                <Select value={karatFilter} onValueChange={setKaratFilter}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {KARATS.map((k) => <SelectItem key={k} value={String(k)}>{k}K</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fournisseur</Label>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poids min (g)</Label>
                <Input type="number" min={0} step="0.001" className="h-9 w-24" value={minWeight} onChange={(e) => setMinWeight(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Poids max (g)</Label>
                <Input type="number" min={0} step="0.001" className="h-9 w-24" value={maxWeight} onChange={(e) => setMaxWeight(e.target.value)} />
              </div>
              {activeFilters > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="mr-1 h-4 w-4" /> Réinitialiser ({activeFilters})
                </Button>
              )}
            </CardContent>
          </Card>

          {selected.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
              <span className="text-sm font-medium">{selected.size} produit(s) sélectionné(s)</span>
              <Button size="sm" onClick={batchPrint}>
                <Printer className="mr-2 h-4 w-4" /> Imprimer les étiquettes en lot
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Désélectionner
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                        onCheckedChange={(c) =>
                          setSelected(c ? new Set(filtered.map((p) => p.id)) : new Set())
                        }
                        aria-label="Tout sélectionner"
                      />
                    </TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Bijou</TableHead>
                    <TableHead>Titre</TableHead>
                    <TableHead>Poids</TableHead>
                    <TableHead>Valeur métal (DZD)</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const ppg = p.metal_type === "or" ? priceForKarat(prices, p.gold_karat) : null;
                    const value = metalValue(Number(p.weight_grams), ppg);
                    return (
                      <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(p.id)}
                            onCheckedChange={() => toggleSelect(p.id)}
                            aria-label={`Sélectionner ${p.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.internal_code}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={productImage(p.category)}
                              alt={p.name}
                              loading="lazy"
                              className="h-10 w-10 shrink-0 rounded-md object-cover"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.name}</span>
                                {p.is_demo && <Badge variant="secondary" className="text-[10px]">Démo</Badge>}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {p.category}{p.subcategory ? ` · ${p.subcategory}` : ""}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{p.gold_karat ? `${p.gold_karat}K` : METAL_TYPES.find((m) => m.value === p.metal_type)?.label}</TableCell>
                        <TableCell>{formatGrams(Number(p.weight_grams))}</TableCell>
                        <TableCell>
                          {ppg ? (
                            <div className="font-medium">{formatFromEUR(value, "DZD")}</div>
                          ) : (
                            <span className="text-muted-foreground">cours manquant</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={statusVariant(p.status)}>{statusLabel(p.status)}</Badge></TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" title="Étiquette & QR" onClick={() => setLabelProducts([toLabel(p)])}>
                            <Tag className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Ouvrir la fiche" asChild>
                            <Link to="/produit/$id" params={{ id: p.id }}>
                              <ExternalLink className="h-4 w-4" />
                            </Link>
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
                      <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                        <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        Aucun bijou ne correspond.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>

      <LabelDialog products={labelProducts} onClose={() => setLabelProducts(null)} isAdmin />
    </AppShell>
  );
}
