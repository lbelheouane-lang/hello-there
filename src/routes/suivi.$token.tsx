import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gem, Check, CircleDashed, PackageCheck, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreSettings } from "@/lib/store-settings";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  REPAIR_FLOW,
  repairStatusDef,
  repairStatusLabel,
} from "@/lib/repair";

export const Route = createFileRoute("/suivi/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Suivi de réparation" },
      { name: "description", content: "Suivez l'état de votre réparation de bijou en temps réel." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TrackingPage,
});

interface Tracking {
  reference: string;
  intake_at: string;
  jewelry_type: string;
  status: string;
  estimated_completion: string | null;
  updated_at: string;
}

interface HistoryEntry {
  status: string;
  note: string | null;
  created_at: string;
}

function TrackingPage() {
  const { token } = Route.useParams();
  const { data: settings } = useStoreSettings();
  const storeName = settings?.store_name || "Maison d'Or";

  const { data, isLoading, isError } = useQuery({
    queryKey: ["repair-tracking", token],
    queryFn: async () => {
      const [{ data: tr, error: e1 }, { data: hist, error: e2 }] = await Promise.all([
        supabase.rpc("get_repair_tracking", { _token: token }),
        supabase.rpc("get_repair_tracking_history", { _token: token }),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const repair = (tr as Tracking[] | null)?.[0] ?? null;
      return { repair, history: (hist as HistoryEntry[] | null) ?? [] };
    },
  });

  const repair = data?.repair ?? null;
  const def = repair ? repairStatusDef(repair.status) : null;
  const isCancelled = repair?.status === "cancelled";
  const isReady = repair?.status === "ready";
  const currentOrder = def && def.order >= 0 ? def.order : -1;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-primary text-primary-foreground">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={storeName} className="h-full w-full object-contain" />
            ) : (
              <Gem className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-serif text-lg font-semibold">{storeName}</p>
            <p className="text-xs text-muted-foreground">Suivi de réparation</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        {isLoading && <p className="text-center text-muted-foreground">Chargement…</p>}

        {(isError || (!isLoading && !repair)) && (
          <Card>
            <CardContent className="p-8 text-center">
              <XCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
              <h1 className="font-serif text-xl font-semibold">Réparation introuvable</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Ce lien de suivi n'est pas valide. Vérifiez le QR code de votre bon de réparation.
              </p>
            </CardContent>
          </Card>
        )}

        {repair && def && (
          <>
            <Card>
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Référence</p>
                    <p className="font-mono text-lg font-semibold">{repair.reference}</p>
                  </div>
                  <Badge className={def.className}>{def.label}</Badge>
                </div>

                {isReady && (
                  <div className="flex items-center gap-2 rounded-lg bg-green-100 px-4 py-3 text-sm font-medium text-green-800 dark:bg-green-900/40 dark:text-green-200">
                    <PackageCheck className="h-5 w-5" /> Votre bijou est prêt à être récupéré.
                  </div>
                )}

                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Type de bijou</dt>
                    <dd className="font-medium">{repair.jewelry_type}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Date de dépôt</dt>
                    <dd className="font-medium">{formatDate(repair.intake_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Fin estimée</dt>
                    <dd className="font-medium">
                      {repair.estimated_completion ? formatDate(repair.estimated_completion) : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Dernière mise à jour</dt>
                    <dd className="font-medium">{formatDateTime(repair.updated_at)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            {!isCancelled && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 font-serif text-lg font-semibold">Progression</h2>
                  <ol className="space-y-4">
                    {REPAIR_FLOW.map((s) => {
                      const done = s.order < currentOrder;
                      const active = s.order === currentOrder;
                      return (
                        <li key={s.value} className="flex items-center gap-3">
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                              done
                                ? "border-primary bg-primary text-primary-foreground"
                                : active
                                  ? "border-primary text-primary"
                                  : "border-muted text-muted-foreground"
                            }`}
                          >
                            {done ? <Check className="h-4 w-4" /> : <CircleDashed className="h-4 w-4" />}
                          </span>
                          <span className={active ? "font-semibold" : done ? "" : "text-muted-foreground"}>
                            {s.label}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>
            )}

            {data && data.history.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="mb-4 font-serif text-lg font-semibold">Historique</h2>
                  <ol className="relative space-y-4 border-l pl-6">
                    {[...data.history].reverse().map((h, i) => (
                      <li key={i} className="relative">
                        <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-primary" />
                        <p className="text-sm font-medium">{repairStatusLabel(h.status)}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)}</p>
                        {h.note && <p className="mt-0.5 text-xs text-muted-foreground">{h.note}</p>}
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}
