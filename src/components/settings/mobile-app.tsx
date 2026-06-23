import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  Smartphone,
  QrCode,
  ShieldOff,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  RotateCw,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getPairingState, generatePairing, revokeDevice,
} from "@/lib/mobile-pairing.functions";

const EXPIRY_OPTIONS = [
  { value: "5", label: "5 minutes" },
  { value: "15", label: "15 minutes" },
  { value: "60", label: "1 heure" },
  { value: "1440", label: "24 heures" },
];

function fmt(d: string | null): string {
  return d ? new Date(d).toLocaleString("fr-FR") : "—";
}

function MobileAccessQrCard() {
  const { data: settings } = useStoreSettings();
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [version, setVersion] = useState(() => Date.now());

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://orusdz.lovable.app";
  const params = new URLSearchParams();
  if (settings?.id) params.set("store", settings.id);
  if (settings?.store_name) params.set("name", settings.store_name);
  params.set("v", String(version));
  const mobileUrl = `${origin}/mobile?${params.toString()}`;

  useEffect(() => {
    QRCode.toDataURL(mobileUrl, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [mobileUrl]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          QR code d'accès mobile
        </CardTitle>
        <CardDescription>
          Scannez ce code avec un téléphone pour ouvrir la version mobile de
          l'application. Après connexion, l'app peut être ajoutée à l'écran
          d'accueil pour une expérience plein écran.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6">
          {qrImage ? (
            <img
              src={qrImage}
              alt="QR code d'accès mobile"
              className="h-56 w-56 rounded-lg bg-white p-2"
            />
          ) : (
            <div className="h-56 w-56 animate-pulse rounded-lg bg-muted" />
          )}
          <p className="max-w-sm break-all text-center text-xs text-muted-foreground">
            {mobileUrl}
          </p>
        </div>
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => setVersion(Date.now())}>
            <RefreshCw className="mr-2 h-4 w-4" /> Régénérer le QR code
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function MobileAppCard() {
  return (
    <div className="space-y-6">
      <MobileAccessQrCard />
      <MobilePairingCard />
    </div>
  );
}

function MobilePairingCard() {
  const qc = useQueryClient();
  const fetchState = useServerFn(getPairingState);
  const generate = useServerFn(generatePairing);
  const revoke = useServerFn(revokeDevice);

  const [expiry, setExpiry] = useState("15");
  const [qrImage, setQrImage] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["mobile-pairing"],
    queryFn: () => fetchState(),
    refetchInterval: 5000,
  });

  // Render a QR image whenever a pending payload is available.
  useEffect(() => {
    const payload = data?.pending?.qrPayload;
    if (!payload) {
      setQrImage(null);
      return;
    }
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [data?.pending?.qrPayload]);

  const genMut = useMutation({
    mutationFn: () => generate({ data: { expiresInMinutes: Number(expiry) } }),
    onSuccess: () => {
      toast.success("Nouveau QR code généré.");
      qc.invalidateQueries({ queryKey: ["mobile-pairing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: (id?: string) => revoke({ data: id ? { id } : {} }),
    onSuccess: () => {
      toast.success("Appareil déconnecté.");
      qc.invalidateQueries({ queryKey: ["mobile-pairing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const devices = data?.devices ?? [];
  const pending = data?.pending ?? null;
  const busy = genMut.isPending || revokeMut.isPending;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Application mobile
          {devices.length > 0 ? (
            <Badge className="gap-1"><Wifi className="h-3 w-3" /> {devices.length} connecté{devices.length > 1 ? "s" : ""}</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Aucun appareil</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Appairez l'application mobile compagnon à cette boutique via un QR code
          sécurisé. Chaque appareil n'accède qu'aux données de cette boutique,
          selon les permissions de l'utilisateur connecté.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connected devices list */}
        {devices.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Appareils connectés</p>
            <div className="divide-y rounded-lg border">
              {devices.map((d) => (
                <div key={d.id} className="flex flex-wrap items-center gap-3 p-3">
                  <Smartphone className="h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                    <p className="font-medium">{d.device_name ?? "Appareil mobile"}</p>
                    <p className="text-xs text-muted-foreground">
                      Connecté le {fmt(d.paired_at)} · Dernière synchro {fmt(d.last_sync)}
                    </p>
                  </div>
                  <Badge className="gap-1"><Wifi className="h-3 w-3" /> Connecté</Badge>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => revokeMut.mutate(d.id)}
                    disabled={busy}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" /> Révoquer
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending QR */}
        {pending && qrImage && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6">
            <img src={qrImage} alt="QR code d'appairage" className="h-56 w-56 rounded-lg bg-white p-2" />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Expire le {fmt(pending.expires_at)}
            </p>
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Scannez ce code depuis l'application mobile pour appairer l'appareil.
              Le QR devient invalide après expiration ou révocation.
            </p>
            <Button variant="destructive" size="sm" onClick={() => revokeMut.mutate(pending.id)} disabled={busy}>
              <ShieldOff className="mr-2 h-4 w-4" /> Annuler le QR
            </Button>
          </div>
        )}

        {/* Generate controls */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Durée de validité du QR</p>
            <Select value={expiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EXPIRY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => genMut.mutate()} disabled={busy || isLoading}>
            {pending ? <RefreshCw className="mr-2 h-4 w-4" /> : <QrCode className="mr-2 h-4 w-4" />}
            {pending ? "Régénérer le QR code" : devices.length > 0 ? "Appairer un nouvel appareil" : "Générer le QR code"}
          </Button>
          <Button
            variant="outline"
            onClick={() => qc.invalidateQueries({ queryKey: ["mobile-pairing"] })}
            disabled={busy}
          >
            <RotateCw className="mr-2 h-4 w-4" /> Actualiser
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
