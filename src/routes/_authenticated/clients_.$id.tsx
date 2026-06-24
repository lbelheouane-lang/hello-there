import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, Phone, Mail, MapPin, Wallet, CreditCard, Receipt, Printer,
  Plus, TrendingUp, CalendarClock, Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/data-client";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  balanceOf, percentPaid, statusOf, PAYMENT_STATUS_META, isActiveInstallment, makeReceiptNumber,
} from "@/lib/installments";
import { printReceipt, type ReceiptData } from "@/lib/receipt";

export const Route = createFileRoute("/_authenticated/clients_/$id")({
  component: CustomerProfilePage,
});

const STORE_NAME = "Maison d'Or";

interface Customer {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
}

interface Sale {
  id: string;
  sale_number: string;
  product_name: string | null;
  total_amount: number;
  amount_paid: number;
  payment_method: string;
  sale_type: string | null;
  due_date: string | null;
  created_at: string;
}

interface Payment {
  id: string;
  sale_id: string;
  receipt_number: string;
  amount: number;
  payment_method: string;
  paid_at: string;
  recorded_by: string | null;
  notes: string | null;
}

function CustomerProfilePage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [payOpen, setPayOpen] = useState(false);
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState<string>(PAYMENT_METHODS[0].value);
  const [payNotes, setPayNotes] = useState("");

  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
      if (error) throw error;
      return data as Customer;
    },
  });

  const { data: sales } = useQuery({
    queryKey: ["sales", "customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales").select("*").eq("customer_id", id).order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
  });

  const saleIds = useMemo(() => (sales ?? []).map((s) => s.id), [sales]);

  const { data: payments } = useQuery({
    queryKey: ["payments", "customer", id, saleIds.length],
    enabled: saleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments").select("*").in("sale_id", saleIds).order("paid_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
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

  const saleList = sales ?? [];
  const paymentList = payments ?? [];
  const installments = saleList.filter((s) => s.sale_type === "installment");

  // Dashboard metrics
  const totalPurchases = saleList.reduce((s, x) => s + Number(x.total_amount), 0);
  const totalPaid = saleList.reduce((s, x) => s + Number(x.amount_paid), 0);
  const totalOutstanding = saleList.reduce((s, x) => s + balanceOf(x), 0);
  const activePlans = saleList.filter(isActiveInstallment).length;
  const lastPaymentDate = paymentList[0]?.paid_at ?? null;

  function openPay(sale: Sale) {
    setPaySale(sale);
    setPayAmount(String(balanceOf(sale)));
    setPayMethod(PAYMENT_METHODS[0].value);
    setPayNotes("");
    setPayOpen(true);
  }

  function buildReceipt(sale: Sale, amount: number, paidAt: string, method: string, receiptNumber: string, notes: string | null): ReceiptData {
    const totalPaidAfter = Number(sale.amount_paid) + amount;
    return {
      storeName: STORE_NAME,
      receiptNumber,
      customerName: customer?.full_name ?? "—",
      customerPhone: customer?.phone ?? null,
      invoiceNumber: sale.sale_number,
      paidAt,
      paymentMethod: method,
      amount,
      totalAmount: Number(sale.total_amount),
      totalPaid: totalPaidAfter,
      balance: Math.max(Number(sale.total_amount) - totalPaidAfter, 0),
      employeeName: myProfile?.full_name ?? "—",
      notes,
    };
  }

  const registerPayment = useMutation({
    mutationFn: async () => {
      if (!paySale) throw new Error("Aucune vente sélectionnée.");
      const amount = Number(payAmount);
      if (!amount || amount <= 0) throw new Error("Indiquez un montant valide.");
      const max = balanceOf(paySale);
      if (amount > max) throw new Error(`Le montant dépasse le reste à payer (${formatDZD(max)}).`);
      const receiptNumber = makeReceiptNumber();
      const paidAt = new Date().toISOString();
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
      return buildReceipt(paySale, amount, paidAt, payMethod, receiptNumber, payNotes.trim() || null);
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

  function reprint(p: Payment) {
    const sale = saleList.find((s) => s.id === p.sale_id);
    if (!sale) return;
    // Total paid up to and including this payment (chronological)
    const upTo = paymentList
      .filter((x) => x.sale_id === sale.id && new Date(x.paid_at) <= new Date(p.paid_at))
      .reduce((s, x) => s + Number(x.amount), 0);
    const initial = Number(sale.amount_paid) - paymentList.filter((x) => x.sale_id === sale.id).reduce((s, x) => s + Number(x.amount), 0);
    const totalPaidAfter = initial + upTo;
    printReceipt({
      storeName: STORE_NAME,
      receiptNumber: p.receipt_number,
      customerName: customer?.full_name ?? "—",
      customerPhone: customer?.phone ?? null,
      invoiceNumber: sale.sale_number,
      paidAt: p.paid_at,
      paymentMethod: p.payment_method,
      amount: Number(p.amount),
      totalAmount: Number(sale.total_amount),
      totalPaid: totalPaidAfter,
      balance: Math.max(Number(sale.total_amount) - totalPaidAfter, 0),
      employeeName: myProfile?.full_name ?? "—",
      notes: p.notes,
    });
  }

  const cards = [
    { label: "Total achats", value: formatDZD(totalPurchases), icon: TrendingUp },
    { label: "Total payé", value: formatDZD(totalPaid), icon: Wallet },
    { label: "Solde restant", value: formatDZD(totalOutstanding), icon: CreditCard, danger: totalOutstanding > 0 },
    { label: "Plans actifs", value: String(activePlans), icon: CalendarClock },
    { label: "Dernier paiement", value: lastPaymentDate ? formatDate(lastPaymentDate) : "—", icon: Receipt },
  ];

  return (
    <AppShell title={customer?.full_name ?? "Client"}>
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link to="/clients"><ArrowLeft className="mr-2 h-4 w-4" /> Retour aux clients</Link>
        </Button>
      </div>

      {/* Header */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-serif text-2xl font-semibold">{customer?.full_name}</h2>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {customer?.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{customer.phone}</span>}
              {customer?.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{customer.email}</span>}
              {customer?.address && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{customer.address}</span>}
            </div>
          </div>
          {totalOutstanding > 0 && (
            <Badge variant="destructive" className="text-sm">Solde dû : {formatDZD(totalOutstanding)}</Badge>
          )}
        </CardContent>
      </Card>

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

      <Tabs defaultValue="overview">
        <TabsList className="mb-4">
          <TabsTrigger value="overview">Aperçu</TabsTrigger>
          <TabsTrigger value="purchases">Achats</TabsTrigger>
          <TabsTrigger value="installments">Versements</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-4">
          {customer?.notes && (
            <Card><CardContent className="p-4 text-sm"><span className="text-muted-foreground">Notes : </span>{customer.notes}</CardContent></Card>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {installments.map((s) => {
              const meta = PAYMENT_STATUS_META[statusOf(s)];
              return (
                <Card key={s.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-base">
                      <span className="font-mono text-sm">{s.sale_number}</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm">{s.product_name}</p>
                    <Progress value={percentPaid(s)} />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{percentPaid(s)}% payé</span>
                      <span>Reste {formatDZD(balanceOf(s))}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {installments.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun plan de versement.</p>
            )}
          </div>
        </TabsContent>

        {/* Purchases */}
        <TabsContent value="purchases">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Facture</TableHead><TableHead>Article</TableHead><TableHead>Date</TableHead>
                <TableHead>Type</TableHead><TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Payé</TableHead><TableHead>Statut</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {saleList.map((s) => {
                  const meta = PAYMENT_STATUS_META[statusOf(s)];
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-xs">{s.sale_number}</TableCell>
                      <TableCell>{s.product_name}</TableCell>
                      <TableCell>{formatDate(s.created_at)}</TableCell>
                      <TableCell>{s.sale_type === "installment" ? "Échelonné" : "Intégral"}</TableCell>
                      <TableCell className="text-right">{formatDZD(s.total_amount)}</TableCell>
                      <TableCell className="text-right">{formatDZD(s.amount_paid)}</TableCell>
                      <TableCell><Badge variant={meta.variant}>{meta.label}</Badge></TableCell>
                    </TableRow>
                  );
                })}
                {saleList.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />Aucun achat.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* Installments */}
        <TabsContent value="installments" className="space-y-4">
          {installments.map((s) => {
            const meta = PAYMENT_STATUS_META[statusOf(s)];
            const balance = balanceOf(s);
            return (
              <Card key={s.id} className={statusOf(s) === "overdue" ? "border-destructive/50" : ""}>
                <CardContent className="space-y-4 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm">{s.sale_number}</p>
                      <p className="text-sm text-muted-foreground">{s.product_name}</p>
                    </div>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                  </div>
                  <Progress value={percentPaid(s)} />
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div><p className="text-xs text-muted-foreground">Total</p><p className="font-medium">{formatDZD(s.total_amount)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Payé</p><p className="font-medium">{formatDZD(s.amount_paid)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Reste</p><p className="font-medium text-destructive">{formatDZD(balance)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Échéance</p><p className="font-medium">{s.due_date ? formatDate(s.due_date) : "—"}</p></div>
                  </div>
                  {balance > 0 && (
                    <Button size="sm" onClick={() => openPay(s)}>
                      <Plus className="mr-2 h-4 w-4" /> Enregistrer un paiement
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {installments.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">Aucun plan de versement pour ce client.</p>
          )}
        </TabsContent>

        {/* Payment history */}
        <TabsContent value="history">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Reçu</TableHead><TableHead>Facture</TableHead><TableHead>Date</TableHead>
                <TableHead className="text-right">Montant</TableHead><TableHead>Mode</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {paymentList.map((p) => {
                  const sale = saleList.find((s) => s.id === p.sale_id);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.receipt_number}</TableCell>
                      <TableCell className="font-mono text-xs">{sale?.sale_number ?? "—"}</TableCell>
                      <TableCell>{formatDateTime(p.paid_at)}</TableCell>
                      <TableCell className="text-right font-medium">{formatDZD(p.amount)}</TableCell>
                      <TableCell>{paymentLabel(p.payment_method)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => reprint(p)}>
                          <Printer className="mr-1 h-4 w-4" /> Réimprimer
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {paymentList.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />Aucun paiement enregistré.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      {/* Payment dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouveau paiement — {paySale?.sale_number}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {paySale && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Total facture</span><span>{formatDZD(paySale.total_amount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Déjà payé</span><span>{formatDZD(paySale.amount_paid)}</span></div>
                <div className="flex justify-between font-medium"><span className="text-muted-foreground">Reste à payer</span><span className="text-destructive">{formatDZD(balanceOf(paySale))}</span></div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Montant versé (DZD) *</Label>
              <Input type="number" min={0} step="1" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
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
    </AppShell>
  );
}
