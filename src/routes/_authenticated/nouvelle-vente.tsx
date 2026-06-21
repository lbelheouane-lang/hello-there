import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ShoppingCart, Search, Check, UserPlus, ScanLine, Layers, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  PAYMENT_METHODS, METAL_TYPES, formatDZD, formatGrams, metalValue, statusLabel,
} from "@/lib/format";
import { dzdFromEur } from "@/lib/currency";
import { useLatestGoldPrices, priceForKarat } from "@/hooks/use-gold-prices";
import { QrScanDialog } from "@/components/QrScanDialog";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { parseScannedCode } from "@/lib/scan";

export const Route = createFileRoute("/_authenticated/nouvelle-vente")({
  component: NewSalePage,
});

interface SaleProduct {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  metal_purchase_price: number | null;
  quantity: number;
}

interface CustomerOption {
  id: string;
  full_name: string;
  phone: string | null;
}

function NewSalePage() {
  const qc = useQueryClient();
  
  const { data: prices } = useLatestGoldPrices();

  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("");
  const [quantity, setQuantity] = useState("1");
  const [totalAmount, setTotalAmount] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0].value);
  const [notes, setNotes] = useState("");
  const [saleType, setSaleType] = useState<"full" | "installment">("full");
  const [dueDate, setDueDate] = useState("");

  // Quick add customer
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");

  // Scanning (USB barcode + camera QR)
  const [scanOpen, setScanOpen] = useState(false);
  const [setDialog, setSetDialog] = useState<{
    reference: string;
    name: string;
    items: SaleProduct[];
  } | null>(null);

  const { data: products } = useQuery({
    queryKey: ["products", "for-sale"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, internal_code, name, category, metal_type, gold_karat, weight_grams, metal_purchase_price, quantity")
        .eq("status", "en_stock")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SaleProduct[];
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, full_name, phone").order("full_name");
      if (error) throw error;
      return data as CustomerOption[];
    },
  });

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const q = productSearch.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) || p.internal_code.toLowerCase().includes(q),
    );
  }, [products, productSearch]);

  const selectedProduct = products?.find((p) => p.id === productId) ?? null;
  // Le cours de l'or est en EUR (devise de base) ; la valeur métal est convertie
  // en DZD pour toutes les ventes et documents.
  const suggestedValue = selectedProduct
    ? dzdFromEur(metalValue(
        Number(selectedProduct.weight_grams),
        selectedProduct.metal_type === "or" ? priceForKarat(prices, selectedProduct.gold_karat) : null,
      ))
    : 0;

  // Select a product into the sale form, pre-filling quantity and the
  // suggested total from its metal value.
  function selectProduct(p: SaleProduct) {
    setProductId(p.id);
    setQuantity("1");
    const ppg = p.metal_type === "or" ? priceForKarat(prices, p.gold_karat) : null;
    const valueDzd = dzdFromEur(metalValue(Number(p.weight_grams), ppg));
    if (valueDzd) setTotalAmount(String(Math.round(valueDzd)));
  }

  // Resolve a scanned barcode / QR code to a product or a jewelry set.
  async function handleScan(raw: string) {
    const parsed = parseScannedCode(raw);

    // Jewelry set QR → open the set with its pieces
    if (parsed.setId) {
      const { data: set } = await supabase
        .from("jewelry_sets")
        .select("id, reference, name")
        .eq("id", parsed.setId)
        .maybeSingle();
      if (!set) {
        toast.error("Parure introuvable pour ce code.");
        return;
      }
      const { data: items } = await supabase
        .from("products")
        .select("id, internal_code, name, category, metal_type, gold_karat, weight_grams, metal_purchase_price, quantity, status")
        .eq("set_id", set.id)
        .order("name");
      setSetDialog({
        reference: set.reference,
        name: set.name,
        items: (items ?? []) as unknown as SaleProduct[],
      });
      return;
    }

    // Otherwise look up a single product by id or SKU (internal code)
    let query = supabase
      .from("products")
      .select("id, internal_code, name, category, metal_type, gold_karat, weight_grams, metal_purchase_price, quantity, status");
    if (parsed.productId) query = query.eq("id", parsed.productId);
    else if (parsed.sku) query = query.ilike("internal_code", parsed.sku);
    else {
      toast.error("Code non reconnu.");
      return;
    }
    const { data: prod } = await query.maybeSingle();
    if (!prod) {
      toast.error("Aucun bijou trouvé pour ce code.");
      return;
    }
    if (prod.status !== "en_stock" || Number(prod.quantity) <= 0) {
      toast.error(`« ${prod.name} » n'est pas disponible à la vente.`);
      return;
    }
    selectProduct(prod as unknown as SaleProduct);
    toast.success(`« ${prod.name} » ajouté à la vente.`);
  }

  // USB barcode scanner (keyboard-wedge mode)
  useBarcodeScanner((code) => { void handleScan(code); });

  // Add a piece from the scanned set into the sale
  function addSetItem(p: SaleProduct) {
    if (p.status !== "en_stock" || Number(p.quantity) <= 0) {
      toast.error(`« ${p.name} » n'est pas disponible.`);
      return;
    }
    selectProduct(p);
    setSetDialog(null);
    toast.success(`« ${p.name} » ajouté à la vente.`);
  }

    mutationFn: async () => {
      if (!newCustomerName.trim()) throw new Error("Le nom du client est obligatoire.");
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("customers")
        .insert({
          full_name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || null,
          created_by: u.user?.id,
        })
        .select("id, full_name, phone")
        .single();
      if (error) throw error;
      return data as CustomerOption;
    },
    onSuccess: (c) => {
      toast.success("Client ajouté");
      setNewCustomerName("");
      setNewCustomerPhone("");
      qc.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(c.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const register = useMutation({
    mutationFn: async () => {
      if (!selectedProduct) throw new Error("Sélectionnez un bijou à vendre.");
      const qty = Math.floor(Number(quantity));
      if (!qty || qty <= 0) throw new Error("La quantité doit être un nombre entier positif.");
      if (qty > Number(selectedProduct.quantity))
        throw new Error(`Stock insuffisant : ${selectedProduct.quantity} pièce(s) disponible(s).`);
      const total = Number(totalAmount);
      if (!total || total <= 0) throw new Error("Indiquez le montant total de la vente.");
      const isInstallment = saleType === "installment";
      const paid = isInstallment ? Number(amountPaid) || 0 : Number(amountPaid) || total;
      if (isInstallment && paid >= total)
        throw new Error("Pour un paiement échelonné, l'acompte doit être inférieur au total.");
      const { data: u } = await supabase.auth.getUser();
      const saleNumber = `V-${Date.now().toString(36).toUpperCase().slice(-6)}`;
      // L'inventaire (quantité + statut) est mis à jour automatiquement par le
      // trigger apply_sale_to_inventory côté base de données.
      const { error } = await supabase.from("sales").insert({
        sale_number: saleNumber,
        customer_id: customerId || null,
        product_id: selectedProduct.id,
        product_name: selectedProduct.name,
        weight_grams: Number(selectedProduct.weight_grams),
        quantity: qty,
        purchase_price_per_gram:
          Number(selectedProduct.weight_grams) > 0 && selectedProduct.metal_purchase_price != null
            ? Number(selectedProduct.metal_purchase_price) / Number(selectedProduct.weight_grams)
            : null,
        total_amount: total,
        amount_paid: paid,
        payment_method: paymentMethod,
        sale_type: saleType,
        due_date: isInstallment && dueDate ? dueDate : null,
        notes: notes.trim() || null,
        sold_by: u.user?.id,
      });
      if (error) throw error;
      return saleNumber;
    },
    onSuccess: (saleNumber) => {
      toast.success(`Vente ${saleNumber} enregistrée`);
      setProductId("");
      setCustomerId("");
      setQuantity("1");
      setTotalAmount("");
      setAmountPaid("");
      setNotes("");
      setSaleType("full");
      setDueDate("");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Nouvelle vente">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Product selection */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-primary" /> Bijou à vendre
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rechercher par nom ou code…" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} />
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {filteredProducts.map((p) => {
                const ppg = p.metal_type === "or" ? priceForKarat(prices, p.gold_karat) : null;
                const valueDzd = dzdFromEur(metalValue(Number(p.weight_grams), ppg));
                const active = p.id === productId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setProductId(p.id);
                      setQuantity("1");
                      if (valueDzd) setTotalAmount(String(Math.round(valueDzd)));
                    }}
                    className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{p.internal_code}</span>
                        {" · "}{p.gold_karat ? `${p.gold_karat}K` : METAL_TYPES.find((m) => m.value === p.metal_type)?.label}
                        {" · "}{formatGrams(Number(p.weight_grams))}
                        {" · "}{p.quantity} pc
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className="text-sm font-medium">{ppg ? formatDZD(valueDzd) : "—"}</span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </div>
                  </button>
                );
              })}
              {filteredProducts.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">Aucun bijou en stock.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sale details */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Détails de la vente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <Select value={customerId || "none"} onValueChange={(v) => setCustomerId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Client de passage" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Client de passage</SelectItem>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name}{c.phone ? ` · ${c.phone}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProduct && (
                <div className="space-y-2">
                  <Label>Quantité (pièces) *</Label>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    max={selectedProduct.quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {selectedProduct.quantity} pièce(s) en stock
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Montant total (DZD) *</Label>
                <Input type="number" min={0} step="1" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
                {selectedProduct && suggestedValue > 0 && (
                  <p className="text-xs text-muted-foreground">Valeur métal estimée : {formatDZD(suggestedValue)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Type de paiement</Label>
                <Select value={saleType} onValueChange={(v) => setSaleType(v as "full" | "installment")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Paiement intégral</SelectItem>
                    <SelectItem value="installment">Paiement échelonné</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{saleType === "installment" ? "Acompte initial (DZD)" : "Montant payé (DZD)"}</Label>
                <Input
                  type="number"
                  min={0}
                  step="1"
                  placeholder={saleType === "installment" ? "Acompte versé" : "= total si vide"}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
                {saleType === "installment" && Number(totalAmount) > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Reste à payer : {formatDZD(Math.max(Number(totalAmount) - (Number(amountPaid) || 0), 0))}
                  </p>
                )}
              </div>

              {saleType === "installment" && (
                <div className="space-y-2">
                  <Label>Date d'échéance</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label>Mode de paiement</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>

              <Button className="w-full" disabled={register.isPending} onClick={() => register.mutate()}>
                <Check className="mr-2 h-4 w-4" /> Enregistrer la vente
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-primary" /> Nouveau client rapide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Nom complet" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
              <Input placeholder="Téléphone" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} />
              <Button variant="secondary" className="w-full" disabled={addCustomer.isPending} onClick={() => addCustomer.mutate()}>
                Ajouter le client
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
