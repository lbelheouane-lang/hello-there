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
  Fingerprint,
  Users,
  Search,
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
import {
  listPasskeys,
  createPasskey,
  setPasskeyDisabled,
  deletePasskey,
  listUsers,
  setUserDisabled,
  deleteUser,
  resetUserPassword,
  createUserAccount,
  type PasskeyRow,
  type ManagedUserRow,
} from "@/lib/passkey-auth.functions";
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
    if (!loading && !isSuperAdmin) {
      toast.error("Accès refusé");
      navigate({ to: "/dashboard", replace: true });
    }
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
            <TabsTrigger value="passkeys" className="gap-2">
              <Fingerprint className="h-4 w-4" /> Passkeys
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="h-4 w-4" /> Utilisateurs
            </TabsTrigger>
            <TabsTrigger value="sa-access" className="gap-2">
              <ShieldCheck className="h-4 w-4" /> Accès Super Admin
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
          <TabsContent value="passkeys">
            <PasskeysTab />
          </TabsContent>
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="sa-access">
            <SuperAdminAccessTab />
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

// --------------------------------------------------------------------------
// Passkeys
// --------------------------------------------------------------------------

const PASSKEY_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  used: "Utilisée",
  expired: "Expirée",
  disabled: "Désactivée",
};

function PasskeyStatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "default"
      : status === "used"
        ? "secondary"
        : "outline";
  return <Badge variant={variant}>{PASSKEY_STATUS_LABEL[status] ?? status}</Badge>;
}

function PasskeysTab() {
  const load = useServerFn(listPasskeys);
  const create = useServerFn(createPasskey);
  const setDisabled = useServerFn(setPasskeyDisabled);
  const remove = useServerFn(deletePasskey);

  const [rows, setRows] = useState<PasskeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("0");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const refresh = useCallback(() => {
    setLoading(true);
    load()
      .then(setRows)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(refresh, [refresh]);

  async function submit() {
    setBusy(true);
    try {
      const res = await create({
        data: { label: label.trim(), expiresInDays: Number(expiresInDays) || 0 },
      });
      await navigator.clipboard.writeText(res.code).catch(() => undefined);
      toast.success("Passkey créée — copiée", { description: res.code });
      setOpen(false);
      setLabel("");
      setExpiresInDays("0");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const filtered = rows.filter((r) => {
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      r.code.toLowerCase().includes(q) ||
      (r.label ?? "").toLowerCase().includes(q) ||
      (r.used_by_email ?? "").toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Passkeys d'inscription</CardTitle>
        <Button size="sm" onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Générer une passkey
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (code, libellé, e-mail)…"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="used">Utilisée</SelectItem>
              <SelectItem value="expired">Expirée</SelectItem>
              <SelectItem value="disabled">Désactivée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune passkey.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Passkey</TableHead>
                <TableHead>Libellé</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Utilisée par</TableHead>
                <TableHead>Le</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell>{r.label ?? "—"}</TableCell>
                  <TableCell>
                    <PasskeyStatusBadge status={r.status} />
                  </TableCell>
                  <TableCell>{r.used_by_email ?? "—"}</TableCell>
                  <TableCell>{r.used_at ? formatDateTime(r.used_at) : "—"}</TableCell>
                  <TableCell>{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Copier"
                        onClick={() => {
                          navigator.clipboard.writeText(r.code).catch(() => undefined);
                          toast.success("Copiée");
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {r.status !== "used" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          title={r.disabled ? "Réactiver" : "Désactiver"}
                          onClick={async () => {
                            try {
                              await setDisabled({ data: { id: r.id, disabled: !r.disabled } });
                              refresh();
                            } catch (e) {
                              toast.error((e as Error).message);
                            }
                          }}
                        >
                          <Power className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Supprimer"
                        onClick={async () => {
                          if (!confirm("Supprimer cette passkey ?")) return;
                          try {
                            await remove({ data: { id: r.id } });
                            refresh();
                          } catch (e) {
                            toast.error((e as Error).message);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
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
            <DialogTitle>Générer une passkey</DialogTitle>
            <DialogDescription>
              La passkey permet à une personne de créer un compte (rôle Client).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pk-label">Libellé (optionnel)</Label>
              <Input
                id="pk-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex. Client boutique centre-ville"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pk-exp">Expiration (jours, 0 = jamais)</Label>
              <Input
                id="pk-exp"
                type="number"
                min={0}
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submit} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// --------------------------------------------------------------------------
// Users
// --------------------------------------------------------------------------

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Administrateur",
  developer: "Développeur",
  employe: "Employé",
  client: "Client",
};

function UsersTab() {
  const load = useServerFn(listUsers);
  const setDisabled = useServerFn(setUserDisabled);
  const remove = useServerFn(deleteUser);
  const resetPwd = useServerFn(resetUserPassword);
  const createAcc = useServerFn(createUserAccount);

  const [rows, setRows] = useState<ManagedUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Reset password dialog
  const [pwdUser, setPwdUser] = useState<ManagedUserRow | null>(null);
  const [newPwd, setNewPwd] = useState("");

  // Create account dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [cFullName, setCFullName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cPwd, setCPwd] = useState("");
  const [cRole, setCRole] = useState("admin");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    load()
      .then(setRows)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(refresh, [refresh]);

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    return (
      !q ||
      (r.email ?? "").toLowerCase().includes(q) ||
      (r.full_name ?? "").toLowerCase().includes(q) ||
      r.role.toLowerCase().includes(q)
    );
  });

  async function submitReset() {
    if (!pwdUser || newPwd.length < 8) {
      toast.error("Mot de passe : 8 caractères minimum.");
      return;
    }
    setBusy(true);
    try {
      await resetPwd({ data: { id: pwdUser.id, password: newPwd } });
      toast.success("Mot de passe réinitialisé.");
      setPwdUser(null);
      setNewPwd("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function submitCreate() {
    if (!cFullName.trim() || !cEmail.trim() || cPwd.length < 8) {
      toast.error("Renseignez nom, e-mail et mot de passe (8+ caractères).");
      return;
    }
    setBusy(true);
    try {
      await createAcc({
        data: {
          fullName: cFullName.trim(),
          email: cEmail.trim(),
          password: cPwd,
          role: cRole as "admin" | "employe" | "client",
        },
      });
      toast.success("Compte créé.");
      setCreateOpen(false);
      setCFullName("");
      setCEmail("");
      setCPwd("");
      setCRole("admin");
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
        <CardTitle className="text-base">Utilisateurs</CardTitle>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Créer un compte
        </Button>
      </CardHeader>
      <CardContent>
        <div className="mb-4 relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher (nom, e-mail, rôle)…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <Loading />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun utilisateur.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Passkey</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.full_name ?? "—"}</TableCell>
                  <TableCell>{r.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABEL[r.role] ?? r.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {r.disabled ? (
                      <Badge variant="outline">Désactivé</Badge>
                    ) : (
                      <Badge>Actif</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{r.signup_passkey ?? "—"}</TableCell>
                  <TableCell>{formatDate(r.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        title="Réinitialiser le mot de passe"
                        onClick={() => {
                          setPwdUser(r);
                          setNewPwd("");
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {r.role !== "super_admin" && (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={r.disabled ? "Réactiver" : "Désactiver"}
                            onClick={async () => {
                              try {
                                await setDisabled({ data: { id: r.id, disabled: !r.disabled } });
                                refresh();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Power className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Supprimer"
                            onClick={async () => {
                              if (!confirm("Supprimer définitivement ce compte ?")) return;
                              try {
                                await remove({ data: { id: r.id } });
                                refresh();
                              } catch (e) {
                                toast.error((e as Error).message);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Reset password dialog */}
      <Dialog open={!!pwdUser} onOpenChange={(o) => !o && setPwdUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>{pwdUser?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
            <Input
              id="new-pwd"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="8 caractères minimum"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwdUser(null)}>
              Annuler
            </Button>
            <Button onClick={submitReset} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create account dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Créer un compte</DialogTitle>
            <DialogDescription>Crée directement un compte utilisateur.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">Nom complet</Label>
              <Input id="c-name" value={cFullName} onChange={(e) => setCFullName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">E-mail</Label>
              <Input
                id="c-email"
                type="email"
                value={cEmail}
                onChange={(e) => setCEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-pwd">Mot de passe</Label>
              <Input
                id="c-pwd"
                type="password"
                value={cPwd}
                onChange={(e) => setCPwd(e.target.value)}
                placeholder="8 caractères minimum"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={cRole} onValueChange={setCRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrateur</SelectItem>
                  <SelectItem value="employe">Employé</SelectItem>
                  <SelectItem value="client">Client</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Annuler
            </Button>
            <Button onClick={submitCreate} disabled={busy} className="gap-2">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Créer
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
