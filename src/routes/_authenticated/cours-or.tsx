import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { KARATS, formatDate } from "@/lib/format";
import { formatUSD, formatFromUSD, formatCurrency } from "@/lib/currency";
import { useLatestGoldPrices, type GoldPrice } from "@/hooks/use-gold-prices";

export const Route = createFileRoute("/_authenticated/cours-or")({
  component: GoldPricePage,
});

function GoldPricePage() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const { data: latest } = useLatestGoldPrices();
  const [draft, setDraft] = useState<Record<number, string>>({});

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

  const save = useMutation({
    mutationFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const rows = KARATS.filter((k) => draft[k] && Number(draft[k]) > 0).map((k) => ({
        karat: k,
        price_per_gram: Number(draft[k]),
        currency: "USD",
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

  return (
    <AppShell title="Cours de l'or" allow={["admin"]}>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {KARATS.map((k) => (
          <Card key={k}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Or {k}K</p>
                <Coins className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 text-2xl font-semibold">
                {latest?.[k] ? formatUSD(latest[k].price_per_gram) : "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {latest?.[k] ? `≈ ${formatFromUSD(latest[k].price_per_gram, "DZD")} / g` : "Aucun cours"}
              </p>
              <p className="text-xs text-muted-foreground">
                {latest?.[k] ? `Maj ${formatDate(latest[k].price_date)}` : ""}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Mettre à jour le cours du jour (USD / gramme)</CardTitle>
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
                <TableHead>Prix / g (USD)</TableHead>
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
                  <TableCell>{formatCurrency(row.price_per_gram, row.currency || "USD")}</TableCell>
                  <TableCell className="text-muted-foreground">{formatFromUSD(row.price_per_gram, "DZD")}</TableCell>
                  <TableCell>{row.currency || "USD"}</TableCell>
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
