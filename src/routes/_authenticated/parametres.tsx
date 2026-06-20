import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Database, Sparkles, RotateCcw, Trash2, Info, Tags, Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/use-categories";
import {
  getDemoStatus, generateDemoData, deleteDemoData,
} from "@/lib/demo-data.functions";

export const Route = createFileRoute("/_authenticated/parametres")({
  component: SettingsPage,
});

const LABELS: Record<string, string> = {
  products: "Bijoux",
  customers: "Clients",
  sales: "Ventes",
  suppliers: "Fournisseurs",
  gold_prices: "Cours de l'or",
};

function SettingsPage() {
  const qc = useQueryClient();
  const status = useServerFn(getDemoStatus);
  const generate = useServerFn(generateDemoData);
  const wipe = useServerFn(deleteDemoData);

  const { data } = useQuery({
    queryKey: ["demo-status"],
    queryFn: () => status(),
  });

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["demo-status"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["customers"] });
    qc.invalidateQueries({ queryKey: ["sales"] });
    qc.invalidateQueries({ queryKey: ["suppliers"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["gold-prices"] });
  }

  const genMut = useMutation({
    mutationFn: () => generate(),
    onSuccess: () => { toast.success("Données de démonstration générées."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: () => wipe(),
    onSuccess: () => { toast.success("Données de démonstration supprimées."); invalidateAll(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = genMut.isPending || delMut.isPending;

  return (
    <AppShell title="Paramètres" allow={["admin"]}>
      <div className="mx-auto max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Données de démonstration
              {data?.active && <Badge variant="secondary">Mode démo actif</Badge>}
            </CardTitle>
            <CardDescription>
              Remplissez l'application avec des exemples réalistes (bijoux, clients,
              ventes, historique du cours de l'or) pour explorer toutes les fonctionnalités.
              Ces enregistrements sont clairement marqués « démo » et n'affectent pas vos vraies données.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {Object.keys(LABELS).map((k) => (
                <div key={k} className="rounded-lg border bg-muted/30 p-3 text-center">
                  <p className="text-2xl font-semibold">{data?.counts?.[k] ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{LABELS[k]}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => genMut.mutate()} disabled={busy}>
                <Sparkles className="mr-2 h-4 w-4" />
                {data?.active ? "Régénérer les données démo" : "Générer les données démo"}
              </Button>
              <Button variant="outline" onClick={() => genMut.mutate()} disabled={busy}>
                <RotateCcw className="mr-2 h-4 w-4" /> Réinitialiser
              </Button>
              <Button variant="destructive" onClick={() => delMut.mutate()} disabled={busy || !data?.active}>
                <Trash2 className="mr-2 h-4 w-4" /> Supprimer les données démo
              </Button>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p>
                La réinitialisation supprime puis recrée un jeu d'exemples neuf. Les coûts
                confidentiels (achat, main-d'œuvre) restent visibles uniquement par les administrateurs.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
