import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Layers, Tag, Trash2, ChevronDown, ChevronRight, History, Package, ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
  KARATS, METAL_TYPES, formatGrams, statusLabel,
} from "@/lib/format";
import { formatDZD, formatDateTime } from "@/lib/format";
import { useCategoryNames } from "@/hooks/use-categories";
import { LabelDialog, type LabelProduct } from "@/components/LabelDialog";

export const Route = createFileRoute("/_authenticated/parures")({
  component: ParuresPage,
});

interface SetItem {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  selling_price: number;
  status: string;
  set_id: string | null;
  supplier_id: string | null;
  metal_purchase_price: number;
  labor_cost: number;
  origin: string | null;
  created_at: string;
  is_demo: boolean;
}

interface JewelrySet {
  id: string;
  reference: string;
  name: string;
  notes: string | null;
  created_at: string;
}

interface SetEvent {
  id: string;
  set_id: string | null;
  product_id: string | null;
  event_type: string;
  detail: string | null;
  created_at: string;
}

type SetStatus = "complete" | "partial" | "sold";

function setStatusOf(items: SetItem[]): SetStatus {
  if (items.length === 0) return "complete";
  const sold = items.filter((i) => i.status === "vendu").length;
  if (sold === 0) return "complete";
  if (sold === items.length) return "sold";
  return "partial";
}

const STATUS_META: Record<SetStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  complete: { label: "Parure complète", variant: "default" },
  partial: { label: "Partiellement vendue", variant: "destructive" },
  sold: { label: "Entièrement vendue", variant: "secondary" },
};

interface ItemDraft {
  name: string;
  category: string;
  metal_type: string;
  gold_karat: string;
  weight_grams: string;
  metal_purchase_price: string;
  labor_cost: string;
  selling_price: string;
}

function emptyItem(category: string): ItemDraft {
  return {
    name: "", category, metal_type: "or", gold_karat: "21",
    weight_grams: "", metal_purchase_price: "", labor_cost: "", selling_price: "",
  };
}

function ParuresPage() {
  const qc = useQueryClient();
  const categoryNames = useCategoryNames();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [labelProducts, setLabelProducts] = useState<LabelProduct[] | null>(null);

  const [setName, setSetName] = useState("");
  const [setNotes, setSetNotes] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([
    emptyItem("Collier"), emptyItem("Boucles d'oreilles"), emptyItem("Bague"),
  ]);

  const { data: sets } = useQuery({
    queryKey: ["jewelry_sets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jewelry_sets").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as JewelrySet[];
    },
  });

  const { data: setProducts } = useQuery({
    queryKey: ["set_items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").not("set_id", "is", null);
      if (error) throw error;
      return data as SetItem[];
    },
  });

  const { data: events } = useQuery({
    queryKey: ["set_events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("jewelry_set_events").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data as SetEvent[];
    },
  });

  const itemsBySet = useMemo(() => {
    const m = new Map<string, SetItem[]>();
    (setProducts ?? []).forEach((it) => {
      if (!it.set_id) return;
      const arr = m.get(it.set_id) ?? [];
      arr.push(it);
      m.set(it.set_id, arr);
    });
    return m;
  }, [setItems]);

  const eventsBySet = useMemo(() => {
    const m = new Map<string, SetEvent[]>();
    (events ?? []).forEach((e) => {
      if (!e.set_id) return;
      const arr = m.get(e.set_id) ?? [];
      arr.push(e);
      m.set(e.set_id, arr);
    });
    return m;
  }, [events]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function resetForm() {
    setSetName("");
    setSetNotes("");
    setItems([emptyItem("Collier"), emptyItem("Boucles d'oreilles"), emptyItem("Bague")]);
  }

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  const create = useMutation({
    mutationFn: async () => {
      if (!setName.trim()) throw new Error("Le nom de la parure est obligatoire.");
      const valid = items.filter((it) => it.name.trim());
      if (valid.length < 2) throw new Error("Une parure doit contenir au moins 2 pièces.");

      const { data: u } = await supabase.auth.getUser();
      const { data: ref, error: refErr } = await supabase.rpc("next_set_number");
      if (refErr) throw refErr;

      const { data: created, error: setErr } = await supabase
        .from("jewelry_sets")
        .insert({ reference: ref as string, name: setName.trim(), notes: setNotes.trim() || null, created_by: u.user?.id })
        .select("id, reference")
        .single();
      if (setErr) throw setErr;

      const rows = valid.map((it) => ({
        internal_code: `BJ-${Math.random().toString(36).toUpperCase().slice(-6)}${Date.now().toString(36).toUpperCase().slice(-3)}`,
        name: it.name.trim(),
        category: it.category,
        metal_type: it.metal_type,
        gold_karat: it.metal_type === "or" && it.gold_karat ? Number(it.gold_karat) : null,
        weight_grams: Number(it.weight_grams) || 0,
        metal_purchase_price: Number(it.metal_purchase_price) || 0,
        labor_cost: Number(it.labor_cost) || 0,
        selling_price: Number(it.selling_price) || 0,
        status: "en_stock",
        set_id: created.id,
        created_by: u.user?.id,
      }));
      const { data: insertedItems, error: prodErr } = await supabase.from("products").insert(rows).select("id, name, category");
      if (prodErr) throw prodErr;

      const evts = [
        { set_id: created.id, event_type: "set_created", detail: `Parure créée : ${setName.trim()} (${created.reference})` },
        ...(insertedItems ?? []).map((p) => ({
          set_id: created.id, product_id: p.id, event_type: "item_added",
          detail: `Pièce ajoutée : ${p.name} — catégorie ${p.category}`,
        })),
      ];
      await supabase.from("jewelry_set_events").insert(evts);
    },
    onSuccess: () => {
      toast.success("Parure créée avec ses pièces");
      setOpen(false);
      resetForm();
      qc.invalidateQueries({ queryKey: ["jewelry_sets"] });
      qc.invalidateQueries({ queryKey: ["set_items"] });
      qc.invalidateQueries({ queryKey: ["set_events"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeSet = useMutation({
    mutationFn: async (id: string) => {
      // Detach remaining in-stock items, keep sold items' history via set_id NULL on delete cascade
      const { error } = await supabase.from("jewelry_sets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Parure supprimée (les pièces restent en stock)");
      qc.invalidateQueries({ queryKey: ["jewelry_sets"] });
      qc.invalidateQueries({ queryKey: ["set_items"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Parures" allow={["admin"]}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Gérez vos parures complètes. Chaque pièce a son propre code, QR, poids, prix et catégorie.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/stock"><Package className="mr-2 h-4 w-4" /> Stock</Link>
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" /> Nouvelle parure</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nouvelle parure</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nom de la parure *</Label>
                    <Input value={setName} onChange={(e) => setSetName(e.target.value)} placeholder="Ex. Parure mariage Yasmine" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Input value={setNotes} onChange={(e) => setSetNotes(e.target.value)} placeholder="Optionnel" />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-base">Pièces de la parure</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setItems((p) => [...p, emptyItem(categoryNames[0] ?? "Autre")])}>
                    <Plus className="mr-1 h-4 w-4" /> Ajouter une pièce
                  </Button>
                </div>

                <div className="space-y-3">
                  {items.map((it, idx) => (
                    <div key={idx} className="rounded-lg border p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium">Pièce {idx + 1}</span>
                        {items.length > 1 && (
                          <Button type="button" size="icon" variant="ghost" onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Nom de la pièce</Label>
                          <Input value={it.name} onChange={(e) => updateItem(idx, { name: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Catégorie</Label>
                          <Select value={it.category} onValueChange={(v) => updateItem(idx, { category: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {categoryNames.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Type de métal</Label>
                          <Select value={it.metal_type} onValueChange={(v) => updateItem(idx, { metal_type: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {METAL_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        {it.metal_type === "or" && (
                          <div className="space-y-1">
                            <Label className="text-xs">Titre de l'or</Label>
                            <Select value={it.gold_karat} onValueChange={(v) => updateItem(idx, { gold_karat: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {KARATS.map((k) => <SelectItem key={k} value={String(k)}>{k}K</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        <div className="space-y-1">
                          <Label className="text-xs">Poids (g)</Label>
                          <Input type="number" min={0} step="0.001" value={it.weight_grams} onChange={(e) => updateItem(idx, { weight_grams: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prix de vente (DZD)</Label>
                          <Input type="number" min={0} step="0.01" value={it.selling_price} onChange={(e) => updateItem(idx, { selling_price: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Prix d'achat métal (DZD)</Label>
                          <Input type="number" min={0} step="0.01" value={it.metal_purchase_price} onChange={(e) => updateItem(idx, { metal_purchase_price: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Main-d'œuvre (DZD)</Label>
                          <Input type="number" min={0} step="0.01" value={it.labor_cost} onChange={(e) => updateItem(idx, { labor_cost: e.target.value })} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>Créer la parure</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {(sets ?? []).map((s) => {
          const its = itemsBySet.get(s.id) ?? [];
          const status = setStatusOf(its);
          const meta = STATUS_META[status];
          const isOpen = expanded.has(s.id);
          const remaining = its.filter((i) => i.status !== "vendu");
          const remWeight = remaining.reduce((a, i) => a + Number(i.weight_grams), 0);
          const remValue = remaining.reduce((a, i) => a + Number(i.selling_price), 0);
          return (
            <Card key={s.id}>
              <CardContent className="p-0">
                <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => toggle(s.id)}>
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <Layers className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{s.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{s.reference}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {its.length} pièce(s) · {remaining.length} en stock · reste {formatGrams(remWeight)} · {formatDZD(remValue)}
                    </div>
                  </div>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                </button>

                {isOpen && (
                  <div className="border-t px-4 py-3">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Pièce</TableHead>
                          <TableHead>Catégorie</TableHead>
                          <TableHead>Poids</TableHead>
                          <TableHead>Prix</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {its.map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="font-mono text-xs">{it.internal_code}</TableCell>
                            <TableCell>{it.name}</TableCell>
                            <TableCell><Badge variant="outline">{it.category}</Badge></TableCell>
                            <TableCell>{formatGrams(Number(it.weight_grams))}</TableCell>
                            <TableCell>{formatDZD(Number(it.selling_price))}</TableCell>
                            <TableCell>
                              <Badge variant={it.status === "vendu" ? "secondary" : "default"}>{statusLabel(it.status)}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" title="Étiquette & QR" onClick={() => setLabelProducts([{ ...it, supplier_name: null }])}>
                                <Tag className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Ouvrir la fiche" asChild>
                                <Link to="/produit/$id" params={{ id: it.id }}><ExternalLink className="h-4 w-4" /></Link>
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    <div className="mt-4">
                      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <History className="h-4 w-4" /> Historique de la parure
                      </div>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {(eventsBySet.get(s.id) ?? []).map((e) => (
                          <li key={e.id} className="flex gap-2">
                            <span className="shrink-0 font-mono">{formatDateTime(e.created_at)}</span>
                            <span>{e.detail}</span>
                          </li>
                        ))}
                        {(eventsBySet.get(s.id) ?? []).length === 0 && <li>Aucun évènement enregistré.</li>}
                      </ul>
                    </div>

                    <div className="mt-4 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => removeSet.mutate(s.id)}>
                        <Trash2 className="mr-2 h-4 w-4 text-destructive" /> Dissoudre la parure
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {(sets ?? []).length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Layers className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aucune parure enregistrée. Créez votre première parure complète.
            </CardContent>
          </Card>
        )}
      </div>

      <LabelDialog products={labelProducts} onClose={() => setLabelProducts(null)} isAdmin />
    </AppShell>
  );
}
