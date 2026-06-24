import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet, Search, AlertTriangle, CalendarClock, Users as UsersIcon, TrendingUp,
  Receipt, Plus, User as UserIcon, History, CircleDollarSign, CheckCircle2,
  Clock, FileText, Eye, BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/data-client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatDZD, formatDate, formatDateTime, paymentLabel, PAYMENT_METHODS } from "@/lib/format";
import { balanceOf, percentPaid, makeReceiptNumber } from "@/lib/installments";
import { printReceipt, type ReceiptData } from "@/lib/receipt";

export const Route = createFileRoute("/_authenticated/paiements-en-attente")({
  component: PendingPaymentsPage,
});

const STORE_NAME = "Maison d'Or";

type PendingStatus = "pending" | "partial" | "due_today" | "overdue";

interface SaleRow {
  id: string;
  sale_number: string;
  product_name: string | null;
  total_amount: number;
  amount_paid: number;
  payment_method: string;
  sale_type: string | null;
  due_date: string | null;
  created_at: string;
  customer_id: string | null;
  customers: { full_name: string; phone: string | null } | null;
}

interface PaymentRow {
  id: string;
  sale_id: string;
  receipt_number: string | null;
  amount: number;
  payment_method: string | null;
  paid_at: string;
  recorded_by: string | null;
  notes: string | null;
}

const STATUS_META: Record<PendingStatus, { label: string; variant: "secondary" | "destructive" | "outline" | "default" }> = {
  pending: { label: "En attente", variant: "outline" },
  partial: { label: "Partiellement payé", variant: "secondary" },
  due_today: { label: "Échéance aujourd'hui", variant: "default" },
  overdue: { label: "En retard", variant: "destructive" },
};

function startOfToday(): Date {
  return new Date(new Date().toDateString());
}

function statusForSale(s: SaleRow): PendingStatus {
  const today = startOfToday();
  if (s.due_date) {
    const due = new Date(s.due_date);
    if (due < today) return "overdue";
    if (due.getTime() === today.getTime()) return "due_today";
  }
  if (Number(s.amount_paid) > 0) return "partial";
  return "pending";
}

/** Local date string (yyyy-mm-dd) for date input default. */
function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Local time string (HH:mm) for time input default. */
function nowInput(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function PendingPaymentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [payOpen, setPayOpen] = useState(false);
  const [paySale, setPaySale] = useState<SaleRow | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayInput());
  const [payTime, setPayTime] = useState(nowInput());
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0].value);
  const [payNotes, setPayNotes] = useState("");

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailSale, setDetailSale] = useState<SaleRow | null>(null);

  const { data: sales } = useQuery({
    queryKey: ["sales", "pending"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_number, product_name, total_amount, amount_paid, payment_method, sale_type, due_date, created_at, customer_id, customers(full_name, phone)")
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as SaleRow[];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["payments", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, sale_id, receipt_number, amount, payment_method, paid_at, recorded_by, notes")
        .order("paid_at", { ascending: true });
      if (error) throw error;
      return data as PaymentRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["profiles", "all-names"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return data as { id: string; full_name: string | null }[];
    },
  });

  const { data: myProfile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("id", user!.id).single();
      return data as { full_name: string | null } | null;
    },
  });

  const allSales = sales ?? [];
  const paymentList = payments ?? [];
  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    (profiles ?? []).forEach((p) => m.set(p.id, p.full_name ?? "—"));
    return m;
  }, [profiles]);

  // Only sales with an outstanding balance
  const pending = useMemo(() => allSales.filter((s) => balanceOf(s) > 0), [allSales]);

  // Last payment date per sale
  const lastPaymentBySale = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of paymentList) {
      const cur = m.get(p.sale_id);
      if (!cur || new Date(p.paid_at) > new Date(cur)) m.set(p.sale_id, p.paid_at);
    }
    return m;
  }, [paymentList]);

  // Metrics
  const totalOutstanding = pending.reduce((sum, s) => sum + balanceOf(s), 0);
  const customersWithPending = new Set(pending.map((s) => s.customer_id ?? s.id)).size;
  const overdueCount = pending.filter((s) => statusForSale(s) === "overdue").length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const collectedThisMonth =
    paymentList.filter((p) => new Date(p.paid_at) >= monthStart).reduce((s, p) => s + Number(p.amount), 0) +
    allSales.filter((s) => new Date(s.created_at) >= monthStart).reduce((s, x) => s + Number(x.amount_paid), 0);
  const stillToCollect = totalOutstanding;

  // Reports
  const todayStart = startOfToday();
  const paymentsToday = paymentList
    .filter((p) => new Date(p.paid_at) >= todayStart)
    .reduce((s, p) => s + Number(p.amount), 0);
  const periodFrom = fromDate ? new Date(fromDate) : null;
  const periodTo = toDate ? new Date(new Date(toDate).getTime() + 86400000) : null;
  const paymentsPeriod = paymentList
    .filter((p) => {
      const d = new Date(p.paid_at);
      if (periodFrom && d < periodFrom) return false;
      if (periodTo && d > periodTo) return false;
      return true;
    })
    .reduce((s, p) => s + Number(p.amount), 0);
  const fullySettled = allSales.filter((s) => balanceOf(s) <= 0).length;
  const partiallyPaid = allSales.filter((s) => Number(s.amount_paid) > 0 && balanceOf(s) > 0).length;

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pending.filter((s) => {
      if (q) {
        const hay = `${s.customers?.full_name ?? ""} ${s.customers?.phone ?? ""} ${s.sale_number}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter !== "all" && statusForSale(s) !== statusFilter) return false;
      if (fromDate && new Date(s.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(s.created_at) > new Date(new Date(toDate).getTime() + 86400000)) return false;
      return true;
    });
  }, [pending, search, statusFilter, fromDate, toDate]);

  const cards = [
    { label: "Solde total à recouvrer", value: formatDZD(totalOutstanding), icon: CircleDollarSign, danger: totalOutstanding > 0 },
    { label: "Clients avec impayés", value: String(customersWithPending), icon: UsersIcon },
    { label: "Paiements en retard", value: String(overdueCount), icon: AlertTriangle, danger: overdueCount > 0 },
    { label: "Encaissé ce mois-ci", value: formatDZD(collectedThisMonth), icon: TrendingUp },
    { label: "Reste à encaisser", value: formatDZD(stillToCollect), icon: CalendarClock },
  ];

  const reportCards = [
    { label: "Soldes en attente (total)", value: formatDZD(totalOutstanding), icon: CircleDollarSign },
    { label: "Encaissés aujourd'hui", value: formatDZD(paymentsToday), icon: TrendingUp },
    { label: "Encaissés (période filtrée)", value: formatDZD(paymentsPeriod), icon: CalendarClock },
    { label: "Factures soldées", value: String(fullySettled), icon: BadgeCheck },
    { label: "Partiellement payées", value: String(partiallyPaid), icon: Clock },
  ];

  /** Build the chronological timeline of payments for a sale, with running balance. */
  function timelineFor(sale: SaleRow) {
    const rows = paymentList
      .filter((p) => p.sale_id === sale.id)
      .sort((a, b) => new Date(a.paid_at).getTime() - new Date(b.paid_at).getTime());
    const sumPayments = rows.reduce((s, p) => s + Number(p.amount), 0);
    // Initial deposit captured at sale creation (not tracked as a payment row).
    const deposit = Math.max(Number(sale.amount_paid) - sumPayments, 0);
    const entries: { id: string; paidAt: string; amount: number; method: string | null; by: string; notes: string | null; remaining: number }[] = [];
    if (deposit > 0) {
      entries.push({
        id: "deposit",
        paidAt: sale.created_at,
        amount: deposit,
        method: sale.payment_method,
        by: "—",
        notes: "Acompte initial à la vente",
        remaining: Math.max(Number(sale.total_amount) - deposit, 0),
      });
    }
    let cumulative = deposit;
    for (const p of rows) {
      cumulative += Number(p.amount);
      entries.push({
        id: p.id,
        paidAt: p.paid_at,
        amount: Number(p.amount),
        method: p.payment_method,
        by: p.recorded_by ? nameById.get(p.recorded_by) ?? "—" : "—",
        notes: p.notes,
        remaining: Math.max(Number(sale.total_amount) - cumulative, 0),
      });
    }
    return entries;
  }

  function openPay(s: SaleRow) {
    setPaySale(s);
    setPayAmount(String(balanceOf(s)));
    setPayDate(todayInput());
    setPayTime(nowInput());
    setPayMethod(PAYMENT_METHODS[0].value);
    setPayNotes("");
    setPayOpen(true);
  }

  function openDetail(s: SaleRow) {
    setDetailSale(s);
    setDetailOpen(true);
  }

  const registerPayment = useMutation({
    mutationFn: async () => {
      if (!paySale) throw new Error("Aucune vente sélectionnée.");
      const amount = Number(payAmount);
      if (!amount || amount <= 0) throw new Error("Indiquez un montant valide.");
      const max = balanceOf(paySale);
      if (amount > max) throw new Error(`Le montant dépasse le reste à payer (${formatDZD(max)}).`);
      const receiptNumber = makeReceiptNumber();
      // Combine the chosen date + time into an ISO timestamp.
      const dt = new Date(`${payDate || todayInput()}T${payTime || nowInput()}`);
      const paidAt = isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
      const { error } = await supabase.from("payments").insert({
        sale_id: paySale.id,
        receipt_number: receiptNumber,
        amount,
        payment_method: payMethod,
        paid_at: paidAt,
        recorded_by: user?.id ?? null,
        notes: payNotes.trim() || null,
      });
      if (error) throw error;
      const totalPaidAfter = Number(paySale.amount_paid) + amount;
      const receipt: ReceiptData = {
        storeName: STORE_NAME,
        receiptNumber,
        customerName: paySale.customers?.full_name ?? "—",
        customerPhone: paySale.customers?.phone ?? null,
        invoiceNumber: paySale.sale_number,
        paidAt,
        paymentMethod: payMethod,
        amount,
        totalAmount: Number(paySale.total_amount),
        totalPaid: totalPaidAfter,
        balance: Math.max(Number(paySale.total_amount) - totalPaidAfter, 0),
        employeeName: myProfile?.full_name ?? "—",
        notes: payNotes.trim() || null,
      };
      return receipt;
    },
    onSuccess: (receipt) => {
      toast.success("Paiement enregistré");
      setPayOpen(false);
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      printReceipt(receipt);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Keep the open detail dialog in sync with refreshed sales data.
  const liveDetailSale = detailSale ? allSales.find((s) => s.id === detailSale.id) ?? detailSale : null;

  return (
    <AppShell title="Paiements en attente">
      {/* Dashboard cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <c.icon className={`h-4 w-4 ${c.danger ? "text-destructive" : "text-primary"}`} />
              </div>
              <p className={`mt-2 text-lg font-semibold ${c.danger ? "text-destructive" : ""}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Client, téléphone ou facture…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Statut</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="partial">Partiellement payé</SelectItem>
              <SelectItem value="due_today">Échéance aujourd'hui</SelectItem>
              <SelectItem value="overdue">En retard</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Du</Label>
          <Input type="date" className="w-40" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Au</Label>
          <Input type="date" className="w-40" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {(search || statusFilter !== "all" || fromDate || toDate) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter("all"); setFromDate(""); setToDate(""); }}>
            Réinitialiser
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Facture</TableHead>
                <TableHead className="text-right">Montant initial</TableHead>
                <TableHead className="text-right">Reste à payer</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const status = statusForSale(s);
                const isUrgent = status === "overdue" || status === "due_today";
                return (
                  <TableRow key={s.id} className={status === "overdue" ? "bg-destructive/5" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {isUrgent && <AlertTriangle className="h-4 w-4 text-destructive" />}
                        <div>
                          <p className="font-medium">{s.customers?.full_name ?? "Client de passage"}</p>
                          <p className="text-xs text-muted-foreground">{s.customers?.phone ?? "—"}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{s.sale_number}</span>
                      <p className="text-xs text-muted-foreground">{s.product_name}</p>
                    </TableCell>
                    <TableCell className="text-right text-sm">{formatDZD(s.total_amount)}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">{formatDZD(balanceOf(s))}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="outline" size="sm" onClick={() => openDetail(s)}>
                          <Eye className="mr-1 h-4 w-4" /> Détails
                        </Button>
                        <Button size="sm" onClick={() => openPay(s)}>
                          <Plus className="mr-1 h-4 w-4" /> Paiement
                        </Button>
                        {s.customer_id && (
                          <Button asChild variant="ghost" size="icon" title="Profil client">
                            <Link to="/clients/$id" params={{ id: s.customer_id }}><UserIcon className="h-4 w-4" /></Link>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-12 text-center text-muted-foreground">
                    <Wallet className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Aucun paiement en attente. Toutes les factures sont soldées. 🎉
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Reports */}
      <div className="mt-8">
        <h2 className="mb-3 font-serif text-lg font-semibold">Rapports</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {reportCards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                  <c.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="mt-2 text-lg font-semibold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau paiement — {paySale?.sale_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {paySale && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Client</span><span>{paySale.customers?.full_name ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Total facture</span><span>{formatDZD(paySale.total_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé</span><span>{formatDZD(paySale.amount_paid)}</span></div>
                <div className="flex justify-between font-medium"><span className="text-muted-foreground">Reste à payer</span><span className="text-destructive">{formatDZD(balanceOf(paySale))}</span></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date du paiement</Label>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Heure du paiement</Label>
                <Input type="time" value={payTime} onChange={(e) => setPayTime(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Montant versé (DZD) *</Label>
              <Input type="number" min={0} step="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
              {paySale && Number(payAmount) > 0 && (
                <p className="text-xs text-muted-foreground">
                  Nouveau reste après paiement :{" "}
                  <span className="font-medium text-foreground">
                    {formatDZD(Math.max(balanceOf(paySale) - Number(payAmount), 0))}
                  </span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Mode de paiement</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => registerPayment.mutate()} disabled={registerPayment.isPending}>
              <Receipt className="mr-2 h-4 w-4" /> Enregistrer & imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Détails — {liveDetailSale?.sale_number}
            </DialogTitle>
          </DialogHeader>
          {liveDetailSale && (
            <div className="space-y-5">
              {/* Invoice info */}
              <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-4 text-sm">
                <div><p className="text-xs text-muted-foreground">N° facture</p><p className="font-mono">{liveDetailSale.sale_number}</p></div>
                <div><p className="text-xs text-muted-foreground">Date facture</p><p>{formatDate(liveDetailSale.created_at)}</p></div>
                <div><p className="text-xs text-muted-foreground">Client</p><p>{liveDetailSale.customers?.full_name ?? "Client de passage"}</p></div>
                <div><p className="text-xs text-muted-foreground">Téléphone</p><p>{liveDetailSale.customers?.phone ?? "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Montant initial</p><p className="font-medium">{formatDZD(liveDetailSale.total_amount)}</p></div>
                <div><p className="text-xs text-muted-foreground">Déjà payé</p><p className="font-medium">{formatDZD(liveDetailSale.amount_paid)}</p></div>
              </div>

              {/* Balance indicator */}
              {balanceOf(liveDetailSale) <= 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm font-medium text-primary">
                  <CheckCircle2 className="h-5 w-5" /> Facture entièrement réglée
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                  <span className="text-sm text-muted-foreground">Solde restant</span>
                  <span className="text-lg font-semibold text-destructive">{formatDZD(balanceOf(liveDetailSale))}</span>
                </div>
              )}

              {/* Timeline */}
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <History className="h-4 w-4 text-primary" /> Historique des paiements
                </div>
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Heure</TableHead>
                        <TableHead className="text-right">Montant</TableHead>
                        <TableHead>Mode</TableHead>
                        <TableHead>Enregistré par</TableHead>
                        <TableHead className="text-right">Reste après</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timelineFor(liveDetailSale).map((e) => (
                        <TableRow key={e.id}>
                          <TableCell className="text-sm">{formatDate(e.paidAt)}</TableCell>
                          <TableCell className="text-sm">{formatTime(e.paidAt)}</TableCell>
                          <TableCell className="text-right text-sm font-medium">{formatDZD(e.amount)}</TableCell>
                          <TableCell className="text-sm">{e.method ? paymentLabel(e.method) : "—"}</TableCell>
                          <TableCell className="text-sm">{e.by}</TableCell>
                          <TableCell className="text-right text-sm">{formatDZD(e.remaining)}</TableCell>
                        </TableRow>
                      ))}
                      {timelineFor(liveDetailSale).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                            Aucun paiement enregistré pour le moment.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {liveDetailSale && balanceOf(liveDetailSale) > 0 && (
              <Button onClick={() => { setDetailOpen(false); openPay(liveDetailSale); }}>
                <Plus className="mr-2 h-4 w-4" /> Ajouter un paiement
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
