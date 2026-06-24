import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, Printer, Pencil, Trash2, Paperclip,
  FileDown, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/data-client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PAYMENT_METHODS, formatDZD, formatDateTime, paymentLabel } from "@/lib/format";
import {
  buildExpenseReceiptHtml, buildExpenseReportHtml, printHtmlDocument, type ExpenseRow,
} from "@/lib/expense-report";

export const Route = createFileRoute("/_authenticated/depenses")({
  component: ExpensesPage,
});

interface Expense {
  id: string;
  reference: string;
  category: string;
  description: string;
  amount: number;
  payment_method: string;
  supplier_id: string | null;
  recorded_by: string | null;
  notes: string | null;
  attachment_path: string | null;
  spent_at: string;
}

interface ExpenseForm {
  category: string;
  description: string;
  amount: string;
  payment_method: string;
  supplier_id: string;
  notes: string;
  spent_at: string;
  purchase_reference: string;
  quantity: string;
  weight_grams: string;
}

const STOCK_CATEGORY = "Achat de stock";

const emptyForm: ExpenseForm = {
  category: "",
  description: "",
  amount: "",
  payment_method: PAYMENT_METHODS[0].value,
  supplier_id: "",
  notes: "",
  spent_at: new Date().toISOString().slice(0, 16),
  purchase_reference: "",
  quantity: "",
  weight_grams: "",
};

function startOfToday() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function startOfMonth() { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); }
function startOfYear() { const d = new Date(); return new Date(d.getFullYear(), 0, 1); }

function ExpensesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [file, setFile] = useState<File | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const { data: categories } = useQuery({
    queryKey: ["expense_categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expense_categories").select("*").order("name");
      if (error) throw error;
      return data as { id: string; name: string; is_custom: boolean }[];
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

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data as { full_name: string | null } | null;
    },
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("spent_at", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const supplierName = (id: string | null) => suppliers?.find((s) => s.id === id)?.name ?? null;

  const filtered = useMemo(() => {
    let list = expenses ?? [];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((e) =>
        e.description.toLowerCase().includes(q) ||
        e.reference.toLowerCase().includes(q) ||
        (supplierName(e.supplier_id) ?? "").toLowerCase().includes(q),
      );
    }
    if (catFilter !== "all") list = list.filter((e) => e.category === catFilter);
    if (pmFilter !== "all") list = list.filter((e) => e.payment_method === pmFilter);
    if (fromDate) list = list.filter((e) => e.spent_at >= fromDate);
    if (toDate) list = list.filter((e) => e.spent_at <= `${toDate}T23:59:59`);
    if (minAmount) list = list.filter((e) => Number(e.amount) >= Number(minAmount));
    if (maxAmount) list = list.filter((e) => Number(e.amount) <= Number(maxAmount));
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, suppliers, search, catFilter, pmFilter, fromDate, toDate, minAmount, maxAmount]);

  const sumSince = (since: Date) =>
    (expenses ?? []).filter((e) => new Date(e.spent_at) >= since).reduce((s, e) => s + Number(e.amount), 0);

  const totalToday = sumSince(startOfToday());
  const totalMonth = sumSince(startOfMonth());
  const totalYear = sumSince(startOfYear());

  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const e of filtered) {
      const cur = map.get(e.category) ?? { total: 0, count: 0 };
      cur.total += Number(e.amount);
      cur.count += 1;
      map.set(e.category, cur);
    }
    return [...map.entries()].map(([category, v]) => ({ category, ...v })).sort((a, b) => b.total - a.total);
  }, [filtered]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm, category: categories?.[0]?.name ?? "" });
    setFile(null);
    setDialogOpen(true);
  }

  async function openEdit(e: Expense) {
    setEditing(e);
    let purchase_reference = "";
    let quantity = "";
    let weight_grams = "";
    if (e.category === STOCK_CATEGORY) {
      const { data: linked } = await supabase
        .from("purchases")
        .select("reference, quantity, weight_grams")
        .eq("expense_id", e.id)
        .maybeSingle();
      if (linked) {
        purchase_reference = linked.reference ?? "";
        quantity = linked.quantity ? String(linked.quantity) : "";
        weight_grams = Number(linked.weight_grams) ? String(linked.weight_grams) : "";
      }
    }
    setForm({
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      payment_method: e.payment_method,
      supplier_id: e.supplier_id ?? "",
      notes: e.notes ?? "",
      spent_at: new Date(e.spent_at).toISOString().slice(0, 16),
      purchase_reference,
      quantity,
      weight_grams,
    });
    setFile(null);
    setDialogOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.category) throw new Error("Choisissez une catégorie.");
      if (!form.description.trim()) throw new Error("Ajoutez une description.");
      const amount = Number(form.amount);
      if (!amount || amount <= 0) throw new Error("Indiquez un montant valide.");

      const isStock = form.category === STOCK_CATEGORY;
      if (isStock && !form.supplier_id) {
        throw new Error("Sélectionnez un fournisseur pour un achat de stock.");
      }

      let attachment_path = editing?.attachment_path ?? null;
      if (file) {
        const ext = file.name.split(".").pop();
        const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("expense-attachments").upload(path, file);
        if (upErr) throw upErr;
        attachment_path = path;
      }

      const payload = {
        category: form.category,
        description: form.description.trim(),
        amount,
        payment_method: form.payment_method,
        supplier_id: form.supplier_id || null,
        notes: form.notes.trim() || null,
        spent_at: new Date(form.spent_at).toISOString(),
        attachment_path,
      };

      let expenseId: string;
      if (editing) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
        if (error) throw error;
        expenseId = editing.id;
      } else {
        const { data: inserted, error } = await supabase
          .from("expenses")
          .insert({ ...payload, recorded_by: user!.id })
          .select("id")
          .single();
        if (error) throw error;
        expenseId = inserted.id;
      }

      // Automatic supplier purchase integration for stock purchases
      if (isStock && form.supplier_id) {
        const supplier_name = supplierName(form.supplier_id);
        const qty = form.quantity ? Math.max(parseInt(form.quantity, 10) || 0, 1) : 1;
        const weight = form.weight_grams ? Number(form.weight_grams) || 0 : 0;
        const employee_name = profile?.full_name ?? null;

        const { data: existing } = await supabase
          .from("purchases")
          .select("id, reference")
          .eq("expense_id", expenseId)
          .maybeSingle();

        let reference = form.purchase_reference.trim();
        const purchaseFields = {
          supplier_id: form.supplier_id,
          supplier_name,
          quantity: qty,
          weight_grams: weight,
          metal_purchase_price: amount,
          unit_cost: qty > 0 ? amount / qty : amount,
          total_cost: amount,
          notes: form.notes.trim() || null,
          purchased_at: new Date(form.spent_at).toISOString(),
        };

        if (existing) {
          const { error } = await supabase
            .from("purchases")
            .update({ ...purchaseFields, reference: reference || existing.reference })
            .eq("id", existing.id);
          if (error) throw error;
        } else {
          if (!reference) {
            const { data: gen } = await supabase.rpc("next_purchase_number");
            reference = (gen as string) ?? `ACH-${Date.now()}`;
          }
          const { error } = await supabase.from("purchases").insert({
            ...purchaseFields,
            reference,
            expense_id: expenseId,
            recorded_by: user!.id,
            employee_name,
          });
          if (error) throw error;
        }
      } else if (editing) {
        // The expense was changed from a stock purchase to another category:
        // drop any previously linked supplier purchase to avoid a stale record.
        await supabase.from("purchases").delete().eq("expense_id", expenseId);
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Dépense mise à jour" : "Dépense enregistrée");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["supplier-purchases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (e: Expense) => {
      if (e.attachment_path) await supabase.storage.from("expense-attachments").remove([e.attachment_path]);
      // Remove the auto-generated supplier purchase linked to this expense so it
      // does not linger as an orphan in the supplier's purchase history.
      await supabase.from("purchases").delete().eq("expense_id", e.id);
      const { error } = await supabase.from("expenses").delete().eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dépense supprimée");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["supplier-purchases"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCategory = useMutation({
    mutationFn: async () => {
      const name = newCategory.trim();
      if (!name) throw new Error("Nom de catégorie requis.");
      const { error } = await supabase.from("expense_categories").insert({ name, is_custom: true });
      if (error) throw error;
      return name;
    },
    onSuccess: (name) => {
      toast.success("Catégorie ajoutée");
      setNewCategory("");
      qc.invalidateQueries({ queryKey: ["expense_categories"] });
      setForm((f) => ({ ...f, category: name }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function openAttachment(path: string) {
    const { data, error } = await supabase.storage.from("expense-attachments").createSignedUrl(path, 60);
    if (error || !data) { toast.error("Pièce jointe introuvable"); return; }
    window.open(data.signedUrl, "_blank");
  }

  function toExpenseRow(e: Expense): ExpenseRow {
    return {
      id: e.id, reference: e.reference, category: e.category, description: e.description,
      amount: Number(e.amount), payment_method: e.payment_method,
      supplier_name: supplierName(e.supplier_id), employee_name: null,
      notes: e.notes, spent_at: e.spent_at,
    };
  }

  function printReceipt(e: Expense) {
    printHtmlDocument(buildExpenseReceiptHtml(toExpenseRow(e)));
  }

  function generateReport() {
    const periodLabel =
      fromDate || toDate
        ? `Période : ${fromDate || "début"} → ${toDate || "aujourd'hui"}`
        : "Toutes les dépenses";
    printHtmlDocument(
      buildExpenseReportHtml({
        periodLabel,
        rows: filtered.map(toExpenseRow),
        byCategory,
      }),
    );
  }

  return (
    <AppShell title="Dépenses" allow={["admin"]}>
      <div className="space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Dépenses aujourd'hui</p>
            <p className="font-serif text-2xl font-semibold">{formatDZD(totalToday)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Ce mois-ci</p>
            <p className="font-serif text-2xl font-semibold">{formatDZD(totalMonth)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cette année</p>
            <p className="font-serif text-2xl font-semibold">{formatDZD(totalYear)}</p>
          </CardContent></Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Par catégorie (filtré)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {byCategory.length === 0 && <p className="text-sm text-muted-foreground">Aucune dépense.</p>}
              {byCategory.map((c) => (
                <div key={c.category} className="flex items-center justify-between text-sm">
                  <span className="truncate">{c.category}</span>
                  <span className="font-medium">{formatDZD(c.total)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-serif text-lg font-semibold">Dépenses</h2>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={generateReport}>
                  <FileDown className="mr-2 h-4 w-4" /> Rapport PDF
                </Button>
                <Button onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" /> Nouvelle dépense
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="space-y-4 p-4">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Description, fournisseur, référence…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  </div>
                  <Select value={catFilter} onValueChange={setCatFilter}>
                    <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes catégories</SelectItem>
                      {categories?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={pmFilter} onValueChange={setPmFilter}>
                    <SelectTrigger><SelectValue placeholder="Paiement" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous paiements</SelectItem>
                      {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-4">
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Du</Label>
                      <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Au</Label>
                      <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Montant min</Label>
                      <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] text-muted-foreground">Montant max</Label>
                      <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Réf / Date</th>
                        <th className="px-3 py-2">Catégorie</th>
                        <th className="px-3 py-2">Description</th>
                        <th className="px-3 py-2 text-right">Montant</th>
                        <th className="px-3 py-2 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((e) => (
                        <tr key={e.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2">
                            <div className="font-mono font-medium">{e.reference}</div>
                            <div className="text-xs text-muted-foreground">{formatDateTime(e.spent_at)}</div>
                          </td>
                          <td className="px-3 py-2"><Badge variant="outline">{e.category}</Badge></td>
                          <td className="px-3 py-2">
                            <div>{e.description}</div>
                            <div className="text-xs text-muted-foreground">
                              {paymentLabel(e.payment_method)}{supplierName(e.supplier_id) ? ` · ${supplierName(e.supplier_id)}` : ""}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right font-medium">{formatDZD(Number(e.amount))}</td>
                          <td className="px-3 py-2">
                            <div className="flex justify-end gap-1">
                              {e.attachment_path && (
                                <Button size="icon" variant="ghost" title="Pièce jointe" onClick={() => openAttachment(e.attachment_path!)}><Paperclip className="h-4 w-4" /></Button>
                              )}
                              <Button size="icon" variant="ghost" title="Imprimer reçu" onClick={() => printReceipt(e)}><Printer className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" title="Modifier" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                              <Button size="icon" variant="ghost" title="Supprimer" onClick={() => setDeleteTarget(e)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!isLoading && filtered.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Aucune dépense trouvée.</td></tr>
                      )}
                      {isLoading && (
                        <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Chargement…</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue placeholder="Catégorie" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date & heure</Label>
                <Input type="datetime-local" value={form.spent_at} onChange={(e) => setForm((f) => ({ ...f, spent_at: e.target.value }))} />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="flex-1 space-y-2">
                <Label className="text-xs text-muted-foreground">Nouvelle catégorie personnalisée</Label>
                <Input placeholder="Ex. Assurance" value={newCategory} onChange={(e) => setNewCategory(e.target.value)} />
              </div>
              <Button type="button" variant="secondary" disabled={addCategory.isPending} onClick={() => addCategory.mutate()}>Ajouter</Button>
            </div>

            <div className="space-y-2">
              <Label>Description *</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Montant (DZD) *</Label>
                <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select value={form.payment_method} onValueChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Fournisseur {form.category === STOCK_CATEGORY ? "*" : "(optionnel)"}</Label>
              <Select value={form.supplier_id || "none"} onValueChange={(v) => setForm((f) => ({ ...f, supplier_id: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {form.category === STOCK_CATEGORY && (
              <div className="space-y-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                <p className="text-sm font-medium text-primary">Détails de l'achat de stock</p>
                <div className="space-y-2">
                  <Label>Numéro de référence (optionnel)</Label>
                  <Input
                    placeholder="Généré automatiquement si vide"
                    value={form.purchase_reference}
                    onChange={(e) => setForm((f) => ({ ...f, purchase_reference: e.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Nombre d'articles (optionnel)</Label>
                    <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Poids total (g, optionnel)</Label>
                    <Input type="number" min={0} step="0.001" value={form.weight_grams} onChange={(e) => setForm((f) => ({ ...f, weight_grams: e.target.value }))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Un achat fournisseur sera créé automatiquement et ajouté à l'historique du fournisseur.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Pièce jointe (reçu, facture, image, PDF)</Label>
              {file ? (
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span className="truncate">{file.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => setFile(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <Input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              )}
              {editing?.attachment_path && !file && (
                <button type="button" className="text-xs text-primary underline" onClick={() => openAttachment(editing.attachment_path!)}>
                  Voir la pièce jointe actuelle
                </button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteTarget != null} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription>
              La dépense {deleteTarget?.reference} et sa pièce jointe seront définitivement supprimées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && remove.mutate(deleteTarget)}>Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
