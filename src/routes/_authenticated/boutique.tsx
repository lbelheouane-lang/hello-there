import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Store, Upload, Trash2, Save, Building2, FileText, Palette, Image as ImageIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  type StoreSettings,
  DEFAULT_SETTINGS,
  useStoreSettings,
  setStoreSettingsCache,
  getStoreSettings,
  fetchStoreSettings,
  STORE_SETTINGS_QUERY_KEY,
  CURRENCY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "@/lib/store-settings";
import { buildInvoiceHtml, type InvoiceRecord } from "@/lib/invoice";
import { buildReceiptHtml, type ReceiptData } from "@/lib/receipt";

export const Route = createFileRoute("/_authenticated/boutique")({
  component: StorePage,
});

const MAX_LOGO_PX = 400;

function fileToLogo(file: File, square: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === "image/svg+xml") {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let sx = 0, sy = 0, sw = img.width, sh = img.height;
        if (square) {
          const side = Math.min(img.width, img.height);
          sx = (img.width - side) / 2;
          sy = (img.height - side) / 2;
          sw = sh = side;
        }
        const scale = Math.min(1, MAX_LOGO_PX / Math.max(sw, sh));
        canvas.width = Math.round(sw * scale);
        canvas.height = Math.round(sh * scale);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
        const isPng = file.type === "image/png";
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", 0.9));
      };
      img.onerror = reject;
      img.src = r.result as string;
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function sampleInvoice(): InvoiceRecord {
  return {
    id: "preview", invoice_number: `${getStoreSettings().invoice_prefix}-2026-000123`,
    invoice_type: "sale", sale_number: "V-000123",
    customer_name: "Amina Benali", customer_phone: "+213 661 00 11 22",
    customer_address: "Cité 1000 logements, Alger",
    product_sku: "BJ-001", product_name: "Bague solitaire éclat", metal_type: "or",
    gold_karat: 18, weight_grams: 3.2, quantity: 1, unit_price: 98000, discount: 0,
    total_amount: 98000, amount_this_tx: 60000, total_paid: 60000, balance: 38000,
    payment_method: "especes", payment_status: "partial", sale_type: "installment",
    employee_name: "Karim H.", notes: null, issued_at: new Date().toISOString(),
  };
}

function sampleReceipt(): ReceiptData {
  return {
    storeName: getStoreSettings().store_name, receiptNumber: `${getStoreSettings().receipt_prefix}-2026-000045`,
    customerName: "Amina Benali", customerPhone: "+213 661 00 11 22",
    invoiceNumber: "V-000123", paidAt: new Date().toISOString(), paymentMethod: "especes",
    amount: 20000, totalAmount: 98000, totalPaid: 80000, balance: 18000,
    employeeName: "Karim H.", notes: null,
  };
}

/** Renders document HTML using a draft (without persisting the cache change). */
function withDraft<T>(draft: StoreSettings, build: () => T): T {
  const prev = getStoreSettings();
  setStoreSettingsCache(draft);
  try {
    return build();
  } finally {
    setStoreSettingsCache(prev);
  }
}

function StorePage() {
  const qc = useQueryClient();
  const { data } = useStoreSettings();
  const [form, setForm] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const fileRef = useRef<HTMLInputElement>(null);
  const [squareCrop, setSquareCrop] = useState(true);

  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  function set<K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        store_name: form.store_name, slogan: form.slogan, tagline: form.tagline,
        logo_url: form.logo_url, address: form.address, phone: form.phone, email: form.email,
        website: form.website, social: form.social, tax_id: form.tax_id,
        currency: form.currency, language: form.language,
        invoice_prefix: form.invoice_prefix, receipt_prefix: form.receipt_prefix,
        invoice_header: form.invoice_header, invoice_footer: form.invoice_footer,
        thank_you_message: form.thank_you_message, terms: form.terms,
        signature_left: form.signature_left, signature_right: form.signature_right,
      };
      const { error } = await supabase
        .from("store_settings")
        .update(payload)
        .eq("singleton", true);
      if (error) throw error;
    },
    onSuccess: async () => {
      const fresh = await fetchStoreSettings();
      setStoreSettingsCache(fresh);
      qc.setQueryData(STORE_SETTINGS_QUERY_KEY, fresh);
      qc.invalidateQueries({ queryKey: STORE_SETTINGS_QUERY_KEY });
      toast.success("Paramètres de la boutique enregistrés.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onPickLogo(file: File | undefined) {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/svg+xml"].includes(file.type)) {
      toast.error("Formats acceptés : PNG, JPG, SVG.");
      return;
    }
    try {
      const dataUrl = await fileToLogo(file, squareCrop);
      if (dataUrl.length > 1_400_000) {
        toast.error("Logo trop volumineux après traitement. Choisissez une image plus simple.");
        return;
      }
      set("logo_url", dataUrl);
    } catch {
      toast.error("Impossible de traiter cette image.");
    }
  }

  const invoiceHtml = useMemo(() => withDraft(form, () => buildInvoiceHtml(sampleInvoice())), [form]);
  const receiptHtml = useMemo(() => withDraft(form, () => buildReceiptHtml(sampleReceipt())), [form]);

  const social = form.social ?? {};
  function setSocial(key: string, value: string) {
    set("social", { ...social, [key]: value });
  }

  return (
    <AppShell title="Boutique" allow={["admin"]}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-serif text-2xl font-semibold">
              <Store className="h-6 w-6 text-primary" /> Paramètres de la boutique
            </h2>
            <p className="text-sm text-muted-foreground">
              Personnalisez l'identité, le logo et les documents de votre bijouterie.
            </p>
          </div>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            <Save className="mr-2 h-4 w-4" /> Enregistrer les modifications
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_440px]">
          <div className="space-y-6">
            <Tabs defaultValue="profile">
              <TabsList className="flex flex-wrap">
                <TabsTrigger value="profile"><Building2 className="mr-2 h-4 w-4" />Profil</TabsTrigger>
                <TabsTrigger value="logo"><ImageIcon className="mr-2 h-4 w-4" />Logo</TabsTrigger>
                <TabsTrigger value="documents"><FileText className="mr-2 h-4 w-4" />Documents</TabsTrigger>
                <TabsTrigger value="prefs"><Palette className="mr-2 h-4 w-4" />Préférences</TabsTrigger>
              </TabsList>

              <TabsContent value="profile" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Profil de la boutique</CardTitle>
                    <CardDescription>Informations affichées sur l'application et les documents.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nom de la boutique">
                      <Input value={form.store_name} onChange={(e) => set("store_name", e.target.value)} />
                    </Field>
                    <Field label="Slogan (optionnel)">
                      <Input value={form.slogan ?? ""} onChange={(e) => set("slogan", e.target.value || null)} />
                    </Field>
                    <Field label="Sous-titre / activité">
                      <Input value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value || null)} />
                    </Field>
                    <Field label="Téléphone">
                      <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} />
                    </Field>
                    <Field label="Adresse" className="sm:col-span-2">
                      <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value || null)} />
                    </Field>
                    <Field label="Email (optionnel)">
                      <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value || null)} />
                    </Field>
                    <Field label="Site web (optionnel)">
                      <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value || null)} />
                    </Field>
                    <Field label="N° d'identification fiscale (optionnel)" className="sm:col-span-2">
                      <Input value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value || null)} />
                    </Field>
                    <Field label="Facebook (optionnel)">
                      <Input value={social.facebook ?? ""} onChange={(e) => setSocial("facebook", e.target.value)} />
                    </Field>
                    <Field label="Instagram (optionnel)">
                      <Input value={social.instagram ?? ""} onChange={(e) => setSocial("instagram", e.target.value)} />
                    </Field>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logo" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Logo de la boutique</CardTitle>
                    <CardDescription>PNG, JPG ou SVG. Affiché dans l'application et sur les documents.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-5">
                      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-2xl border bg-muted/30">
                        {form.logo_url ? (
                          <img src={form.logo_url} alt="Logo" className="h-full w-full object-contain" />
                        ) : (
                          <Store className="h-10 w-10 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-3">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml"
                          className="hidden"
                          onChange={(e) => onPickLogo(e.target.files?.[0])}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" onClick={() => fileRef.current?.click()}>
                            <Upload className="mr-2 h-4 w-4" /> {form.logo_url ? "Remplacer" : "Téléverser"}
                          </Button>
                          {form.logo_url && (
                            <Button variant="ghost" className="text-destructive" onClick={() => set("logo_url", null)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Supprimer
                            </Button>
                          )}
                        </div>
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input type="checkbox" checked={squareCrop} onChange={(e) => setSquareCrop(e.target.checked)} />
                          Recadrer en carré (centré)
                        </label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Les images matricielles sont automatiquement redimensionnées (max {MAX_LOGO_PX}px) pour rester légères.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="documents" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Personnalisation des documents</CardTitle>
                    <CardDescription>S'applique aux factures, reçus, et exports PDF.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <Field label="Préfixe de facture">
                      <Input value={form.invoice_prefix} onChange={(e) => set("invoice_prefix", e.target.value)} />
                    </Field>
                    <Field label="Préfixe de reçu de paiement">
                      <Input value={form.receipt_prefix} onChange={(e) => set("receipt_prefix", e.target.value)} />
                    </Field>
                    <Field label="En-tête (haut du document)" className="sm:col-span-2">
                      <Textarea rows={2} value={form.invoice_header ?? ""} onChange={(e) => set("invoice_header", e.target.value || null)} />
                    </Field>
                    <Field label="Message de remerciement" className="sm:col-span-2">
                      <Textarea rows={2} value={form.thank_you_message ?? ""} onChange={(e) => set("thank_you_message", e.target.value || null)} />
                    </Field>
                    <Field label="Texte de pied de page" className="sm:col-span-2">
                      <Textarea rows={2} value={form.invoice_footer ?? ""} onChange={(e) => set("invoice_footer", e.target.value || null)} />
                    </Field>
                    <Field label="Conditions générales (optionnel)" className="sm:col-span-2">
                      <Textarea rows={3} value={form.terms ?? ""} onChange={(e) => set("terms", e.target.value || null)} />
                    </Field>
                    <Field label="Libellé signature (gauche)">
                      <Input value={form.signature_left ?? ""} onChange={(e) => set("signature_left", e.target.value || null)} />
                    </Field>
                    <Field label="Libellé signature (droite)">
                      <Input value={form.signature_right ?? ""} onChange={(e) => set("signature_right", e.target.value || null)} />
                    </Field>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="prefs" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Préférences</CardTitle>
                    <CardDescription>Devise et langue par défaut de la boutique.</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    <Field label="Devise">
                      <Select value={form.currency} onValueChange={(v) => set("currency", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Langue par défaut">
                      <Select value={form.language} onValueChange={(v) => set("language", v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Aperçu en direct</CardTitle>
                <CardDescription>Visualisez vos documents avant d'enregistrer.</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="invoice">
                  <TabsList className="w-full">
                    <TabsTrigger value="invoice" className="flex-1">Facture</TabsTrigger>
                    <TabsTrigger value="receipt" className="flex-1">Reçu</TabsTrigger>
                  </TabsList>
                  <TabsContent value="invoice" className="mt-3">
                    <iframe title="Aperçu facture" className="h-[60vh] w-full rounded-lg border bg-white" srcDoc={invoiceHtml} />
                  </TabsContent>
                  <TabsContent value="receipt" className="mt-3">
                    <iframe title="Aperçu reçu" className="h-[60vh] w-full rounded-lg border bg-white" srcDoc={receiptHtml} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-sm">{label}</Label>
      {children}
    </div>
  );
}
