import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Database, Download, Upload, RotateCcw, Trash2, ShieldAlert, Clock, HardDriveDownload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useStoreSettings, STORE_SETTINGS_QUERY_KEY } from "@/lib/store-settings";
import {
  createBackup, uploadBackup, recordBackupHistory, downloadBackup,
  parseBackupFile, restoreBackup, downloadStoredBackup, deleteStoredBackup,
  formatBytes, type ParsedBackup,
} from "@/lib/backup";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDateTime } from "@/lib/format";

interface BackupRow {
  id: string;
  file_name: string;
  store_name: string | null;
  size_bytes: number;
  record_counts: Record<string, number>;
  kind: string;
  created_by_name: string | null;
  storage_path: string | null;
  created_at: string;
}

const FREQUENCIES = [
  { value: "daily", label: "Quotidienne" },
  { value: "weekly", label: "Hebdomadaire" },
  { value: "monthly", label: "Mensuelle" },
];

export function BackupRestoreCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: settings } = useStoreSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pendingRestore, setPendingRestore] = useState<ParsedBackup | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackupRow | null>(null);

  // Auto-backup config (local mirror of settings)
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoFreq, setAutoFreq] = useState("weekly");
  const [autoTime, setAutoTime] = useState("02:00");
  const [autoInit, setAutoInit] = useState(false);
  if (settings && !autoInit) {
    setAutoEnabled(settings.auto_backup_enabled);
    setAutoFreq(settings.auto_backup_frequency);
    setAutoTime(settings.auto_backup_time);
    setAutoInit(true);
  }

  const profileName = user?.email ?? null;
  const storeName = settings?.store_name ?? "Boutique";

  const history = useQuery({
    queryKey: ["backups"],
    queryFn: async (): Promise<BackupRow[]> => {
      const { data, error } = await supabase
        .from("backups")
        .select("id, file_name, store_name, size_bytes, record_counts, kind, created_by_name, storage_path, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as BackupRow[];
    },
  });

  const backupNow = useMutation({
    mutationFn: async () => {
      const backup = await createBackup(storeName, profileName);
      let storagePath: string | null = null;
      try {
        storagePath = await uploadBackup(backup.blob, backup.fileName, user?.id ?? null);
      } catch {
        storagePath = null; // download still works even if cloud storage fails
      }
      await recordBackupHistory(backup, "manual", user?.id ?? null, profileName, storagePath);
      downloadBackup(backup.blob, backup.fileName);
    },
    onSuccess: () => {
      toast.success("Sauvegarde créée et téléchargée.");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async (data: Record<string, unknown[]>) => restoreBackup(data),
    onSuccess: (counts) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      toast.success(`Restauration terminée — ${total} enregistrements restaurés.`);
      setPendingRestore(null);
      // Refresh all cached data after a full restore.
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const restoreFromHistory = useMutation({
    mutationFn: async (row: BackupRow) => {
      if (!row.storage_path) throw new Error("Aucun fichier stocké pour cette sauvegarde.");
      const blob = await downloadStoredBackup(row.storage_path);
      const parsed = await parseBackupFile(new File([blob], row.file_name));
      return restoreBackup(parsed.data);
    },
    onSuccess: (counts) => {
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      toast.success(`Restauration terminée — ${total} enregistrements restaurés.`);
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadHistory = useMutation({
    mutationFn: async (row: BackupRow) => {
      if (!row.storage_path) throw new Error("Aucun fichier stocké pour cette sauvegarde.");
      const blob = await downloadStoredBackup(row.storage_path);
      downloadBackup(blob, row.file_name);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeBackup = useMutation({
    mutationFn: async (row: BackupRow) => {
      await deleteStoredBackup(row.storage_path);
      const { error } = await supabase.from("backups").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sauvegarde supprimée.");
      setDeleteTarget(null);
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveAuto = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("store_settings")
        .update({
          auto_backup_enabled: autoEnabled,
          auto_backup_frequency: autoFreq,
          auto_backup_time: autoTime,
        } as never)
        .eq("singleton", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Préférences de sauvegarde enregistrées.");
      qc.invalidateQueries({ queryKey: STORE_SETTINGS_QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = await parseBackupFile(file);
      setPendingRestore(parsed);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fichier invalide.");
    }
  }

  const busy = backupNow.isPending || restore.isPending || restoreFromHistory.isPending;

  return (
    <div className="space-y-6">
      {/* Manual backup + restore */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Sauvegarde &amp; Restauration
          </CardTitle>
          <CardDescription>
            Créez une archive complète (.zip) de toutes les données de l'application
            (stock, parures, or cassé, ventes, factures, clients, fournisseurs, dépenses,
            utilisateurs, paramètres, rapports, journaux d'activité) ou restaurez une
            sauvegarde précédente.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => backupNow.mutate()} disabled={busy}>
              <Download className="mr-2 h-4 w-4" />
              {backupNow.isPending ? "Sauvegarde…" : "Sauvegarder maintenant"}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Upload className="mr-2 h-4 w-4" /> Restaurer une sauvegarde
            </Button>
            <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={onFileSelected} />
          </div>
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-muted-foreground">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p>
              La restauration <strong>remplace toutes les données actuelles</strong> par
              le contenu de la sauvegarde. Cette opération est irréversible — créez une
              sauvegarde récente au préalable.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Automatic backups */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Sauvegardes automatiques
          </CardTitle>
          <CardDescription>
            Générez automatiquement une sauvegarde stockée en ligne selon la fréquence choisie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="font-medium">Activer les sauvegardes automatiques</p>
              <p className="text-sm text-muted-foreground">Exécutées par un administrateur connecté lorsqu'elles sont dues.</p>
            </div>
            <Switch checked={autoEnabled} onCheckedChange={setAutoEnabled} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Fréquence</Label>
              <Select value={autoFreq} onValueChange={setAutoFreq} disabled={!autoEnabled}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="auto-time">Heure</Label>
              <Input id="auto-time" type="time" value={autoTime} disabled={!autoEnabled}
                onChange={(e) => setAutoTime(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Dernière sauvegarde auto : {settings?.last_auto_backup_at ? formatDateTime(settings.last_auto_backup_at) : "—"}
            </p>
            <Button variant="outline" size="sm" onClick={() => saveAuto.mutate()} disabled={saveAuto.isPending}>
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDriveDownload className="h-5 w-5 text-primary" /> Historique des sauvegardes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {history.isLoading ? (
            <p className="text-sm text-muted-foreground">Chargement…</p>
          ) : (history.data ?? []).length === 0 ? (
            <p className="text-sm italic text-muted-foreground">Aucune sauvegarde enregistrée.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fichier</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Taille</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(history.data ?? []).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[220px] truncate font-medium">{row.file_name}</TableCell>
                      <TableCell className="text-sm">{formatDateTime(row.created_at)}</TableCell>
                      <TableCell className="text-sm">{formatBytes(row.size_bytes)}</TableCell>
                      <TableCell>
                        <Badge variant={row.kind === "auto" ? "secondary" : "outline"}>
                          {row.kind === "auto" ? "Auto" : "Manuel"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{row.created_by_name ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Télécharger"
                            disabled={!row.storage_path || downloadHistory.isPending}
                            onClick={() => downloadHistory.mutate(row)}>
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Restaurer"
                            disabled={!row.storage_path || busy}
                            onClick={() => restoreFromHistory.mutate(row)}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Supprimer"
                            onClick={() => setDeleteTarget(row)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore confirmation */}
      <AlertDialog open={!!pendingRestore} onOpenChange={(o) => !o && setPendingRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la restauration</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Toutes les données actuelles seront <strong>définitivement remplacées</strong> par
                  le contenu de cette sauvegarde
                  {pendingRestore?.manifest?.created_at
                    ? ` du ${formatDateTime(pendingRestore.manifest.created_at)}`
                    : ""}.
                </p>
                {pendingRestore?.manifest && (
                  <p className="text-muted-foreground">
                    Boutique : {pendingRestore.manifest.store_name} ·{" "}
                    {Object.values(pendingRestore.manifest.record_counts).reduce((a, b) => a + b, 0)} enregistrements.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRestore && restore.mutate(pendingRestore.data)}
              disabled={restore.isPending}>
              {restore.isPending ? "Restauration…" : "Restaurer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la sauvegarde ?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.file_name} sera supprimée définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && removeBackup.mutate(deleteTarget)}
              disabled={removeBackup.isPending}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
