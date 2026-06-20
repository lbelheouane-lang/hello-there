import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  ShieldCheck,
  History,
  Lock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  PERMISSION_KEYS, PERMISSION_LABELS, DEFAULT_EMPLOYEE_PERMISSIONS,
  type PermissionKey,
} from "@/lib/permissions";
import {
  listEmployees, createEmployee, updateEmployee, setEmployeeActive,
  deleteEmployee, resetEmployeePin, changeOwnPin, listPinAudit,
  type EmployeeRow,
} from "@/lib/employees.functions";

function fmtDate(s: string | null) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

const isValidPin = (p: string) => /^\d{4,8}$/.test(p);

// ===========================================================================
// Employees
// ===========================================================================

export function EmployeesCard() {
  const qc = useQueryClient();
  const list = useServerFn(listEmployees);
  const { data: employees } = useQuery({
    queryKey: ["employees"],
    queryFn: () => list(),
  });

  const [editing, setEditing] = useState<EmployeeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetting, setResetting] = useState<EmployeeRow | null>(null);
  const [deleting, setDeleting] = useState<EmployeeRow | null>(null);

  const activate = useServerFn(setEmployeeActive);
  const del = useServerFn(deleteEmployee);

  const refresh = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const toggleActive = useMutation({
    mutationFn: (e: EmployeeRow) => activate({ data: { id: e.id, active: !e.is_active } }),
    onSuccess: () => { toast.success("Statut mis à jour."); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMut = useMutation({
    mutationFn: (e: EmployeeRow) => del({ data: { id: e.id } }),
    onSuccess: () => { toast.success("Employé supprimé."); setDeleting(null); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Employés
            </CardTitle>
            <CardDescription>
              Gérez les comptes du personnel, leurs rôles et leurs accès.
            </CardDescription>
          </div>
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-2 h-4 w-4" /> Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Identifiant</TableHead>
                <TableHead>Téléphone</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead>Dernière connexion</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(employees ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {`${e.first_name} ${e.last_name}`.trim() || "—"}
                    {e.is_bootstrap && <Badge variant="secondary" className="ml-2">défaut</Badge>}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{e.username}</TableCell>
                  <TableCell>{e.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant={e.role === "admin" ? "default" : "outline"}>
                      {e.role === "admin" ? "Administrateur" : "Employé"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={e.is_active}
                        onCheckedChange={() => toggleActive.mutate(e)}
                        aria-label="Activer/désactiver"
                      />
                      <span className="text-xs text-muted-foreground">
                        {e.is_active ? "Actif" : "Inactif"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(e.created_at)}</TableCell>
                  <TableCell className="text-muted-foreground">{fmtDate(e.last_login_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Modifier" onClick={() => setEditing(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Réinitialiser le PIN" onClick={() => setResetting(e)}>
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {!e.is_bootstrap && (
                        <Button variant="ghost" size="icon" title="Supprimer" onClick={() => setDeleting(e)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(employees ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    Aucun employé pour le moment.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {creating && <EmployeeDialog onClose={() => setCreating(false)} onSaved={refresh} />}
      {editing && <EmployeeDialog employee={editing} onClose={() => setEditing(null)} onSaved={refresh} />}
      {resetting && <ResetPinDialog employee={resetting} onClose={() => setResetting(null)} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet employé ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le compte de {deleting ? `${deleting.first_name} ${deleting.last_name}`.trim() || deleting.username : ""} sera
              définitivement supprimé et ne pourra plus se connecter. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleting && removeMut.mutate(deleting)}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function EmployeeDialog({
  employee, onClose, onSaved,
}: {
  employee?: EmployeeRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!employee;
  const create = useServerFn(createEmployee);
  const update = useServerFn(updateEmployee);

  const [firstName, setFirstName] = useState(employee?.first_name ?? "");
  const [lastName, setLastName] = useState(employee?.last_name ?? "");
  const [username, setUsername] = useState(employee?.username ?? "");
  const [phone, setPhone] = useState(employee?.phone ?? "");
  const [role, setRole] = useState<"admin" | "employe">(employee?.role ?? "employe");
  const [pin, setPin] = useState("");
  const [perms, setPerms] = useState<PermissionKey[]>(
    (employee?.permissions as PermissionKey[]) ?? DEFAULT_EMPLOYEE_PERMISSIONS,
  );

  const togglePerm = (k: PermissionKey) =>
    setPerms((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const save = useMutation({
    mutationFn: async () => {
      if (!firstName.trim()) throw new Error("Le prénom est requis.");
      if (isEdit) {
        return update({
          data: {
            id: employee!.id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phone: phone.trim(),
            role,
            permissions: perms,
          },
        });
      }
      if (!username.trim()) throw new Error("L'identifiant est requis.");
      if (!isValidPin(pin)) throw new Error("Le PIN doit comporter 4 à 8 chiffres.");
      return create({
        data: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          username: username.trim(),
          phone: phone.trim(),
          role,
          permissions: perms,
          pin,
        },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Employé mis à jour." : "Employé créé.");
      onSaved();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'employé" : "Nouvel employé"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Mettez à jour les informations et les accès de cet employé."
              : "Créez un compte avec un identifiant et un code PIN de connexion."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Prénom</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Nom</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Identifiant</Label>
              <Input
                value={username}
                disabled={isEdit}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="ex. samira"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Téléphone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "employe")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="employe">Employé</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {!isEdit && (
              <div className="space-y-1.5">
                <Label>Code PIN (4 à 8 chiffres)</Label>
                <Input
                  inputMode="numeric"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="••••"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Permissions d'accès</Label>
            {role === "admin" ? (
              <p className="text-sm text-muted-foreground">
                Les administrateurs ont accès à tous les modules.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3">
                {PERMISSION_KEYS.map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={perms.includes(k)} onCheckedChange={() => togglePerm(k)} />
                    {PERMISSION_LABELS[k]}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {isEdit ? "Enregistrer" : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPinDialog({ employee, onClose }: { employee: EmployeeRow; onClose: () => void }) {
  const reset = useServerFn(resetEmployeePin);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!isValidPin(pin)) throw new Error("Le PIN doit comporter 4 à 8 chiffres.");
      if (pin !== confirm) throw new Error("La confirmation ne correspond pas.");
      return reset({ data: { employeeId: employee.id, newPin: pin } });
    },
    onSuccess: () => { toast.success("PIN réinitialisé."); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Réinitialiser le PIN</DialogTitle>
          <DialogDescription>
            Définissez un nouveau code PIN pour {`${employee.first_name} ${employee.last_name}`.trim() || employee.username}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-1.5">
            <Label>Nouveau PIN</Label>
            <Input inputMode="numeric" value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmer le PIN</Label>
            <Input inputMode="numeric" value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Réinitialiser</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===========================================================================
// PIN Management (change own PIN)
// ===========================================================================

export function ChangeOwnPinCard() {
  const change = useServerFn(changeOwnPin);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!isValidPin(current)) throw new Error("PIN actuel invalide.");
      if (!isValidPin(next)) throw new Error("Le nouveau PIN doit comporter 4 à 8 chiffres.");
      if (next !== confirm) throw new Error("La confirmation ne correspond pas.");
      return change({ data: { currentPin: current, newPin: next } });
    },
    onSuccess: () => {
      toast.success("Votre PIN a été modifié.");
      setCurrent(""); setNext(""); setConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-primary" /> Gestion du PIN
        </CardTitle>
        <CardDescription>
          Modifiez votre propre code PIN. Le PIN actuel est requis pour confirmer le changement.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:max-w-md">
        <div className="space-y-1.5">
          <Label>PIN actuel</Label>
          <Input inputMode="numeric" value={current}
            onChange={(e) => setCurrent(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        </div>
        <div className="space-y-1.5">
          <Label>Nouveau PIN (4 à 8 chiffres)</Label>
          <Input inputMode="numeric" value={next}
            onChange={(e) => setNext(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        </div>
        <div className="space-y-1.5">
          <Label>Confirmer le nouveau PIN</Label>
          <Input inputMode="numeric" value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, "").slice(0, 8))} />
        </div>
        <div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <ShieldCheck className="mr-2 h-4 w-4" /> Modifier mon PIN
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ===========================================================================
// System logs (PIN history)
// ===========================================================================

const ACTION_LABELS: Record<string, string> = {
  created: "Compte créé (PIN initial)",
  changed: "PIN modifié",
  reset: "PIN réinitialisé",
};

export function PinAuditCard() {
  const listAudit = useServerFn(listPinAudit);
  const { data } = useQuery({ queryKey: ["pin-audit"], queryFn: () => listAudit() });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" /> Journal système — PIN
        </CardTitle>
        <CardDescription>
          Historique des changements et réinitialisations de code PIN.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Effectué par</TableHead>
                <TableHead>Concerne</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="text-muted-foreground">{fmtDate(row.created_at)}</TableCell>
                  <TableCell>{ACTION_LABELS[row.action] ?? row.action}</TableCell>
                  <TableCell>{row.actor_name ?? "—"}</TableCell>
                  <TableCell>{row.target_name ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Aucune activité enregistrée.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
