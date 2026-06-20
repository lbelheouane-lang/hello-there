import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Phone, Mail, MapPin, StickyNote, CalendarClock, Package,
  Scale, Wrench, Wallet, Printer, FileDown, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDZD, formatGrams, formatDate, formatDateTime } from "@/lib/format";
import {
  buildSupplierReportHtml, buildPurchaseReceiptHtml, printHtmlDocument,
  summarize, purchaseMetalLabel, type PurchaseRow,
} from "@/lib/supplier-report";

export const Route = createFileRoute("/_authenticated/fournisseurs_/$id")({
  component: SupplierProfilePage,
});

interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  created_at: string;
}

interface ProductRow {
  id: string;
  internal_code: string;
  name: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  metal_purchase_price: number;
  labor_cost: number;
  making_charge: number | null;
  stone_cost: number | null;
  origin: string | null;
  created_by: string | null;
  created_at: string;
}

const CHART_COLORS = ["#c9a227", "#b8860b", "#8a6d10", "#d4af37", "#a67c00"];

function StatCard({ icon: Icon, label, value }: { icon: typeof Package; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SupplierProfilePage() {
  const { id } = Route.useParams();
  const [search, setSearch] = useState("");
  const [metalFilter, setMetalFilter] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");

  const { data: supplier } = useQuery({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Supplier;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["supplier-purchases", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,internal_code,name,metal_type,gold_karat,weight_grams,metal_purchase_price,labor_cost,making_charge,stone_cost,origin,created_by,created_at")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as ProductRow[];
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employee-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      const m = new Map<string, string>();
      (data as { id: string; full_name: string | null }[]).forEach((p) => m.set(p.id, p.full_name ?? "—"));
      return m;
    },
  });

  const allRows = useMemo<PurchaseRow[]>(() => {
    return (products ?? []).map((p) => {
      const unit =
        Number(p.metal_purchase_price) + Number(p.labor_cost) +
        Number(p.making_charge ?? 0) + Number(p.stone_cost ?? 0);
      return {
        id: p.id,
        reference: p.internal_code,
        sku: p.internal_code,
        product_name: p.name,
        metal_type: p.metal_type,
        gold_karat: p.gold_karat,
        weight_grams: Number(p.weight_grams),
        quantity: 1,
        metal_purchase_price: Number(p.metal_purchase_price),
        labor_cost: Number(p.labor_cost),
        unit_cost: unit,
        total_cost: unit,
        employee_name: p.created_by ? employees?.get(p.created_by) ?? "—" : "—",
        origin: p.origin,
        created_at: p.created_at,
      };
    });
  }, [products, employees]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const min = Number(minAmount) || 0;
    const max = Number(maxAmount) || Infinity;
    const fromT = from ? new Date(from).getTime() : -Infinity;
    const toT = to ? new Date(to).getTime() + 86_400_000 : Infinity;
    return allRows.filter((r) => {
      if (metalFilter !== "all" && r.metal_type !== metalFilter) return false;
      if (r.total_cost < min || r.total_cost > max) return false;
      const t = new Date(r.created_at).getTime();
      if (t < fromT || t > toT) return false;
      if (q && !`${r.reference} ${r.sku} ${r.product_name} ${purchaseMetalLabel(r.metal_type)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allRows, search, metalFilter, from, to, minAmount, maxAmount]);

  const summary = useMemo(() => summarize(rows), [rows]);

  const byMonth = useMemo(() => {
    const m = new Map<string, { count: number; spent: number; weight: number }>();
    rows.forEach((r) => {
      const key = r.created_at.slice(0, 7);
      const e = m.get(key) ?? { count: 0, spent: 0, weight: 0 };
      e.count += r.quantity; e.spent += r.total_cost; e.weight += r.weight_grams * r.quantity;
      m.set(key, e);
    });
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, v]) => ({ month, ...v }));
  }, [rows]);

  const byMetal = useMemo(() => {
    const m = new Map<string, { spent: number; weight: number }>();
    rows.forEach((r) => {
      const e = m.get(r.metal_type) ?? { spent: 0, weight: 0 };
      e.spent += r.total_cost; e.weight += r.weight_grams * r.quantity;
      m.set(r.metal_type, e);
    });
    return [...m.entries()].map(([metal, v]) => ({ metal: purchaseMetalLabel(metal), ...v }));
  }, [rows]);

  const periodLabel = from || to
    ? `Du ${from ? formatDate(from) : "…"} au ${to ? formatDate(to) : "…"}`
    : "Toutes les périodes";

  function printReport() {
    printHtmlDocument(buildSupplierReportHtml(supplier?.name ?? "Fournisseur", periodLabel, rows));
  }
  function printOne(r: PurchaseRow) {
    printHtmlDocument(buildPurchaseReceiptHtml(supplier?.name ?? "Fournisseur", r));
  }

  return (
    <AppShell title={supplier?.name ?? "Fournisseur"} allow={["admin"]}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/fournisseurs"><ArrowLeft className="mr-2 h-4 w-4" /> Retour aux fournisseurs</Link>
        </Button>
      </div>

      {/* Profile header */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
          <div>
            <h2 className="font-serif text-2xl font-semibold">{supplier?.name}</h2>
            <div className="mt-2 space-y-1 text-sm text-muted-foreground">
              {supplier?.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {supplier.phone}</p>}
              {supplier?.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {supplier.email}</p>}
              {supplier?.address && <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {supplier.address}</p>}
              {supplier?.notes && <p className="flex items-center gap-2"><StickyNote className="h-3.5 w-3.5" /> {supplier.notes}</p>}
              {supplier?.created_at && <p className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5" /> Inscrit le {formatDate(supplier.created_at)}</p>}
            </div>
          </div>
          <Button onClick={printReport}><FileDown className="mr-2 h-4 w-4" /> Rapport PDF</Button>
        </CardContent>
      </Card>

      {/* Dashboard cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={Package} label="Total achats" value={String(summary.count)} />
        <StatCard icon={Scale} label="Poids total" value={formatGrams(summary.totalWeight)} />
        <StatCard icon={Wrench} label="Main-d'œuvre" value={formatDZD(summary.totalLabor)} />
        <StatCard icon={Wallet} label="Total dépensé" value={formatDZD(summary.totalSpent)} />
        <StatCard icon={CalendarClock} label="Dernier achat" value={summary.lastPurchase ? formatDate(summary.lastPurchase) : "—"} />
      </div>

      <Tabs defaultValue="history">
        <TabsList>
          <TabsTrigger value="history">Historique d'achats</TabsTrigger>
          <TabsTrigger value="analytics">Analytique</TabsTrigger>
        </TabsList>

        <TabsContent value="history" className="mt-4 space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="grid gap-3 p-4 md:grid-cols-3 lg:grid-cols-6">
              <div className="relative md:col-span-3 lg:col-span-2">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-8" placeholder="Réf., SKU, métal…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Métal</Label>
                <Select value={metalFilter} onValueChange={setMetalFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="or">Or</SelectItem>
                    <SelectItem value="argent">Argent</SelectItem>
                    <SelectItem value="platine">Platine</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Du</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Au</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2 lg:col-span-1">
                <div>
                  <Label className="text-xs">Min</Label>
                  <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Max</Label>
                  <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">{rows.length} achat(s)</CardTitle>
              <Button variant="outline" size="sm" onClick={printReport}>
                <Printer className="mr-2 h-4 w-4" /> Imprimer (A4)
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Réf.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Produit</TableHead>
                    <TableHead>Métal / Titre</TableHead>
                    <TableHead className="text-right">Poids</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">M.O.</TableHead>
                    <TableHead className="text-right">Coût total</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{formatDateTime(r.created_at)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{r.product_name}</div>
                        <div className="font-mono text-xs text-muted-foreground">{r.sku}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{purchaseMetalLabel(r.metal_type)}</Badge>
                        {r.gold_karat ? <span className="ml-1 text-xs">{r.gold_karat}K</span> : null}
                      </TableCell>
                      <TableCell className="text-right">{formatGrams(r.weight_grams)}</TableCell>
                      <TableCell className="text-right">{r.quantity}</TableCell>
                      <TableCell className="text-right">{formatDZD(r.labor_cost)}</TableCell>
                      <TableCell className="text-right font-semibold">{formatDZD(r.total_cost)}</TableCell>
                      <TableCell className="text-xs">{r.employee_name}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" title="Imprimer le bon" onClick={() => printOne(r)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-10 text-center text-muted-foreground">
                        <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                        Aucun achat trouvé.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Achats par mois</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="spent" name="Dépensé" fill="#c9a227" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Dépenses par type de métal</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byMetal} dataKey="spent" nameKey="metal" outerRadius={90} label>
                    {byMetal.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Poids total acheté dans le temps</CardTitle></CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={byMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="weight" name="Poids (g)" stroke="#b8860b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
