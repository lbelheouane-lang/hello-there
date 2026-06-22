import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  KeyRound, ShieldCheck, ShieldAlert, ShieldX, Plus, Eye, Store,
  CheckCircle2, PauseCircle, XCircle, Copy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/licences")({
  component: LicensesPage,
});

type Status = "Active" | "Suspended" | "Revoked";

interface License {
  id: string;
  license_key: string;
  store_name: string;
  status: Status;
  activation_date: string | null;
  last_activity: string | null;
  max_users: number;
  notes: string | null;
  created_at: string;
}

interface Activation {
  id: string;
  license_id: string;
  store_name: string;
  activated_at: string;
  last_activity: string;
}

const STATUS_META: Record<Status, { label: string; variant: "default" | "secondary" | "destructive"; icon: typeof ShieldCheck }> = {
  Active: { label: "Active", variant: "default", icon: ShieldCheck },
  Suspended: { label: "Suspendue", variant: "secondary", icon: ShieldAlert },
  Revoked: { label: "Révoquée", variant: "destructive", icon: ShieldX },
};

function StatTile({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function genKey(): string {
  const seg = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `MDOR-${seg()}-${seg()}-${seg()}`;
}

function LicensesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isDeveloper, loading } = useAuth();

  // Developer-only guard.
  useEffect(() => {
    if (!loading && !isDeveloper) navigate({ to: "/auth", replace: true });
  }, [loading, isDeveloper, navigate]);

  const licensesQ = useQuery({
    queryKey: ["licenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("licenses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as License[];
    },
    enabled: isDeveloper,
  });

  const activationsQ = useQuery({
    queryKey: ["license_activations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("license_activations")
        .select("*")
        .order("activated_at", { ascending: false });
      if (error) throw error;
      return data as Activation[];
    },
    enabled: isDeveloper,
  });

  const licenses = licensesQ.data ?? [];
  const activations = activationsQ.data ?? [];

  const stats = useMemo(() => ({
    total: licenses.length,
    active: licenses.filter((l) => l.status === "Active").length,
    suspended: licenses.filter((l) => l.status === "Suspended").length,
    revoked: licenses.filter((l) => l.status === "Revoked").length,
    stores: activations.length,
  }), [licenses, activations]);

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const { error } = await supabase.from("licenses").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Statut de la licence mis à jour.");
      qc.invalidateQueries({ queryKey: ["licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Create license form
  const [newStore, setNewStore] = useState("");
  const [newKey, setNewKey] = useState(genKey());
  const [newMax, setNewMax] = useState("1");
  const [newNotes, setNewNotes] = useState("");
  const create = useMutation({
    mutationFn: async () => {
      const store = newStore.trim();
      if (!store) throw new Error("Nom de la boutique requis.");
      const { error } = await supabase.from("licenses").insert({
        license_key: newKey.trim(),
        store_name: store,
        max_users: Math.max(1, parseInt(newMax, 10) || 1),
        notes: newNotes.trim() || null,
        status: "Active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Licence créée.");
      setNewStore(""); setNewKey(genKey()); setNewMax("1"); setNewNotes("");
      qc.invalidateQueries({ queryKey: ["licenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [detail, setDetail] = useState<License | null>(null);

  if (!isDeveloper) return <div className="min-h-screen bg-background" />;

  return (
    <AppShell title="Gestion des licences">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <StatTile icon={KeyRound} label="Total licences" value={stats.total} />
          <StatTile icon={ShieldCheck} label="Actives" value={stats.active} />
          <StatTile icon={ShieldAlert} label="Suspendues" value={stats.suspended} />
          <StatTile icon={ShieldX} label="Révoquées" value={stats.revoked} />
          <StatTile icon={Store} label="Boutiques activées" value={stats.stores} />
        </div>

        {/* Create license */}
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              <h2 className="font-serif text-lg font-semibold">Nouvelle licence</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Nom de la boutique</Label>
                <Input value={newStore} onChange={(e) => setNewStore(e.target.value)} placeholder="Ex. Bijouterie El Nour" />
              </div>
              <div className="space-y-2">
                <Label>Clé de licence</Label>
                <div className="flex gap-2">
                  <Input className="font-mono" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                  <Button type="button" variant="outline" onClick={() => setNewKey(genKey())}>Générer</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Utilisateurs max</Label>
                <Input type="number" min={1} value={newMax} onChange={(e) => setNewMax(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Input value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="Optionnel" />
              </div>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
              <Plus className="h-4 w-4" /> Créer la licence
            </Button>
          </CardContent>
        </Card>

        {/* License list */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clé de licence</TableHead>
                    <TableHead>Boutique</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date d'activation</TableHead>
                    <TableHead>Dernière activité</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {licenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Aucune licence pour le moment.
                      </TableCell>
                    </TableRow>
                  )}
                  {licenses.map((l) => {
                    const meta = STATUS_META[l.status];
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">{l.license_key}</TableCell>
                        <TableCell>{l.store_name}</TableCell>
                        <TableCell>
                          <Badge variant={meta.variant} className="gap-1">
                            <meta.icon className="h-3 w-3" /> {meta.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.activation_date ? formatDateTime(l.activation_date) : "—"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {l.last_activity ? formatDateTime(l.last_activity) : "—"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" title="Détails" onClick={() => setDetail(l)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" title="Activer"
                              disabled={l.status === "Active" || setStatus.isPending}
                              onClick={() => setStatus.mutate({ id: l.id, status: "Active" })}
                            >
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" title="Suspendre"
                              disabled={l.status === "Suspended" || setStatus.isPending}
                              onClick={() => setStatus.mutate({ id: l.id, status: "Suspended" })}
                            >
                              <PauseCircle className="h-4 w-4 text-amber-600" />
                            </Button>
                            <Button
                              size="icon" variant="ghost" title="Révoquer"
                              disabled={l.status === "Revoked" || setStatus.isPending}
                              onClick={() => setStatus.mutate({ id: l.id, status: "Revoked" })}
                            >
                              <XCircle className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Détails de la licence</DialogTitle>
            <DialogDescription>{detail?.store_name}</DialogDescription>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Clé de licence</span>
                <span className="flex items-center gap-1 font-mono">
                  {detail.license_key}
                  <Button
                    size="icon" variant="ghost" className="h-6 w-6"
                    onClick={() => { navigator.clipboard?.writeText(detail.license_key); toast.success("Clé copiée."); }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </span>
              </div>
              <Row label="Statut" value={STATUS_META[detail.status].label} />
              <Row label="Utilisateurs max" value={String(detail.max_users)} />
              <Row label="Date d'activation" value={detail.activation_date ? formatDateTime(detail.activation_date) : "—"} />
              <Row label="Dernière activité" value={detail.last_activity ? formatDateTime(detail.last_activity) : "—"} />
              <Row label="Créée le" value={formatDateTime(detail.created_at)} />
              {detail.notes && <Row label="Notes" value={detail.notes} />}
              <div className="pt-2">
                <p className="mb-1 font-medium">Boutiques activées</p>
                {activations.filter((a) => a.license_id === detail.id).length === 0 ? (
                  <p className="text-muted-foreground">Aucune activation enregistrée.</p>
                ) : (
                  <ul className="space-y-1">
                    {activations.filter((a) => a.license_id === detail.id).map((a) => (
                      <li key={a.id} className="flex items-center justify-between rounded border px-2 py-1">
                        <span>{a.store_name}</span>
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.last_activity)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}
