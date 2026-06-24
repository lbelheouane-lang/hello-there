import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BookOpen, Download, Printer, History, FileText, ShoppingBag, Package,
  Recycle, Wallet2, Truck, Users, Coins, Activity, TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/data-client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import {
  fetchJournalSummary, buildJournalHtml, printJournal, type JournalSummary,
} from "@/lib/daily-journal";

export const Route = createFileRoute("/_authenticated/journal-quotidien")({
  component: JournalPage,
});

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type FilterMode = "today" | "date" | "range";

interface JournalRow {
  id: string;
  journal_date: string;
  date_to: string | null;
  summary: JournalSummary;
  generated_by_name: string | null;
  created_at: string;
}

function StatTile({ icon: Icon, label, value, hint }: { icon: typeof Package; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
          {hint && <p className="truncate text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-dotted py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: typeof Package; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function JournalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mode, setMode] = useState<FilterMode>("today");
  const [from, setFrom] = useState(todayStr());
  const [to, setTo] = useState(todayStr());
  const [summary, setSummary] = useState<JournalSummary | null>(null);

  const effectiveFrom = mode === "today" ? todayStr() : from;
  const effectiveTo = mode === "range" ? to : effectiveFrom;

  const generatorName = user?.email ?? "Utilisateur";

  const history = useQuery({
    queryKey: ["daily-journals"],
    queryFn: async (): Promise<JournalRow[]> => {
      const { data, error } = await supabase
        .from("daily_journals")
        .select("id, journal_date, date_to, summary, generated_by_name, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as JournalRow[];
    },
  });

  const generate = useMutation({
    mutationFn: async () => {
      const data = await fetchJournalSummary(effectiveFrom, effectiveTo);
      const { error } = await supabase.from("daily_journals").insert({
        journal_date: effectiveFrom,
        date_to: mode === "range" ? effectiveTo : null,
        summary: data as unknown as Record<string, unknown>,
        generated_by: user?.id ?? null,
        generated_by_name: generatorName,
      } as never);
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSummary(data);
      qc.invalidateQueries({ queryKey: ["daily-journals"] });
      toast.success("Journal généré et enregistré.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur lors de la génération."),
  });

  function downloadPdf(j: JournalSummary, by: string) {
    const html = buildJournalHtml(j, by);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const label = j.from === j.to ? j.from : `${j.from}_${j.to}`;
    a.href = url;
    a.download = `journal-quotidien-${label}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const fin = summary?.financial;

  return (
    <AppShell title="Journal Quotidien" allow={["admin", "employe"]}>
      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate" className="gap-2"><BookOpen className="h-4 w-4" /> Générer</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Journaux précédents</TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="mt-4 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filtres</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {([["today", "Aujourd'hui"], ["date", "Date précise"], ["range", "Période"]] as const).map(([v, l]) => (
                  <Button key={v} variant={mode === v ? "default" : "outline"} size="sm" onClick={() => setMode(v)}>
                    {l}
                  </Button>
                ))}
              </div>
              {mode !== "today" && (
                <div className="flex flex-wrap items-end gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="from">{mode === "range" ? "Du" : "Date"}</Label>
                    <Input id="from" type="date" value={from} max={todayStr()} onChange={(e) => setFrom(e.target.value)} className="w-44" />
                  </div>
                  {mode === "range" && (
                    <div className="space-y-1">
                      <Label htmlFor="to">Au</Label>
                      <Input id="to" type="date" value={to} max={todayStr()} onChange={(e) => setTo(e.target.value)} className="w-44" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => generate.mutate()} disabled={generate.isPending} className="gap-2">
                  <BookOpen className="h-4 w-4" /> {generate.isPending ? "Génération…" : "Générer le journal"}
                </Button>
                {summary && (
                  <>
                    <Button variant="outline" onClick={() => downloadPdf(summary, generatorName)} className="gap-2">
                      <Download className="h-4 w-4" /> Télécharger
                    </Button>
                    <Button variant="outline" onClick={() => printJournal(summary, generatorName)} className="gap-2">
                      <Printer className="h-4 w-4" /> Imprimer
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {summary && fin && (
            <div className="space-y-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <StatTile icon={ShoppingBag} label="Total des ventes" value={formatDZD(fin.totalSales)} />
                <StatTile icon={Wallet2} label="Total des dépenses" value={formatDZD(fin.totalExpenses)} />
                <StatTile icon={Recycle} label="Achats d'or cassé" value={formatDZD(fin.totalScrap)} />
                <StatTile icon={Coins} label="Versements reçus" value={formatDZD(fin.paymentsReceived)} />
                <StatTile icon={FileText} label="Soldes en attente" value={formatDZD(fin.outstandingBalance)} />
                <StatTile icon={TrendingUp} label="Résultat net du jour" value={formatDZD(fin.netResult)} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <SectionCard icon={ShoppingBag} title="1. Ventes">
                  <Stat label="Nombre de ventes" value={String(summary.sales.count)} />
                  <Stat label="Montant total des ventes" value={formatDZD(summary.sales.totalAmount)} />
                  <Stat label="Ventes en espèces" value={`${summary.sales.cashCount} · ${formatDZD(summary.sales.cashAmount)}`} />
                  <Stat label="Paiements en attente créés" value={`${summary.sales.pendingCreatedCount} · ${formatDZD(summary.sales.pendingCreatedAmount)}`} />
                  <Stat label="Versements reçus (soldes)" value={`${summary.sales.paymentsReceivedCount} · ${formatDZD(summary.sales.paymentsReceivedAmount)}`} />
                </SectionCard>

                <SectionCard icon={Package} title="2. Mouvements de stock">
                  <Stat label="Articles ajoutés" value={`${summary.inventory.itemsAdded} · ${formatGrams(summary.inventory.itemsAddedWeight)}`} />
                  <Stat label="Articles vendus" value={String(summary.inventory.itemsSold)} />
                  <Stat label="Modifications de quantité" value={String(summary.inventory.quantityChanges)} />
                  <Stat label="Parures créées" value={String(summary.inventory.setsCreated)} />
                  <Stat label="Parures partiellement vendues" value={String(summary.inventory.setsPartiallySold)} />
                  <Stat label="Parures entièrement vendues" value={String(summary.inventory.setsFullySold)} />
                </SectionCard>

                <SectionCard icon={Recycle} title="3. Or cassé">
                  <Stat label="Nombre d'achats" value={String(summary.scrap.count)} />
                  <Stat label="Poids total acheté" value={formatGrams(summary.scrap.totalWeight)} />
                  <Stat label="Prix moyen / gramme" value={formatDZD(summary.scrap.avgPricePerGram)} />
                  <Stat label="Montant total dépensé" value={formatDZD(summary.scrap.totalAmount)} />
                </SectionCard>

                <SectionCard icon={Wallet2} title="4. Dépenses">
                  <Stat label="Nombre de dépenses" value={String(summary.expenses.count)} />
                  <Stat label="Montant total" value={formatDZD(summary.expenses.totalAmount)} />
                  <Stat label="Achats de stock" value={`${summary.expenses.stockPurchaseCount} · ${formatDZD(summary.expenses.stockPurchaseAmount)}`} />
                  {summary.expenses.byCategory.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {summary.expenses.byCategory.map((c) => (
                        <div key={c.category} className="flex justify-between text-xs text-muted-foreground">
                          <span>{c.category} ({c.count})</span><span>{formatDZD(c.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard icon={Truck} title="5. Fournisseurs">
                  {summary.suppliers.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">Aucun achat fournisseur.</p>
                  ) : (
                    summary.suppliers.map((s) => (
                      <Stat key={s.supplier} label={`${s.supplier} (${s.count})`} value={formatDZD(s.amount)} />
                    ))
                  )}
                </SectionCard>

                <SectionCard icon={Users} title="6. Clients">
                  <Stat label="Nouveaux clients" value={String(summary.customers.newCount)} />
                  <Stat label="Versements clients reçus" value={formatDZD(summary.customers.paymentsReceived)} />
                  <Stat label="Soldes en attente (total)" value={formatDZD(summary.customers.outstandingBalance)} />
                  {summary.customers.newNames.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">{summary.customers.newNames.join(", ")}</p>
                  )}
                </SectionCard>

                <SectionCard icon={Coins} title="7. Cours de l'or">
                  {summary.goldPrices.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">Aucune mise à jour.</p>
                  ) : (
                    summary.goldPrices.map((g) => (
                      <Stat
                        key={g.karat}
                        label={`${g.karat}K · ${g.user}`}
                        value={`${g.previous != null ? formatDZD(g.previous) + " → " : ""}${formatDZD(g.current)}`}
                      />
                    ))
                  )}
                </SectionCard>

                <SectionCard icon={Activity} title="8. Activité par utilisateur">
                  {summary.userActivity.length === 0 ? (
                    <p className="text-sm italic text-muted-foreground">Aucune activité.</p>
                  ) : (
                    summary.userActivity.map((u) => (
                      <Stat
                        key={u.user}
                        label={u.user}
                        value={`V:${u.sales} S:${u.inventory} P:${u.payments} D:${u.expenses} O:${u.scrap}`}
                      />
                    ))
                  )}
                </SectionCard>
              </div>

              {summary.activityLog.length > 0 && (
                <SectionCard icon={Activity} title="Actions critiques">
                  <div className="space-y-1">
                    {summary.activityLog.map((a, i) => (
                      <div key={i} className="flex flex-wrap items-center gap-2 border-b border-dotted py-1.5 text-sm last:border-0">
                        <span className="text-xs text-muted-foreground">{formatDateTime(a.time)}</span>
                        <Badge variant="outline">{a.user}</Badge>
                        <span>{a.action}</span>
                        {a.detail && <span className="text-xs text-muted-foreground">· {a.detail}</span>}
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Journaux générés</CardTitle>
            </CardHeader>
            <CardContent>
              {history.isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : (history.data ?? []).length === 0 ? (
                <p className="text-sm italic text-muted-foreground">Aucun journal généré pour l'instant.</p>
              ) : (
                <div className="space-y-2">
                  {(history.data ?? []).map((row) => {
                    const label = row.date_to ? `${formatDate(row.journal_date)} → ${formatDate(row.date_to)}` : formatDate(row.journal_date);
                    return (
                      <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                        <div>
                          <p className="font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">
                            Généré le {formatDateTime(row.created_at)} · {row.generated_by_name ?? "—"}
                            {row.summary?.financial ? ` · Net : ${formatDZD(row.summary.financial.netResult)}` : ""}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => downloadPdf(row.summary, row.generated_by_name ?? "—")} className="gap-2">
                            <Download className="h-4 w-4" /> PDF
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => printJournal(row.summary, row.generated_by_name ?? "—")} className="gap-2">
                            <Printer className="h-4 w-4" /> Imprimer
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
