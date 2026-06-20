import { useState } from "react";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Coins } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatRelativeTime, formatDateTime, KARATS } from "@/lib/format";
import { formatEUR, formatFromEUR, eurToDzdRate } from "@/lib/currency";
import { useLatestGoldPrices, useGoldPriceChange } from "@/hooks/use-gold-prices";
import { refreshGoldPrices } from "@/lib/gold-prices.functions";

export function GoldPriceWidget({ canRefresh = false }: { canRefresh?: boolean }) {
  const [karat, setKarat] = useState(18);
  const qc = useQueryClient();
  const { data: prices } = useLatestGoldPrices();
  const { data: change } = useGoldPriceChange(karat);
  const refresh = useServerFn(refreshGoldPrices);
  const [pending, setPending] = useState(false);

  const latest = prices?.[karat];
  const dir = change?.direction ?? "flat";
  const Indicator = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;
  const tone =
    dir === "up" ? "text-emerald-600" : dir === "down" ? "text-destructive" : "text-muted-foreground";

  async function handleRefresh() {
    setPending(true);
    try {
      const res = await refresh();
      if (res.ok) {
        toast.success(`Cours mis à jour (${res.source}${res.fallbackUsed ? ", repli" : ""})`);
        qc.invalidateQueries({ queryKey: ["gold_prices"] });
        qc.invalidateQueries({ queryKey: ["products"] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      } else {
        toast.error("Aucun fournisseur de cours disponible.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Coins className="h-5 w-5 text-primary" /> Cours de l'or en direct
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={String(karat)} onValueChange={(v) => setKarat(Number(v))}>
            <SelectTrigger className="h-8 w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KARATS.map((k) => (
                <SelectItem key={k} value={String(k)}>{k}K</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canRefresh && (
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={handleRefresh} disabled={pending}>
              <RefreshCw className={`h-4 w-4 ${pending ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Cours de l'or en direct</p>
            <p className="text-3xl font-semibold">
              {latest ? formatEUR(latest.price_per_gram) : "—"}
              <span className="ml-1 text-sm font-normal text-muted-foreground">/ g</span>
            </p>
            {latest?.price_per_ounce ? (
              <p className="text-sm text-muted-foreground">{formatEUR(latest.price_per_ounce)} / once</p>
            ) : null}
          </div>
          <div className={`flex items-center gap-1 text-sm font-medium ${tone}`}>
            <Indicator className="h-4 w-4" />
            {change && change.previous != null ? (
              <span>
                {change.diff > 0 ? "+" : ""}
                {formatEUR(change.diff)} ({change.percent > 0 ? "+" : ""}
                {change.percent.toFixed(2)}%)
              </span>
            ) : (
              <span>—</span>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3">
          <p className="text-xs font-medium text-muted-foreground">Conversion estimée en DZD</p>
          <p className="text-xl font-semibold">
            {latest ? formatFromEUR(latest.price_per_gram, "DZD") : "—"}
            <span className="ml-1 text-sm font-normal text-muted-foreground">/ g</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Taux appliqué : 1 EUR = {eurToDzdRate()} DZD
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Dernière mise à jour : {latest?.fetched_at ? formatDateTime(latest.fetched_at) : "—"}
          {" · "}{formatRelativeTime(latest?.fetched_at)} · {latest?.source ?? "—"}
        </p>
      </CardContent>
    </Card>
  );
}
