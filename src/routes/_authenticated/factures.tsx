import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Search, Printer, Eye, Receipt, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDZD, formatDateTime } from "@/lib/format";
import {
  type InvoiceRecord, buildInvoiceHtml, printInvoice,
  invoiceStatusLabel, invoiceTypeLabel,
} from "@/lib/invoice";

export const Route = createFileRoute("/_authenticated/factures")({
  component: InvoicesPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  overdue: "destructive",
  unpaid: "outline",
};

function InvoicesPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [preview, setPreview] = useState<InvoiceRecord | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return data as unknown as InvoiceRecord[];
    },
  });

  const filtered = useMemo(() => {
    let list = invoices ?? [];
    // Tab scope
    if (tab === "documents") {
      // all documents: sale invoices + payment vouchers
    } else if (tab === "full") {
      list = list.filter((i) => i.invoice_type === "sale" && i.sale_type !== "installment");
    } else if (tab === "installment") {
      list = list.filter((i) => i.invoice_type === "sale" && i.sale_type === "installment");
    } else if (tab === "pending") {
      list = list.filter((i) => i.invoice_type === "sale" && Number(i.balance) > 0);
    } else {
      // all sales
      list = list.filter((i) => i.invoice_type === "sale");
    }
    const q = search.toLowerCase().trim();
    if (q) {
      list = list.filter((i) =>
        i.invoice_number.toLowerCase().includes(q) ||
        (i.customer_name ?? "").toLowerCase().includes(q) ||
        (i.customer_phone ?? "").toLowerCase().includes(q) ||
        (i.sale_number ?? "").toLowerCase().includes(q) ||
        (i.product_name ?? "").toLowerCase().includes(q),
      );
    }
    if (typeFilter !== "all") list = list.filter((i) => i.invoice_type === typeFilter);
    if (statusFilter !== "all") list = list.filter((i) => i.payment_status === statusFilter);
    if (fromDate) list = list.filter((i) => i.issued_at >= fromDate);
    if (toDate) list = list.filter((i) => i.issued_at <= `${toDate}T23:59:59`);
    return list;
  }, [invoices, tab, search, typeFilter, statusFilter, fromDate, toDate]);


  const totalBilled = filtered.reduce((s, i) => s + (i.invoice_type === "sale" ? Number(i.total_amount) : 0), 0);
  const totalCollected = filtered.reduce((s, i) => s + Number(i.amount_this_tx), 0);

  return (
    <AppShell title="Ventes">
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Documents</p>
            <p className="font-serif text-2xl font-semibold">{filtered.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Montant facturé (ventes)</p>
            <p className="font-serif text-2xl font-semibold">{formatDZD(totalBilled)}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Encaissé (transactions)</p>
            <p className="font-serif text-2xl font-semibold">{formatDZD(totalCollected)}</p>
          </CardContent></Card>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="all">Toutes les ventes</TabsTrigger>
            <TabsTrigger value="full">Payées intégralement</TabsTrigger>
            <TabsTrigger value="installment">Ventes échelonnées</TabsTrigger>
            <TabsTrigger value="pending">Paiements en attente</TabsTrigger>
            <TabsTrigger value="documents">Documents (factures &amp; reçus)</TabsTrigger>
          </TabsList>
        </Tabs>


        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">

              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="N° facture, client, téléphone, produit…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les types</SelectItem>
                  <SelectItem value="sale">Facture de vente</SelectItem>
                  <SelectItem value="payment">Reçu de versement</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  <SelectItem value="paid">Soldé</SelectItem>
                  <SelectItem value="partial">Partiellement payé</SelectItem>
                  <SelectItem value="overdue">En retard</SelectItem>
                  <SelectItem value="unpaid">Impayé</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">Du</Label>
                  <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground">Au</Label>
                  <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">N° / Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Client</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2 text-right">Reste</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <div className="font-mono font-medium">{inv.invoice_number}</div>
                        <div className="text-xs text-muted-foreground">{formatDateTime(inv.issued_at)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-xs">
                          {inv.invoice_type === "payment" ? <Receipt className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          {invoiceTypeLabel(inv.invoice_type)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{inv.customer_name}</div>
                        <div className="text-xs text-muted-foreground">{inv.product_name ?? inv.sale_number}</div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatDZD(inv.invoice_type === "payment" ? inv.amount_this_tx : inv.total_amount)}</td>
                      <td className="px-3 py-2 text-right">{formatDZD(inv.balance)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={STATUS_VARIANT[inv.payment_status] ?? "outline"}>{invoiceStatusLabel(inv.payment_status)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" title="Aperçu" onClick={() => setPreview(inv)}><Eye className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" title="Imprimer / PDF" onClick={() => printInvoice(inv)}><Printer className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!isLoading && filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Aucune facture trouvée.</td></tr>
                  )}
                  {isLoading && (
                    <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">Chargement…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={preview != null} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-4">
              <span>Aperçu — {preview?.invoice_number}</span>
              <span className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => preview && printInvoice(preview)}>
                  <Download className="mr-2 h-4 w-4" /> Télécharger PDF
                </Button>
                <Button size="sm" onClick={() => preview && printInvoice(preview)}>
                  <Printer className="mr-2 h-4 w-4" /> Imprimer
                </Button>
              </span>
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <iframe
              title="Aperçu facture"
              className="h-[70vh] w-full rounded-lg border bg-white"
              srcDoc={buildInvoiceHtml(preview)}
            />
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
