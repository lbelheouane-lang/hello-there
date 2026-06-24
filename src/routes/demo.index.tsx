import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Gem, ArrowRight, Eye, Lock, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemoFooter } from "@/components/demo/DemoFooter";

export const Route = createFileRoute("/demo/")({
  component: DemoLanding,
  head: () => ({
    meta: [
      { title: "ORUS DZ — Démonstration" },
      {
        name: "description",
        content:
          "Découvrez ORUS DZ, l'ERP pour bijoutiers : stock, ventes, factures et cours de l'or. Version de démonstration publique, en lecture seule.",
      },
    ],
  }),
});

const PUBLISHED_DEMO_URL = "https://orusdz.lovable.app/demo";

function demoUrl(): string {
  if (typeof window !== "undefined" && window.location.origin.startsWith("http")) {
    return `${window.location.origin}/demo`;
  }
  return PUBLISHED_DEMO_URL;
}

function DemoLanding() {
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState(PUBLISHED_DEMO_URL);

  useEffect(() => {
    const target = demoUrl();
    setUrl(target);
    QRCode.toDataURL(target, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then(setQr)
      .catch(() => setQr(null));
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-10 px-4 py-12 md:flex-row md:gap-16">
        <div className="max-w-xl space-y-6 text-center md:text-left">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Eye className="h-3.5 w-3.5" /> Version de démonstration — lecture seule
          </div>
          <div className="flex items-center justify-center gap-3 md:justify-start">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Gem className="h-6 w-6" />
            </div>
            <h1 className="font-serif text-4xl font-bold tracking-tight">ORUS DZ</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            L'ERP pensé pour les bijoutiers : gestion du stock au gramme, ventes,
            factures, clients, or cassé et cours de l'or en temps réel.
          </p>
          <p className="text-sm text-muted-foreground">
            Explorez librement l'interface complète avec des données fictives.
            Aucune connexion requise — toutes les modifications sont désactivées.
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row md:items-start">
            <Button asChild size="lg" className="gap-2">
              <Link to="/demo/dashboard">
                Lancer la démonstration <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" /> Données fictives · Lecture seule
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-3">
          <div className="rounded-2xl border bg-white p-4 shadow-sm">
            {qr ? (
              <img src={qr} alt="QR code démonstration ORUS DZ" className="h-48 w-48" />
            ) : (
              <div className="flex h-48 w-48 items-center justify-center text-sm text-muted-foreground">
                Génération…
              </div>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Smartphone className="h-4 w-4 text-primary" />
            Scannez pour ouvrir sur mobile
          </p>
          <code className="max-w-[16rem] truncate rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
            {url}
          </code>
        </div>
      </main>
      <DemoFooter />
    </div>
  );
}
