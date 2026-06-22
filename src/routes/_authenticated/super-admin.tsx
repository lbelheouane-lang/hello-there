import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Building2,
  Ticket,
  KeyRound,
  LayoutDashboard,
  Plus,
  Copy,
  Power,
  Trash2,
  RefreshCw,
  Loader2,
  Link as LinkIcon,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  getSuperAdminStats,
  listClients,
  createClient,
  setClientStatus,
  deleteClient,
  listInvitations,
  createInvitation,
  setInvitationDisabled,
  deleteInvitation,
  listAccessKeys,
  createAccessKey,
  setAccessKeyStatus,
  regenerateAccessKey,
  deleteAccessKey,
  type ClientRow,
  type InvitationRow,
  type AccessKeyRow,
  type SuperAdminStats,
} from "@/lib/super-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin", name: "robots", content: "noindex,nofollow" }] }),
  component: SuperAdminGate,
});

function SuperAdminGate() {
  const { isSuperAdmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin) navigate({ to: "/dashboard", replace: true });
  }, [loading, isSuperAdmin, navigate]);

  if (loading || !isSuperAdmin) return <div className="min-h-screen bg-background" />;
  return <SuperAdminPanel />;
}

function SuperAdminPanel() {
  const navigate = useNavigate();
  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-serif text-3xl font-semibold">Super Administration</h1>
            <p className="text-sm text-muted-foreground">
              Gestion privée des clients, invitations et clés d'accès.
            </p>
          </div>
          <Button variant="ghost" onClick={signOut} className="gap-2">
            <LogOut className="h-4 w-4" /> Déconnexion
          </Button>
        </header>

        <Tabs defaultValue="dashboard">
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="gap-2">
              <LayoutDashboard className="h-4 w-4" /> Tableau de bord
            </TabsTrigger>
            <TabsTrigger value="clients" className="gap-2">
              <Building2 className="h-4 w-4" /> Clients
            </TabsTrigger>
            <TabsTrigger value="invitations" className="gap-2">
              <Ticket className="h-4 w-4" /> Invitations
            </TabsTrigger>
            <TabsTrigger value="keys" className="gap-2">
              <KeyRound className="h-4 w-4" /> Clés d'accès
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <DashboardTab />
          </TabsContent>
          <TabsContent value="clients">
            <ClientsTab />
          </TabsContent>
          <TabsContent value="invitations">
            <InvitationsTab />
          </TabsContent>
          <TabsContent value="keys">
            <AccessKeysTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// Dashboard
// --------------------------------------------------------------------------

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-serif text-3xl font-semibold text-primary">{value}</p>
      </CardContent>
    </Card>
  );
}

function DashboardTab() {
  const load = useServerFn(getSuperAdminStats);
  const [s, setS] = useState<SuperAdminStats | null>(null);
  useEffect(() => {
    load().then(setS).catch(() => undefined);
  }, [load]);

  if (!s) return <Loading />;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total clients" value={s.totalClients} />
        <StatCard label="Clients actifs" value={s.activeClients} />
        <StatCard label="Clients suspendus" value={s.suspendedClients} />
        <StatCard label="Utilisateurs" value={s.totalUsers} />
        <StatCard label="Invitations actives" value={s.activeInvitations} />
        <StatCard label="Invitations expirées" value={s.expiredInvitations} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connexions récentes</CardTitle>
        </CardHeader>
        <CardContent>
          {s.recentLogins.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune connexion enregistrée.</p>
          ) : (
            <ul className="space-y-2">
              {s.recentLogins.map((l, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span>{l.name}</span>
                  <span className="text-muted-foreground">{formatDateTime(l.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --------------------------------------------------------------------------
// Clients
// --------------------------------------------------------------------------

function ClientsTab() {
  const load = useServerFn(listClients);
  const create = useServerFn(createClient);
  const setStatus = useServerFn(setClientStatus);
  const remove = useServerFn(deleteClient);
  const makeInvite = useServerFn(createInvitation);

  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    load()
      .then(setRows)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(refresh, [refresh]);

  async function submit() {
    if (!companyName.trim()) return;
    setBusy(true);
    try {
      await create({ data: { companyName, contactName, email } });
      toast.success("Client créé.");
      setOpen(false);
      setCompanyName("");
      setContactName("");
      setEmail("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function generateInvite(c: ClientRow) {
    try {
      const res = await makeInvite({ data: { clientId: c.id, grantRole: "admin", maxUses: 1, expiresInDays: 7 } });
      const link = `${window.location.origin}/invite/${res.code}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Invitation créée — lien copié", { description: link });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Clients</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Créer un client
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun client.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Société</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead>Dern. connexion</TableHead>
                <TableHead className="text-center">Users</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.company_name}</TableCell>
                  <TableCell className="text-sm">
                    {c.contact_name || "—"}
                    {c.email && <div className="text-xs text-muted-foreground">{c.email}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : "secondary"}>
                      {c.status === "active" ? "Actif" : "Suspendu"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(c.created_at)}</TableCell>
                  <TableCell className="text-sm">
                    {c.last_login_at ? formatDate(c.last_login_at) : "—"}
                  </TableCell>
                  <TableCell className="text-center">{c.user_count}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" title="Générer une invitation" onClick={() => generateInvite(c)}>
                        <LinkIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={c.status === "active" ? "Suspendre" : "Activer"}
                        onClick={async () => {
                          await setStatus({ data: { id: c.id, status: c.status === "active" ? "suspended" : "active" } });
                          refresh();
                        }}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Supprimer"
                        onClick={async () => {
                          if (!confirm(`Supprimer ${c.company_name} et tous ses utilisateurs ?`)) return;
                          await remove({ data: { id: c.id } });
                          toast.success("Client supprimé.");
                          refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau client</DialogTitle>
            <DialogDescription>Créez une société cliente, puis générez son invitation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom de la société *</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nom du contact</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Invitations
// --------------------------------------------------------------------------

function InvitationsTab() {
  const load = useServerFn(listInvitations);
  const loadClients = useServerFn(listClients);
  const create = useServerFn(createInvitation);
  const setDisabled = useServerFn(setInvitationDisabled);
  const remove = useServerFn(deleteInvitation);

  const [rows, setRows] = useState<InvitationRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [grantRole, setGrantRole] = useState<"admin" | "employe">("admin");
  const [maxUses, setMaxUses] = useState(1);
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([load(), loadClients()])
      .then(([inv, cl]) => {
        setRows(inv);
        setClients(cl);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [load, loadClients]);
  useEffect(refresh, [refresh]);

  async function submit() {
    if (!clientId) {
      toast.error("Choisissez un client.");
      return;
    }
    setBusy(true);
    try {
      const res = await create({ data: { clientId, grantRole, maxUses, expiresInDays } });
      const link = `${window.location.origin}/invite/${res.code}`;
      await navigator.clipboard.writeText(link).catch(() => undefined);
      toast.success("Invitation créée — lien copié", { description: link });
      setOpen(false);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function statusBadge(i: InvitationRow) {
    if (i.disabled) return <Badge variant="secondary">Désactivée</Badge>;
    if (i.used_count >= i.max_uses) return <Badge variant="secondary">Utilisée</Badge>;
    if (i.expires_at && new Date(i.expires_at).getTime() < Date.now())
      return <Badge variant="secondary">Expirée</Badge>;
    return <Badge>Active</Badge>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Invitations</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nouvelle invitation
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune invitation.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Expire</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-sm">{i.code}</TableCell>
                  <TableCell className="text-sm">{i.client_name || "—"}</TableCell>
                  <TableCell className="text-sm">{i.grant_role === "admin" ? "Admin" : "Employé"}</TableCell>
                  <TableCell className="text-sm">{i.used_count}/{i.max_uses}</TableCell>
                  <TableCell className="text-sm">{i.expires_at ? formatDate(i.expires_at) : "Jamais"}</TableCell>
                  <TableCell>{statusBadge(i)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Copier le lien"
                        onClick={() => {
                          const link = `${window.location.origin}/invite/${i.code}`;
                          navigator.clipboard.writeText(link).catch(() => undefined);
                          toast.success("Lien copié", { description: link });
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={i.disabled ? "Réactiver" : "Désactiver"}
                        onClick={async () => {
                          await setDisabled({ data: { id: i.id, disabled: !i.disabled } });
                          refresh();
                        }}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Supprimer"
                        onClick={async () => {
                          await remove({ data: { id: i.id } });
                          refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle invitation</DialogTitle>
            <DialogDescription>Génère un lien unique pour créer un compte.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Rôle accordé</Label>
              <Select value={grantRole} onValueChange={(v) => setGrantRole(v as "admin" | "employe")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur client</SelectItem>
                  <SelectItem value="employe">Employé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Utilisations max</Label>
                <Input type="number" min={1} max={100} value={maxUses} onChange={(e) => setMaxUses(Math.max(1, Number(e.target.value)))} />
              </div>
              <div className="space-y-1.5">
                <Label>Expire après (jours, 0 = jamais)</Label>
                <Input type="number" min={0} max={365} value={expiresInDays} onChange={(e) => setExpiresInDays(Math.max(0, Number(e.target.value)))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Access keys
// --------------------------------------------------------------------------

function AccessKeysTab() {
  const load = useServerFn(listAccessKeys);
  const loadClients = useServerFn(listClients);
  const create = useServerFn(createAccessKey);
  const setStatus = useServerFn(setAccessKeyStatus);
  const regen = useServerFn(regenerateAccessKey);
  const remove = useServerFn(deleteAccessKey);

  const [rows, setRows] = useState<AccessKeyRow[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("none");
  const [expiresInDays, setExpiresInDays] = useState(0);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([load(), loadClients()])
      .then(([k, cl]) => {
        setRows(k);
        setClients(cl);
      })
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }, [load, loadClients]);
  useEffect(refresh, [refresh]);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await create({
        data: { name, clientId: clientId === "none" ? null : clientId, expiresInDays },
      });
      await navigator.clipboard.writeText(res.key).catch(() => undefined);
      toast.success("Clé générée — copiée", { description: res.key });
      setOpen(false);
      setName("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Clés d'accès</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Générer une clé
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune clé.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Clé</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Créée</TableHead>
                <TableHead>Expire</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="font-mono text-xs">{k.key_value}</TableCell>
                  <TableCell className="text-sm">{k.client_name || "—"}</TableCell>
                  <TableCell className="text-sm">{formatDate(k.created_at)}</TableCell>
                  <TableCell className="text-sm">{k.expires_at ? formatDate(k.expires_at) : "Jamais"}</TableCell>
                  <TableCell className="text-sm">{k.usage_count}</TableCell>
                  <TableCell>
                    <Badge variant={k.status === "active" ? "default" : "secondary"}>
                      {k.status === "active" ? "Active" : "Désactivée"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Copier"
                        onClick={() => {
                          navigator.clipboard.writeText(k.key_value).catch(() => undefined);
                          toast.success("Clé copiée");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Régénérer"
                        onClick={async () => {
                          await regen({ data: { id: k.id } });
                          toast.success("Clé régénérée.");
                          refresh();
                        }}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title={k.status === "active" ? "Désactiver" : "Activer"}
                        onClick={async () => {
                          await setStatus({ data: { id: k.id, status: k.status === "active" ? "disabled" : "active" } });
                          refresh();
                        }}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Supprimer"
                        onClick={async () => {
                          await remove({ data: { id: k.id } });
                          refresh();
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouvelle clé d'accès</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nom de la clé *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Client assigné</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucun</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Expire après (jours, 0 = jamais)</Label>
              <Input type="number" min={0} value={expiresInDays} onChange={(e) => setExpiresInDays(Math.max(0, Number(e.target.value)))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Loading() {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" /> Chargement…
    </div>
  );
}
