import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Coins, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Wifi, WifiOff, Gauge,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/data-client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KARATS, formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { formatEUR, formatFromEUR, formatCurrency } from "@/lib/currency";
import { useLatestGoldPrices, type GoldPrice } from "@/hooks/use-gold-prices";
import { useStoreSettings } from "@/lib/store-settings";
import { refreshGoldPrices } from "@/lib/gold-prices.functions";

export const Route = createFileRoute("/_authenticated/cours-or")({
  component: GoldPricePage,
});

interface SyncLog {
  id: string;
  status: string;
  source: string;
  data_source: string | null;
  currency: string;
  price_per_ounce_eur: number | null;
  price_per_gram_eur: number | null;
  usd_eur_rate: number | null;
  eur_dzd_rate: number | null;
  goldrepublic_price_eur: number | null;
  app_price_eur: number | null;
  discrepancy_eur: number | null;
  discrepancy_pct: number | null;
  threshold_pct: number | null;
  alert: boolean;
  fallback_used: boolean;
  manual_override: boolean;
  attempts: number;
  products_recalculated: number;
  error: string | null;
  created_at: string;
}

export function GoldPricePage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const { data: latest } = useLatestGoldPrices();
  const { data: settings } = useStoreSettings();
  const [draft, setDraft] = useState<Record<number, string>>({});
  const refresh = useServerFn(refreshGoldPrices);
  const [syncing, setSyncing] = useState(false);

  const logs = useQuery({
    queryKey: ["gold_sync_logs"],
    enabled: isAdmin,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gold_sync_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncLog[];
    },
  });

  const history = useQuery({
    queryKey: ["gold_prices", "history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gold_prices")
        .select("*")
        .order("price_date", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as GoldPrice[];
    },
  });

  const lastLog = logs.data?.[0];
  const lastOk = logs.data?.find((l) => l.status !== "failed");
  const connected = !!lastOk && !lastOk.fallback_used && lastOk.data_source?.startsWith("live");

  // ---- Manual gold-price entry (per karat, EUR/g) ----
  const save = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const rows = KARATS.filter((k) => draft[k] && Number(draft[k]) > 0).map((k) => ({
        karat: k,
        price_per_gram: Number(draft[k]),
        currency: "EUR",
        price_date: today,
        source: "manuel",
      }));
      if (rows.length === 0) throw new Error("Saisissez au moins un cours.");
      const { error } = await supabase.from("gold_prices").upsert(rows, { onConflict: "karat,price_date" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cours enregistrés");
      setDraft({});
      qc.invalidateQueries({ queryKey: ["gold_prices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ---- Gold config (exchange rate, override, threshold, auto-sync) ----
  const saveConfig = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const { error } = await supabase.from("store_settings").update(patch as never).eq("singleton", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["store-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [rateDraft, setRateDraft] = useState<string>("");
  const [thresholdDraft, setThresholdDraft] = useState<string>("");
  const [manualPriceDraft, setManualPriceDraft] = useState<string>("");

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await refresh();
      if (res.ok) {
        toast.success(
          `Cours mis à jour — ${res.source} · ${res.productsRecalculated} produit(s) recalculé(s)`,
        );
        if (res.alert) {
          toast.warning(`Écart de ${res.discrepancyPct.toFixed(2)}% détecté avec la référence.`);
        }
      } else {
        toast.error(`Échec de synchronisation : ${res.error ?? "source indisponible"}`);
      }
      qc.invalidateQueries({ queryKey: ["gold_prices"] });
      qc.invalidateQueries({ queryKey: ["gold_sync_logs"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const eurToDzd = settings?.eur_to_dzd ?? 280;

  return (
    <AppShell title="Cours de l'or" allow={["admin"]}>
      {/* Discrepancy alert */}
      {isAdmin && lastLog?.alert && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Écart de cours détecté</AlertTitle>
          <AlertDescription>
            Le prix appliqué diffère de la référence de{" "}
            <strong>{lastLog.discrepancy_pct?.toFixed(2)}%</strong>{" "}
            (seuil : {lastLog.threshold_pct}%). Vérifiez la source ou le prix manuel.
          </AlertDescription>
        </Alert>
      )}
      {isAdmin && settings?.gold_manual_override && (
        <Alert className="mb-4 border-amber-500/50 text-amber-700 dark:text-amber-400">
          <Gauge className="h-4 w-4" />
          <AlertTitle>Override manuel actif</AlertTitle>
          <AlertDescription>
            L'application utilise un prix saisi manuellement au lieu du cours en direct.
          </AlertDescription>
        </Alert>
      )}

      {/* Price cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KARATS.map((k) => (
          <Card key={k}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Or {k}K</p>
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {latest?.[k] ? formatEUR(latest[k].price_per_gram) : "—"}
                <span className="ml-1 text-xs font-normal text-muted-foreground">/ g</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {latest?.[k] ? `≈ ${formatFromEUR(latest[k].price_per_gram, "DZD")} / g` : "Aucun cours"}
              </p>
              <p className="text-xs text-muted-foreground">
                {latest?.[k] ? `Maj ${formatDate(latest[k].price_date)}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Button className="mt-4" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          Synchroniser avec GoldRepublic
        </Button>
      )}

      {/* Diagnostics panel */}
      {isAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gauge className="h-5 w-5 text-primary" /> Diagnostics du cours de l'or
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Diag label="Statut de connexion">
                {connected ? (
                  <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600">
                    <Wifi className="h-3 w-3" /> Connecté
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <WifiOff className="h-3 w-3" /> Déconnecté
                  </Badge>
                )}
              </Diag>
              <Diag label="Source des données">
                {lastLog?.source ?? "—"}
                {lastLog?.data_source ? <span className="text-xs text-muted-foreground"> ({lastLog.data_source})</span> : null}
              </Diag>
              <Diag label="Dernière synchronisation">
                {lastLog ? `${formatRelativeTime(lastLog.created_at)} · ${formatDateTime(lastLog.created_at)}` : "Jamais"}
              </Diag>
              <Diag label="Prix GoldRepublic (réf.) EUR">
                {lastLog?.goldrepublic_price_eur != null ? `${formatEUR(lastLog.goldrepublic_price_eur)} / g` : "Indisponible"}
              </Diag>
              <Diag label="Prix appliqué (EUR / DZD)">
                {lastLog?.app_price_eur != null
                  ? `${formatEUR(lastLog.app_price_eur)} · ${formatFromEUR(lastLog.app_price_eur, "DZD")} / g`
                  : "—"}
              </Diag>
              <Diag label="Écart">
                {lastLog?.discrepancy_pct != null ? (
                  <span className={lastLog.alert ? "text-destructive font-medium" : ""}>
                    {formatEUR(lastLog.discrepancy_eur ?? 0)} ({lastLog.discrepancy_pct.toFixed(2)}%)
                  </span>
                ) : "—"}
              </Diag>
              <Diag label="Taux de change EUR → DZD">
                1 € = {eurToDzd} DZD
              </Diag>
              <Diag label="Taux USD → EUR (dernier)">
                {lastLog?.usd_eur_rate != null ? lastLog.usd_eur_rate.toFixed(4) : "—"}
              </Diag>
              <Diag label="Override manuel">
                {settings?.gold_manual_override ? (
                  <Badge variant="secondary">Activé</Badge>
                ) : (
                  <span className="text-muted-foreground">Désactivé</span>
                )}
              </Diag>
            </div>

            <Separator />

            <div>
              <p className="mb-2 text-sm font-medium">Journaux de synchronisation</p>
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Prix 24K (EUR/g)</TableHead>
                      <TableHead>Écart</TableHead>
                      <TableHead>Essais</TableHead>
                      <TableHead>Produits</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.data?.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-xs">{formatDateTime(l.created_at)}</TableCell>
                        <TableCell><StatusBadge status={l.status} /></TableCell>
                        <TableCell className="text-xs">{l.data_source ?? l.source}</TableCell>
                        <TableCell>{l.price_per_gram_eur != null ? formatEUR(l.price_per_gram_eur) : (l.error ? "—" : "—")}</TableCell>
                        <TableCell className={l.alert ? "text-destructive" : ""}>
                          {l.discrepancy_pct != null ? `${l.discrepancy_pct.toFixed(2)}%` : "—"}
                        </TableCell>
                        <TableCell>{l.attempts}</TableCell>
                        <TableCell>{l.products_recalculated}</TableCell>
                      </TableRow>
                    ))}
                    {logs.data?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          Aucune synchronisation enregistrée.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      {isAdmin && settings && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Paramètres de synchronisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Synchronisation automatique</p>
                <p className="text-sm text-muted-foreground">
                  Récupère automatiquement le cours en direct (comportement par défaut).
                </p>
              </div>
              <Switch
                checked={settings.gold_auto_sync}
                onCheckedChange={(v) => saveConfig.mutate({ gold_auto_sync: v })}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="font-medium">Override manuel</p>
                <p className="text-sm text-muted-foreground">
                  Utilise le prix manuel ci-dessous au lieu du cours en direct.
                </p>
              </div>
              <Switch
                checked={settings.gold_manual_override}
                onCheckedChange={(v) => saveConfig.mutate({ gold_manual_override: v })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Taux de change EUR → DZD</Label>
                <div className="flex gap-2">
                  <Input
                    type="number" min={0} step="0.01"
                    placeholder={String(settings.eur_to_dzd)}
                    value={rateDraft}
                    onChange={(e) => setRateDraft(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={!rateDraft || Number(rateDraft) <= 0}
                    onClick={() => { saveConfig.mutate({ eur_to_dzd: Number(rateDraft) }); setRateDraft(""); }}
                  >OK</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Seuil d'alerte d'écart (%)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number" min={0} step="0.1"
                    placeholder={String(settings.gold_discrepancy_threshold_pct)}
                    value={thresholdDraft}
                    onChange={(e) => setThresholdDraft(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={thresholdDraft === ""}
                    onClick={() => { saveConfig.mutate({ gold_discrepancy_threshold_pct: Number(thresholdDraft) }); setThresholdDraft(""); }}
                  >OK</Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Prix manuel 24K (EUR / g)</Label>
                <div className="flex gap-2">
                  <Input
                    type="number" min={0} step="0.01"
                    placeholder={settings.gold_manual_price_eur != null ? String(settings.gold_manual_price_eur) : "0"}
                    value={manualPriceDraft}
                    onChange={(e) => setManualPriceDraft(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    disabled={!manualPriceDraft || Number(manualPriceDraft) <= 0}
                    onClick={() => { saveConfig.mutate({ gold_manual_price_eur: Number(manualPriceDraft) }); setManualPriceDraft(""); }}
                  >OK</Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Manual per-karat entry */}
      {isAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Saisir le cours du jour (EUR / gramme)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {KARATS.map((k) => (
                <div key={k} className="space-y-2">
                  <Label htmlFor={`k-${k}`}>Or {k}K</Label>
                  <Input
                    id={`k-${k}`}
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={latest?.[k] ? String(latest[k].price_per_gram) : "0"}
                    value={draft[k] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending}>
              <RefreshCw className="mr-2 h-4 w-4" /> Enregistrer les cours
            </Button>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Historique des cours</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Titre</TableHead>
                <TableHead>Prix / g (EUR)</TableHead>
                <TableHead>Prix / g (DZD)</TableHead>
                <TableHead>Devise</TableHead>
                <TableHead>Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.data?.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatDate(row.price_date)}</TableCell>
                  <TableCell>{row.karat}K</TableCell>
                  <TableCell>{formatCurrency(row.price_per_gram, row.currency || "EUR")}</TableCell>
                  <TableCell className="text-muted-foreground">{formatFromEUR(row.price_per_gram, "DZD")}</TableCell>
                  <TableCell>{row.currency || "EUR"}</TableCell>
                  <TableCell className="capitalize">{row.source}</TableCell>
                </TableRow>
              ))}
              {history.data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Aucun cours enregistré.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

function Diag({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-medium">{children}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "success")
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" /> OK</Badge>;
  if (status === "manual")
    return <Badge variant="secondary" className="gap-1"><Gauge className="h-3 w-3" /> Manuel</Badge>;
  if (status === "fallback")
    return <Badge className="gap-1 bg-amber-500 hover:bg-amber-500"><AlertTriangle className="h-3 w-3" /> Repli</Badge>;
  return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Échec</Badge>;
}
