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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCategories, useSubcategories } from "@/hooks/use-categories";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getDemoStatus, generateDemoData, deleteDemoData,
} from "@/lib/demo-data.functions";
import {
  EmployeesCard, ChangeOwnPinCard, PinAuditCard,
} from "@/components/settings/employee-management";

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

  const cats = useCategories();
  const [newCat, setNewCat] = useState("");
  const addCat = useMutation({
    mutationFn: async () => {
      const name = newCat.trim();
      if (!name) throw new Error("Nom de catégorie requis.");
      const { error } = await supabase.from("product_categories").insert({ name, is_default: false });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catégorie ajoutée.");
      setNewCat("");
      qc.invalidateQueries({ queryKey: ["product_categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Catégorie supprimée.");
      qc.invalidateQueries({ queryKey: ["product_categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Subcategories
  const subs = useSubcategories();
  const [subCatId, setSubCatId] = useState("");
  const [newSub, setNewSub] = useState("");
  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? "";
  const addSub = useMutation({
    mutationFn: async () => {
      if (!subCatId) throw new Error("Choisissez d'abord une catégorie.");
      const name = newSub.trim();
      if (!name) throw new Error("Nom de sous-catégorie requis.");
      const { error } = await supabase.from("product_subcategories").insert({ category_id: subCatId, name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sous-catégorie ajoutée.");
      setNewSub("");
      qc.invalidateQueries({ queryKey: ["product_subcategories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delSub = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sous-catégorie supprimée.");
      qc.invalidateQueries({ queryKey: ["product_subcategories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });



  return (
    <AppShell title="Paramètres" allow={["admin"]}>
      <div className="mx-auto max-w-5xl">
        <Tabs defaultValue="employes" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="general">Catégories</TabsTrigger>
            <TabsTrigger value="employes">Employés</TabsTrigger>
            <TabsTrigger value="pin">Gestion PIN</TabsTrigger>
            <TabsTrigger value="logs">Journal système</TabsTrigger>
            <TabsTrigger value="backup">Sauvegarde & démo</TabsTrigger>
          </TabsList>

          <TabsContent value="employes" className="space-y-6">
            <EmployeesCard />
          </TabsContent>

          <TabsContent value="pin" className="space-y-6">
            <ChangeOwnPinCard />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <PinAuditCard />
          </TabsContent>

          <TabsContent value="general" className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              Catégories de bijoux
            </CardTitle>
            <CardDescription>
              Organisez votre inventaire par type de bijou. Les catégories par défaut sont
              prédéfinies ; vous pouvez en ajouter des personnalisées.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {(cats.data ?? []).map((c) => (
                <Badge key={c.id} variant={c.is_default ? "secondary" : "outline"} className="gap-1 py-1">
                  {c.name}
                  {!c.is_default && (
                    <button onClick={() => delCat.mutate(c.id)} className="ml-1 text-destructive" title="Supprimer">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Nouvelle catégorie personnalisée…"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addCat.mutate(); }}
              />
              <Button onClick={() => addCat.mutate()} disabled={addCat.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Ajouter
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" />
              Sous-catégories
            </CardTitle>
            <CardDescription>
              Affinez chaque catégorie avec des sous-catégories personnalisées
              (ex. Bague → Alliance, Bague de fiançailles).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Select value={subCatId} onValueChange={setSubCatId}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Catégorie…" /></SelectTrigger>
                <SelectContent>
                  {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                className="flex-1"
                placeholder="Nouvelle sous-catégorie…"
                value={newSub}
                onChange={(e) => setNewSub(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addSub.mutate(); }}
              />
              <Button onClick={() => addSub.mutate()} disabled={addSub.isPending}>
                <Plus className="mr-2 h-4 w-4" /> Ajouter
              </Button>
            </div>
            {subCatId && (
              <div className="flex flex-wrap gap-2">
                {(subs.data ?? []).filter((s) => s.category_id === subCatId).map((s) => (
                  <Badge key={s.id} variant="outline" className="gap-1 py-1">
                    {s.name}
                    <button onClick={() => delSub.mutate(s.id)} className="ml-1 text-destructive" title="Supprimer">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                {(subs.data ?? []).filter((s) => s.category_id === subCatId).length === 0 && (
                  <p className="text-sm text-muted-foreground">Aucune sous-catégorie pour « {catName(subCatId)} ».</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>



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
