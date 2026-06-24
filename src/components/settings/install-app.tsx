import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Download, Smartphone, Share, Plus, MonitorCheck, CheckCircle2, QrCode, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Public address customers open on their phone to install the app. We always
 *  point the QR at the published site (never the Lovable editor/preview origin,
 *  which is not installable). */
const PUBLISHED_URL = "https://orusdz.lovable.app";

function installUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isPreview =
      host.includes("lovableproject.com") ||
      host.includes("lovable.dev") ||
      host.startsWith("id-preview--") ||
      host.startsWith("preview--");
    if (!isPreview && window.location.origin.startsWith("http")) {
      return window.location.origin;
    }
  }
  return PUBLISHED_URL;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

export function InstallAppCard() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [url, setUrl] = useState(PUBLISHED_URL);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const target = installUrl();
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Lien copié");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le lien");
    }
  };


  useEffect(() => {
    setInstalled(isStandalone());

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  const ios = isIos();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Installer l'application Orus
        </CardTitle>
        <CardDescription>
          Installez Orus sur votre appareil pour un accès rapide en plein écran, comme une
          application native — sans barre d'adresse ni onglets du navigateur.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {installed ? (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            <p>Orus est déjà installée sur cet appareil. Lancez-la depuis votre écran d'accueil.</p>
          </div>
        ) : deferred ? (
          <Button onClick={install} className="gap-2">
            <Download className="h-4 w-4" />
            Installer Orus maintenant
          </Button>
        ) : ios ? (
          <div className="space-y-2 rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">Sur iPhone / iPad (Safari) :</p>
            <p className="flex items-center gap-1.5">
              1. Appuyez sur <Share className="h-4 w-4" /> Partager dans la barre Safari.
            </p>
            <p className="flex items-center gap-1.5">
              2. Choisissez <Plus className="h-4 w-4" /> « Sur l'écran d'accueil ».
            </p>
            <p>3. Confirmez avec « Ajouter ».</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-start gap-2 rounded-lg border bg-muted/30 p-4 text-sm">
              <MonitorCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="font-medium">Comment installer :</p>
                <p>
                  Ouvrez le site publié <span className="font-medium">https://orusdz.lovable.app</span>{" "}
                  dans Chrome, Edge ou Safari, puis utilisez l'icône d'installation
                  <span className="inline-flex items-center gap-1"> <Download className="h-3.5 w-3.5" /> </span>
                  dans la barre d'adresse, ou le menu « Installer Orus / Ajouter à l'écran d'accueil ».
                </p>
                <p className="text-muted-foreground">
                  Le bouton d'installation automatique n'apparaît pas dans l'aperçu Lovable ni si
                  l'application est déjà installée.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
