import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, Pencil, Trash2, Recycle, Scale, Coins, Wallet, X, History,
  Package, Layers, FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
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
import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import {
  SCRAP_KARATS, SCRAP_STATUSES, scrapStatusDef, scrapStatusLabel,
  scrapEventLabel, SCRAP_EVENT_ICON, printScrapInvoice,
} from "@/lib/scrap-gold";

function invoiceFromScrap(s: Scrap) {
  return {
    reference: s.reference,
    purchasedAt: s.purchased_at,
    customerName: s.customer_name,
    weightGrams: Number(s.weight_grams),
    goldKarat: s.gold_karat,
    pricePerGram: Number(s.price_per_gram),
    totalAmount: Number(s.total_amount),
    notes: s.notes,
  };
}

export const Route = createFileRoute("/_authenticated/or-casse")({
  component: ScrapGoldPage,
});

interface Scrap {
  id: string;
  reference: string;
  purchased_at: string;
  customer_id: string | null;
  customer_name: string | null;
  notes: string | null;
  weight_grams: number;
  gold_karat: number;
  price_per_gram: number;
  estimated_value: number;
  total_amount: number;
  status: string;
  is_demo: boolean;
  created_at: string;
}

interface ScrapEvent {
  id: string;
  event_type: string;
  detail: string | null;
  weight_grams: number | null;
  status: string | null;
  created_at: string;
}

interface ScrapForm {
  purchased_at: string;
  customer_id: string;
  customer_name: string;
  gold_karat: string;
  weight_grams: string;
  price_per_gram: string;
  total_amount: string;
  status: string;
  notes: string;
}

const emptyForm: ScrapForm = {
  purchased_at: new Date().toISOString().slice(0, 16),
  customer_id: "",
  customer_name: "",
  gold_karat: "18",
  weight_grams: "",
  price_per_gram: "",
  total_amount: "",
  status: "en_stock",
  notes: "",
};

const INVENTORY_TABS = [
  { to: "/stock", label: "Tous les articles", icon: Package },
  { to: "/parures", label: "Parures", icon: Layers },
  { to: "/or-casse", label: "Or Cassé", icon: Recycle },
] as const;

function ScrapGoldPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [karatFilter, setKaratFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Scrap | null>(null);
  const [form, setForm] = useState<ScrapForm>({ ...emptyForm });
  const [deleteTarget, setDeleteTarget] = useState<Scrap | null>(null);
  const [detail, setDetail] = useState<Scrap | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string }[];
    },
  });

  const { data: scraps, isLoading } = useQuery({
    queryKey: ["scrap_gold"],
    queryFn: async () => {
      const { data, error } = await supabase.from("scrap_gold").select("*").order("purchased_at", { ascending: false });
      if (error) throw error;
      return data as Scrap[];
    },
  });

  const filtered = useMemo(() => {
    let list = scraps ?? [];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((s) =>
        s.reference.toLowerCase().includes(q) ||
        (s.customer_name ?? "").toLowerCase().includes(q),
      );
    }
    if (statusFilter !== "all") list = list.filter((s) => s.status === statusFilter);
    if (karatFilter !== "all") list = list.filter((s) => String(s.gold_karat) === karatFilter);
    if (fromDate) list = list.filter((s) => s.purchased_at.slice(0, 10) >= fromDate);
    if (toDate) list = list.filter((s) => s.purchased_at.slice(0, 10) <= toDate);
    return list;
  }, [scraps, search, statusFilter, karatFilter, fromDate, toDate]);

  const totals = useMemo(() => {
    const weight = filtered.reduce((a, s) => a + Number(s.weight_grams || 0), 0);
    const value = filtered.reduce((a, s) => a + Number(s.total_amount || 0), 0);
    const avgPpg = weight > 0 ? value / weight : 0;
    return { weight, value, avgPpg, count: filtered.length };
  }, [filtered]);

  const activeFilters =
    (statusFilter !== "all" ? 1 : 0) + (karatFilter !== "all" ? 1 : 0) +
    (fromDate ? 1 : 0) + (toDate ? 1 : 0);

  function clearFilters() {
    setStatusFilter("all"); setKaratFilter("all"); setFromDate(""); setToDate("");
  }

  const liveTotal = (Number(form.weight_grams) || 0) * (Number(form.price_per_gram) || 0);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(s: Scrap) {
    setEditing(s);
    setForm({
      purchased_at: new Date(s.purchased_at).toISOString().slice(0, 16),
      customer_id: s.customer_id ?? "",
      customer_name: s.customer_name ?? "",
      gold_karat: String(s.gold_karat),
      weight_grams: String(s.weight_grams),
      price_per_gram: String(s.price_per_gram),
      status: s.status,
      notes: s.notes ?? "",
    });
    setDialogOpen(true);
  }

  function pickCustomer(id: string) {
    if (id === "none") {
      setForm((f) => ({ ...f, customer_id: "", customer_name: "" }));
      return;
    }
    const c = customers?.find((x) => x.id === id);
    setForm((f) => ({ ...f, customer_id: id, customer_name: c?.full_name ?? f.customer_name }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const weight = Number(form.weight_grams);
      const ppg = Number(form.price_per_gram);
      if (!weight || weight <= 0) throw new Error("Indiquez un poids valide.");
      if (!ppg || ppg <= 0) throw new Error("Indiquez le prix d'achat au gramme.");
      const payload = {
        purchased_at: new Date(form.purchased_at).toISOString(),
        customer_id: form.customer_id || null,
        customer_name: form.customer_name.trim() || null,
        gold_karat: Number(form.gold_karat),
        weight_grams: weight,
        price_per_gram: ppg,
        status: form.status,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        const { error } = await supabase.from("scrap_gold").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("scrap_gold").insert({ ...payload, reference: "", created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Achat mis à jour" : "Achat d'or cassé enregistré");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["scrap_gold"] });
      qc.invalidateQueries({ queryKey: ["scrap_gold_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("scrap_gold").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Statut : ${scrapStatusLabel(v.status)}`);
      qc.invalidateQueries({ queryKey: ["scrap_gold"] });
      qc.invalidateQueries({ queryKey: ["scrap_gold_events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (s: Scrap) => {
      const { error } = await supabase.from("scrap_gold").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Achat supprimé");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["scrap_gold"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Or Cassé" allow={["admin"]}>
      <div className="space-y-6">
        {/* Inventory sub-navigation */}
        <div className="flex flex-wrap gap-1 rounded-xl border bg-muted/30 p-1">
          {INVENTORY_TABS.map((t) => {
            const active = t.to === "/or-casse";
            return (
              <Button
                key={t.to}
                asChild
                size="sm"
                variant={active ? "default" : "ghost"}
              >
                <Link to={t.to}>
                  <t.icon className="mr-2 h-4 w-4" /> {t.label}
                </Link>
              </Button>
            );
          })}
        </div>

        {/* Totals */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Recycle className="h-4 w-4" />} label="Achats" value={String(totals.count)} />
          <StatCard icon={<Scale className="h-4 w-4" />} label="Poids total" value={formatGrams(totals.weight)} />
          <StatCard icon={<Coins className="h-4 w-4" />} label="Prix moyen / g" value={formatDZD(Math.round(totals.avgPpg))} />
          <StatCard icon={<Wallet className="h-4 w-4" />} label="Valeur d'achat totale" value={formatDZD(totals.value)} accent="text-primary" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold">Or Cassé / Bijoux d'occasion</h2>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nouvel achat
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-12">
              <div className="relative md:col-span-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Référence, client…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {SCRAP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={karatFilter} onValueChange={setKaratFilter}>
                <SelectTrigger className="md:col-span-2"><SelectValue placeholder="Titre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les titres</SelectItem>
                  {SCRAP_KARATS.map((k) => <SelectItem key={k} value={String(k)}>{k}K</SelectItem>)}
                </SelectContent>
              </Select>
              <Input type="date" className="md:col-span-2" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="Du" />
              <Input type="date" className="md:col-span-2" value={toDate} onChange={(e) => setToDate(e.target.value)} title="Au" />
            </div>
            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" /> Réinitialiser les filtres ({activeFilters})
              </Button>
            )}

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Réf / Date</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Titre</th>
                    <th className="px-3 py-2 text-right">Poids</th>
                    <th className="px-3 py-2 text-right">Prix / g</th>
                    <th className="px-3 py-2 text-right">Valeur</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">Chargement…</td></tr>}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-muted-foreground">
                      <Recycle className="mx-auto mb-2 h-8 w-8 opacity-40" />
                      Aucun achat d'or cassé.
                    </td></tr>
                  )}
                  {filtered.map((s) => {
                    const def = scrapStatusDef(s.status);
                    return (
                      <tr key={s.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <button className="font-mono font-medium text-primary hover:underline" onClick={() => setDetail(s)}>{s.reference}</button>
                          <div className="text-xs text-muted-foreground">{formatDateTime(s.purchased_at)}</div>
                        </td>
                        <td className="px-3 py-2">{s.customer_name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-3 py-2">{s.gold_karat}K</td>
                        <td className="px-3 py-2 text-right">{formatGrams(Number(s.weight_grams))}</td>
                        <td className="px-3 py-2 text-right">{formatDZD(Number(s.price_per_gram))}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatDZD(Number(s.total_amount))}</td>
                        <td className="px-3 py-2">
                          <Select value={s.status} onValueChange={(v) => changeStatus.mutate({ id: s.id, status: v })}>
                            <SelectTrigger className="h-8 w-[185px]">
                              <Badge className={def.className}>{def.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {SCRAP_STATUSES.map((st) => <SelectItem key={st.value} value={st.value}>{st.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Bon d'achat (imprimer / PDF)" onClick={() => printScrapInvoice(invoiceFromScrap(s))}><FileText className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Détails & historique" onClick={() => setDetail(s)}><History className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Modifier" onClick={() => openEdit(s)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Supprimer" onClick={() => setDeleteTarget(s)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier ${editing.reference}` : "Nouvel achat d'or cassé"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Date et heure d'achat</Label>
              <Input type="datetime-local" value={form.purchased_at} onChange={(e) => setForm({ ...form, purchased_at: e.target.value })} />
            </div>
            <div>
              <Label>Client existant (optionnel)</Label>
              <Select value={form.customer_id || "none"} onValueChange={pickCustomer}>
                <SelectTrigger><SelectValue placeholder="Aucun" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun / passage</SelectItem>
                  {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom du vendeur</Label>
              <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Optionnel" />
            </div>
            <div>
              <Label>Titre / Carat</Label>
              <Select value={form.gold_karat} onValueChange={(v) => setForm({ ...form, gold_karat: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCRAP_KARATS.map((k) => <SelectItem key={k} value={String(k)}>{k}K</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCRAP_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Poids (grammes)</Label>
              <Input type="number" min={0} step="0.001" value={form.weight_grams} onChange={(e) => setForm({ ...form, weight_grams: e.target.value })} />
            </div>
            <div>
              <Label>Prix d'achat / gramme (DZD)</Label>
              <Input type="number" min={0} step="0.01" value={form.price_per_gram} onChange={(e) => setForm({ ...form, price_per_gram: e.target.value })} />
            </div>
            <div className="sm:col-span-2 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Montant total d'achat</span>
                <span className="font-serif text-xl font-semibold text-primary">{formatDZD(liveTotal)}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Poids × prix au gramme (calculé automatiquement)</p>
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="État, provenance, observations…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ScrapDetailDialog scrap={detail} onClose={() => setDetail(null)} onEdit={(s) => { setDetail(null); openEdit(s); }} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet achat ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.reference} sera supprimé définitivement, ainsi que son historique.
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("truncate text-lg font-semibold", accent)}>{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ScrapDetailDialog({ scrap, onClose, onEdit }: { scrap: Scrap | null; onClose: () => void; onEdit: (s: Scrap) => void }) {
  const { data: history } = useQuery({
    queryKey: ["scrap_gold_events", scrap?.id],
    enabled: !!scrap,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scrap_gold_events")
        .select("*")
        .eq("scrap_id", scrap!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ScrapEvent[];
    },
  });

  if (!scrap) return null;
  const def = scrapStatusDef(scrap.status);

  return (
    <Dialog open={!!scrap} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono">
            {scrap.reference}
            <Badge className={def.className}>{def.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 text-sm sm:grid-cols-2">
          <div><span className="text-muted-foreground">Date d'achat : </span>{formatDateTime(scrap.purchased_at)}</div>
          <div><span className="text-muted-foreground">Client : </span>{scrap.customer_name || "—"}</div>
          <div><span className="text-muted-foreground">Titre : </span>{scrap.gold_karat}K</div>
          <div><span className="text-muted-foreground">Poids : </span>{formatGrams(Number(scrap.weight_grams))}</div>
          <div><span className="text-muted-foreground">Prix / gramme : </span>{formatDZD(Number(scrap.price_per_gram))}</div>
          <div><span className="text-muted-foreground">Montant total : </span><span className="font-semibold text-primary">{formatDZD(Number(scrap.total_amount))}</span></div>
          {scrap.notes && <div className="sm:col-span-2"><span className="text-muted-foreground">Notes : </span>{scrap.notes}</div>}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1 text-sm font-medium"><History className="h-4 w-4" /> Historique complet</p>
          {history && history.length > 0 ? (
            <ol className="relative space-y-3 border-l pl-5">
              {history.map((h) => {
                const Icon = SCRAP_EVENT_ICON[h.event_type] ?? History;
                return (
                  <li key={h.id} className="relative">
                    <span className="absolute -left-[26px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary">
                      <Icon className="h-2.5 w-2.5" />
                    </span>
                    <p className="text-sm font-medium">{scrapEventLabel(h.event_type)}</p>
                    {h.detail && <p className="text-xs text-muted-foreground">{h.detail}</p>}
                    <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Aucun événement.</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" /> Fermer</Button>
          <Button variant="outline" onClick={() => printScrapInvoice(invoiceFromScrap(scrap))}><FileText className="mr-2 h-4 w-4" /> Bon d'achat</Button>
          <Button onClick={() => onEdit(scrap)}><Pencil className="mr-2 h-4 w-4" /> Modifier</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
