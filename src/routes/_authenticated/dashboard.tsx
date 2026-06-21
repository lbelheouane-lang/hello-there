import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, Scale, TrendingUp, Coins, ShoppingBag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLatestGoldPrices } from "@/hooks/use-gold-prices";
import { useAuth } from "@/hooks/use-auth";
import { useUserPreferences } from "@/lib/user-preferences";
import { GoldPriceWidget } from "@/components/GoldPriceWidget";
import { formatGrams, KARATS } from "@/lib/format";
import { formatEUR, formatFromEUR } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

interface ProductRow {
  status: string;
  weight_grams: number;
  category: string;
  updated_at: string;
}

function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("status, weight_grams, category, updated_at");
      if (error) throw error;
      const rows = (data ?? []) as ProductRow[];
      const now = new Date();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const startDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const inStock = rows.filter((r) => r.status === "en_stock");
      const sold = rows.filter((r) => r.status === "vendu");
      const soldMonth = sold.filter((r) => new Date(r.updated_at) >= startMonth);
      const soldDay = sold.filter((r) => new Date(r.updated_at) >= startDay);

      const byCategory = new Map<string, number>();
      for (const r of sold) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
      const topCategories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

      const sum = (arr: ProductRow[]) => arr.reduce((t, r) => t + Number(r.weight_grams), 0);
      return {
        stockGrams: sum(inStock),
        stockCount: inStock.length,
        soldGramsMonth: sum(soldMonth),
        soldGramsDay: sum(soldDay),
        salesMonth: soldMonth.length,
        salesTotal: sold.length,
        topCategories,
      };
    },
  });
}

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Package; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardPage() {
  const { data: prices } = useLatestGoldPrices();
  const { data: stats } = useDashboardStats();
  const { role } = useAuth();
  const { data: prefs } = useUserPreferences();
  const hidden = prefs?.hidden_widgets ?? [];
  const show = (key: string) => !hidden.includes(key);

  return (
    <AppShell title="Tableau de bord" allow={["admin"]}>
      {show("stats") && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Scale} label="Poids vendu (mois)" value={formatGrams(stats?.soldGramsMonth ?? 0)} hint={`Aujourd'hui : ${formatGrams(stats?.soldGramsDay ?? 0)}`} />
          <StatCard icon={ShoppingBag} label="Ventes du mois" value={String(stats?.salesMonth ?? 0)} hint={`Total : ${stats?.salesTotal ?? 0}`} />
          <StatCard icon={Package} label="Stock total" value={formatGrams(stats?.stockGrams ?? 0)} hint={`${stats?.stockCount ?? 0} pièces en stock`} />
          <StatCard icon={Coins} label="Cours 18K (gramme)" value={prices?.[18] ? formatEUR(prices[18].price_per_gram) : "—"} hint={prices?.[18] ? `≈ ${formatFromEUR(prices[18].price_per_gram, "DZD")}` : "Dernier cours connu"} />
        </div>
      )}

      {show("gold_widget") && (
        <div className="mt-6">
          <GoldPriceWidget canRefresh={role === "admin"} />
        </div>
      )}


      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {show("gold_grid") && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Coins className="h-5 w-5 text-primary" /> Cours de l'or au gramme (EUR)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {KARATS.map((k) => (
                  <div key={k} className="rounded-xl border bg-card p-4">
                    <p className="text-sm text-muted-foreground">{k}K</p>
                    <p className="mt-1 text-xl font-semibold">{prices?.[k] ? formatEUR(prices[k].price_per_gram) : "—"}</p>
                    <p className="text-xs text-muted-foreground">{prices?.[k] ? `≈ ${formatFromEUR(prices[k].price_per_gram, "DZD")}` : ""}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {show("top_categories") && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" /> Catégories les plus vendues
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats && stats.topCategories.length > 0 ? (
                <ul className="space-y-2">
                  {stats.topCategories.map(([cat, count]) => (
                    <li key={cat} className="flex items-center justify-between text-sm">
                      <span>{cat}</span>
                      <span className="font-medium">{count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Aucune vente enregistrée.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}
