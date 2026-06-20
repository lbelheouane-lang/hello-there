import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Search, Printer, Pencil, Trash2, Wrench, Clock, PackageCheck,
  CheckCircle2, AlertTriangle, QrCode, Copy, X, Image as ImageIcon,
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
import { METAL_TYPES } from "@/lib/format";
import { formatDZD, formatDate, formatDateTime } from "@/lib/format";
import {
  REPAIR_STATUSES, REPAIR_FLOW, JEWELRY_TYPES, PURITY_OPTIONS,
  repairStatusDef, repairStatusLabel, trackingUrl, generateQrDataUrl,
  printRepairReceipt,
} from "@/lib/repair";

export const Route = createFileRoute("/_authenticated/reparations")({
  component: RepairsPage,
});

interface Repair {
  id: string;
  reference: string;
  tracking_token: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string | null;
  intake_at: string;
  jewelry_type: string;
  metal_type: string | null;
  purity: string | null;
  weight_grams: number | null;
  jewelry_description: string | null;
  repair_description: string;
  estimated_completion: string | null;
  estimated_cost: number | null;
  status: string;
  notes: string | null;
  photos: string[];
  created_by: string | null;
  created_at: string;
}

interface HistoryEntry {
  id: string;
  status: string;
  note: string | null;
  created_at: string;
}

interface RepairForm {
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  intake_at: string;
  jewelry_type: string;
  metal_type: string;
  purity: string;
  weight_grams: string;
  jewelry_description: string;
  repair_description: string;
  estimated_completion: string;
  estimated_cost: string;
  notes: string;
}

const emptyForm: RepairForm = {
  customer_id: "",
  customer_name: "",
  customer_phone: "",
  intake_at: new Date().toISOString().slice(0, 16),
  jewelry_type: JEWELRY_TYPES[0],
  metal_type: "or",
  purity: "18K",
  weight_grams: "",
  jewelry_description: "",
  repair_description: "",
  estimated_completion: "",
  estimated_cost: "",
  notes: "",
};

const OPEN_STATUSES = ["received", "inspection", "waiting_parts", "in_progress"];

function isOverdue(r: Repair): boolean {
  if (!r.estimated_completion) return false;
  if (["completed", "delivered", "cancelled"].includes(r.status)) return false;
  return r.estimated_completion < new Date().toISOString().slice(0, 10);
}

function RepairsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Repair | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [files, setFiles] = useState<File[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Repair | null>(null);
  const [detail, setDetail] = useState<Repair | null>(null);

  const { data: customers } = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name, phone").order("full_name");
      if (error) throw error;
      return data as { id: string; full_name: string; phone: string | null }[];
    },
  });

  const { data: repairs, isLoading } = useQuery({
    queryKey: ["repairs"],
    queryFn: async () => {
      const { data, error } = await supabase.from("repairs").select("*").order("intake_at", { ascending: false });
      if (error) throw error;
      return data as Repair[];
    },
  });

  const filtered = useMemo(() => {
    let list = repairs ?? [];
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((r) =>
        r.reference.toLowerCase().includes(q) ||
        r.customer_name.toLowerCase().includes(q) ||
        (r.customer_phone ?? "").toLowerCase().includes(q) ||
        r.jewelry_type.toLowerCase().includes(q),
      );
    }
    if (statusFilter === "overdue") list = list.filter(isOverdue);
    else if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    return list;
  }, [repairs, search, statusFilter]);

  const stats = useMemo(() => {
    const list = repairs ?? [];
    const today = new Date().toISOString().slice(0, 10);
    return {
      today: list.filter((r) => r.intake_at.slice(0, 10) === today).length,
      inProgress: list.filter((r) => OPEN_STATUSES.includes(r.status)).length,
      ready: list.filter((r) => r.status === "ready").length,
      completed: list.filter((r) => ["completed", "delivered"].includes(r.status)).length,
      overdue: list.filter(isOverdue).length,
    };
  }, [repairs]);

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm });
    setFiles([]);
    setDialogOpen(true);
  }

  function openEdit(r: Repair) {
    setEditing(r);
    setForm({
      customer_id: r.customer_id ?? "",
      customer_name: r.customer_name,
      customer_phone: r.customer_phone ?? "",
      intake_at: new Date(r.intake_at).toISOString().slice(0, 16),
      jewelry_type: r.jewelry_type,
      metal_type: r.metal_type ?? "",
      purity: r.purity ?? "",
      weight_grams: r.weight_grams != null ? String(r.weight_grams) : "",
      jewelry_description: r.jewelry_description ?? "",
      repair_description: r.repair_description,
      estimated_completion: r.estimated_completion ?? "",
      estimated_cost: r.estimated_cost != null ? String(r.estimated_cost) : "",
      notes: r.notes ?? "",
    });
    setFiles([]);
    setDialogOpen(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!form.customer_name.trim()) throw new Error("Indiquez le nom du client.");
      if (!form.repair_description.trim()) throw new Error("Décrivez la réparation demandée.");

      let photos = editing?.photos ?? [];
      if (files.length) {
        for (const file of files) {
          const ext = file.name.split(".").pop();
          const path = `${user!.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: upErr } = await supabase.storage.from("repair-photos").upload(path, file);
          if (upErr) throw upErr;
          photos = [...photos, path];
        }
      }

      const payload = {
        customer_id: form.customer_id || null,
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim() || null,
        intake_at: new Date(form.intake_at).toISOString(),
        jewelry_type: form.jewelry_type,
        metal_type: form.metal_type || null,
        purity: form.purity || null,
        weight_grams: form.weight_grams ? Number(form.weight_grams) : null,
        jewelry_description: form.jewelry_description.trim() || null,
        repair_description: form.repair_description.trim(),
        estimated_completion: form.estimated_completion || null,
        estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
        notes: form.notes.trim() || null,
        photos,
      };

      if (editing) {
        const { error } = await supabase.from("repairs").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("repairs").insert({ ...payload, created_by: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Réparation mise à jour" : "Réparation enregistrée");
      setDialogOpen(false);
      qc.invalidateQueries({ queryKey: ["repairs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("repairs").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(`Statut : ${repairStatusLabel(v.status)}`);
      qc.invalidateQueries({ queryKey: ["repairs"] });
      qc.invalidateQueries({ queryKey: ["repair-history"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (r: Repair) => {
      if (r.photos.length) await supabase.storage.from("repair-photos").remove(r.photos);
      const { error } = await supabase.from("repairs").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Réparation supprimée");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["repairs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handlePrint(r: Repair) {
    try {
      const qrDataUrl = await generateQrDataUrl(trackingUrl(r.tracking_token));
      printRepairReceipt({
        reference: r.reference,
        trackingToken: r.tracking_token,
        qrDataUrl,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        intakeAt: r.intake_at,
        jewelryType: r.jewelry_type,
        metalType: r.metal_type,
        purity: r.purity,
        weightGrams: r.weight_grams,
        jewelryDescription: r.jewelry_description,
        repairDescription: r.repair_description,
        estimatedCompletion: r.estimated_completion,
        estimatedCost: r.estimated_cost,
      });
    } catch {
      toast.error("Impossible de générer le bon.");
    }
  }

  function pickCustomer(id: string) {
    const c = customers?.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      customer_id: id,
      customer_name: c?.full_name ?? f.customer_name,
      customer_phone: c?.phone ?? f.customer_phone,
    }));
  }

  return (
    <AppShell title="Réparations" allow={["admin", "employe"]}>
      <div className="space-y-6">
        {/* Dashboard */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={<Wrench className="h-4 w-4" />} label="Reçues aujourd'hui" value={stats.today} />
          <StatCard icon={<Clock className="h-4 w-4" />} label="En cours" value={stats.inProgress} />
          <StatCard icon={<PackageCheck className="h-4 w-4" />} label="Prêtes à récupérer" value={stats.ready} accent="text-green-600" />
          <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Terminées" value={stats.completed} />
          <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="En retard" value={stats.overdue} accent="text-destructive" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-serif text-lg font-semibold">Réparations</h2>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Nouvelle réparation
          </Button>
        </div>

        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Référence, client, téléphone, bijou…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="overdue">⚠ En retard</SelectItem>
                  {REPAIR_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Réf / Dépôt</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2">Bijou</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Fin estimée</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Chargement…</td></tr>}
                  {!isLoading && filtered.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Aucune réparation.</td></tr>}
                  {filtered.map((r) => {
                    const def = repairStatusDef(r.status);
                    const overdue = isOverdue(r);
                    return (
                      <tr key={r.id} className="border-t hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <button className="font-mono font-medium text-primary hover:underline" onClick={() => setDetail(r)}>{r.reference}</button>
                          <div className="text-xs text-muted-foreground">{formatDateTime(r.intake_at)}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div>{r.customer_name}</div>
                          <div className="text-xs text-muted-foreground">{r.customer_phone ?? "—"}</div>
                        </td>
                        <td className="px-3 py-2">
                          <div>{r.jewelry_type}</div>
                          <div className="text-xs text-muted-foreground">{[r.metal_type, r.purity].filter(Boolean).join(" · ") || "—"}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Select value={r.status} onValueChange={(v) => changeStatus.mutate({ id: r.id, status: v })}>
                            <SelectTrigger className="h-8 w-[170px]">
                              <Badge className={def.className}>{def.label}</Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {REPAIR_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-3 py-2">
                          <span className={overdue ? "font-medium text-destructive" : ""}>
                            {r.estimated_completion ? formatDate(r.estimated_completion) : "—"}
                          </span>
                          {overdue && <div className="text-xs text-destructive">En retard</div>}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex justify-end gap-1">
                            {r.status !== "ready" && OPEN_STATUSES.includes(r.status) && (
                              <Button size="icon" variant="ghost" title="Marquer prêt" onClick={() => changeStatus.mutate({ id: r.id, status: "ready" })}><PackageCheck className="h-4 w-4 text-green-600" /></Button>
                            )}
                            <Button size="icon" variant="ghost" title="Suivi / QR" onClick={() => setDetail(r)}><QrCode className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Imprimer le bon" onClick={() => handlePrint(r)}><Printer className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Modifier" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" title="Supprimer" onClick={() => setDeleteTarget(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? `Modifier ${editing.reference}` : "Nouvelle réparation"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Client existant (optionnel)</Label>
              <Select value={form.customer_id || "none"} onValueChange={(v) => v === "none" ? setForm((f) => ({ ...f, customer_id: "" })) : pickCustomer(v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Saisie manuelle —</SelectItem>
                  {customers?.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom du client *</Label>
              <Input value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
            </div>
            <div>
              <Label>Téléphone</Label>
              <Input value={form.customer_phone} onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))} />
            </div>
            <div>
              <Label>Date & heure de dépôt</Label>
              <Input type="datetime-local" value={form.intake_at} onChange={(e) => setForm((f) => ({ ...f, intake_at: e.target.value }))} />
            </div>
            <div>
              <Label>Type de bijou</Label>
              <Select value={form.jewelry_type} onValueChange={(v) => setForm((f) => ({ ...f, jewelry_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{JEWELRY_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Métal</Label>
              <Select value={form.metal_type || "none"} onValueChange={(v) => setForm((f) => ({ ...f, metal_type: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {METAL_TYPES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Titre / pureté</Label>
              <Select value={form.purity || "none"} onValueChange={(v) => setForm((f) => ({ ...f, purity: v === "none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {PURITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Poids (g) — optionnel</Label>
              <Input type="number" step="0.001" value={form.weight_grams} onChange={(e) => setForm((f) => ({ ...f, weight_grams: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Description du bijou</Label>
              <Textarea rows={2} value={form.jewelry_description} onChange={(e) => setForm((f) => ({ ...f, jewelry_description: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Réparation demandée *</Label>
              <Textarea rows={2} value={form.repair_description} onChange={(e) => setForm((f) => ({ ...f, repair_description: e.target.value }))} />
            </div>
            <div>
              <Label>Date de fin estimée</Label>
              <Input type="date" value={form.estimated_completion} onChange={(e) => setForm((f) => ({ ...f, estimated_completion: e.target.value }))} />
            </div>
            <div>
              <Label>Coût estimé</Label>
              <Input type="number" value={form.estimated_cost} onChange={(e) => setForm((f) => ({ ...f, estimated_cost: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Photos du bijou (avant réparation)</Label>
              <Input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
              {editing && editing.photos.length > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">{editing.photos.length} photo(s) déjà enregistrée(s). Les nouvelles seront ajoutées.</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <Label>Notes internes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail / tracking dialog */}
      <RepairDetailDialog repair={detail} onClose={() => setDetail(null)} onPrint={handlePrint} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette réparation ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.reference} — {deleteTarget?.customer_name}. Cette action est irréversible.
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

function StatCard({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
        <p className={`mt-1 font-serif text-2xl font-semibold ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function RepairDetailDialog({ repair, onClose, onPrint }: { repair: Repair | null; onClose: () => void; onPrint: (r: Repair) => void }) {
  const [qr, setQr] = useState<string>("");

  const { data: history } = useQuery({
    queryKey: ["repair-history", repair?.id],
    enabled: !!repair,
    queryFn: async () => {
      const { data, error } = await supabase.from("repair_status_history").select("*").eq("repair_id", repair!.id).order("created_at", { ascending: true });
      if (error) throw error;
      return data as HistoryEntry[];
    },
  });

  const { data: photoUrls } = useQuery({
    queryKey: ["repair-photos", repair?.id],
    enabled: !!repair && (repair?.photos.length ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("repair-photos").createSignedUrls(repair!.photos, 600);
      if (error) throw error;
      return (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
    },
  });

  const url = repair ? trackingUrl(repair.tracking_token) : "";

  useMemo(() => {
    if (repair) generateQrDataUrl(trackingUrl(repair.tracking_token)).then(setQr).catch(() => setQr(""));
    else setQr("");
  }, [repair]);

  function copyLink() {
    navigator.clipboard.writeText(url).then(() => toast.success("Lien copié")).catch(() => toast.error("Échec de la copie"));
  }

  if (!repair) return null;
  const currentOrder = repairStatusDef(repair.status).order;

  return (
    <Dialog open={!!repair} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-mono">{repair.reference}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3 text-sm">
            <div><span className="text-muted-foreground">Client : </span>{repair.customer_name}{repair.customer_phone ? ` · ${repair.customer_phone}` : ""}</div>
            <div><span className="text-muted-foreground">Bijou : </span>{repair.jewelry_type} {[repair.metal_type, repair.purity].filter(Boolean).join(" · ")}</div>
            {repair.jewelry_description && <div><span className="text-muted-foreground">Description : </span>{repair.jewelry_description}</div>}
            <div><span className="text-muted-foreground">Réparation : </span>{repair.repair_description}</div>
            <div><span className="text-muted-foreground">Fin estimée : </span>{repair.estimated_completion ? formatDate(repair.estimated_completion) : "—"}</div>
            <div><span className="text-muted-foreground">Coût estimé : </span>{repair.estimated_cost != null ? formatDZD(repair.estimated_cost) : "—"}</div>
          </div>
          <div className="flex flex-col items-center justify-start gap-2 rounded-xl border p-4">
            {qr ? <img src={qr} alt="QR suivi" className="h-36 w-36" /> : <QrCode className="h-36 w-36 text-muted-foreground" />}
            <p className="text-center text-xs text-muted-foreground">Page de suivi client (lecture seule)</p>
            <Button size="sm" variant="outline" className="w-full" onClick={copyLink}><Copy className="mr-2 h-3.5 w-3.5" /> Copier le lien</Button>
            <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">Ouvrir la page de suivi</a>
          </div>
        </div>

        {photoUrls && photoUrls.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-sm font-medium"><ImageIcon className="h-4 w-4" /> Photos avant réparation</p>
            <div className="flex flex-wrap gap-2">
              {photoUrls.map((u, i) => (
                <a key={i} href={u} target="_blank" rel="noreferrer">
                  <img src={u} alt={`Photo ${i + 1}`} className="h-20 w-20 rounded-lg border object-cover" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-3 text-sm font-medium">Progression</p>
          <ol className="flex flex-wrap gap-x-4 gap-y-2">
            {REPAIR_FLOW.map((s) => {
              const done = s.order < currentOrder;
              const active = s.order === currentOrder;
              return (
                <li key={s.value} className={`flex items-center gap-1.5 text-xs ${active ? "font-semibold text-primary" : done ? "text-foreground" : "text-muted-foreground"}`}>
                  {done ? <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> : <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-primary" : "bg-muted"}`} />}
                  {s.label}
                </li>
              );
            })}
          </ol>
        </div>

        {history && history.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Historique des statuts</p>
            <ol className="relative space-y-3 border-l pl-5">
              {[...history].reverse().map((h) => (
                <li key={h.id} className="relative">
                  <span className="absolute -left-[23px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                  <p className="text-sm">{repairStatusLabel(h.status)}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}{h.note ? ` — ${h.note}` : ""}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4" /> Fermer</Button>
          <Button onClick={() => onPrint(repair)}><Printer className="mr-2 h-4 w-4" /> Imprimer le bon</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
