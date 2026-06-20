import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Tag } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import {
  METAL_TYPES, formatGrams, formatDZD, statusLabel,
} from "@/lib/format";
import { LabelDialog, type LabelProduct } from "@/components/LabelDialog";

export const Route = createFileRoute("/_authenticated/produit/$id")({
  component: ProductDetailPage,
});

interface ProductRow {
  id: string;
  internal_code: string;
  name: string;
  category: string;
  metal_type: string;
  gold_karat: number | null;
  weight_grams: number;
  metal_purchase_price: number;
  labor_cost: number;
  origin: string | null;
  status: string;
  created_at: string;
  supplier_id: string | null;
  is_demo: boolean;
  suppliers: { name: string } | null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-border/60 py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function ProductDetailPage() {
  const { id } = useParams({ from: "/_authenticated/produit/$id" });
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const [labelOpen, setLabelOpen] = useState(false);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, suppliers(name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as ProductRow | null;
    },
  });

  const metal = product?.gold_karat
    ? `Or ${product.gold_karat}K`
    : METAL_TYPES.find((m) => m.value === product?.metal_type)?.label ?? product?.metal_type;

  const labelProduct: LabelProduct | null = product
    ? { ...product, supplier_name: product.suppliers?.name ?? null }
    : null;

  return (
    <AppShell title="Fiche produit">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/stock"><ArrowLeft className="mr-2 h-4 w-4" /> Retour au stock</Link>
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : !product ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Produit introuvable.
          </CardContent>
        </Card>
      ) : (
        <div className="mx-auto max-w-xl space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="font-serif text-2xl">{product.name}</CardTitle>
                <p className="mt-1 font-mono text-sm text-muted-foreground">{product.internal_code}</p>
              </div>
              <Badge>{statusLabel(product.status)}</Badge>
            </CardHeader>
            <CardContent>
              <Row label="Catégorie" value={product.category} />
              <Row label="Métal" value={metal} />
              <Row label="Poids" value={formatGrams(Number(product.weight_grams))} />
              <Row label="Fournisseur" value={product.suppliers?.name ?? "—"} />
              <Row label="Origine" value={product.origin ?? "—"} />
              <Row label="Date d'entrée" value={new Date(product.created_at).toLocaleDateString("fr-DZ")} />
              {isAdmin && (
                <>
                  <Row label="Prix d'achat du métal" value={formatDZD(Number(product.metal_purchase_price))} />
                  <Row label="Coût main-d'œuvre" value={formatDZD(Number(product.labor_cost))} />
                </>
              )}
            </CardContent>
          </Card>

          {isAdmin && (
            <Button className="w-full" onClick={() => setLabelOpen(true)}>
              <Tag className="mr-2 h-4 w-4" /> Étiquette & QR code
            </Button>
          )}
        </div>
      )}

      <LabelDialog
        products={labelOpen && labelProduct ? [labelProduct] : null}
        onClose={() => setLabelOpen(false)}
        isAdmin={isAdmin}
      />
    </AppShell>
  );
}
