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
  CheckCircle2,
  Clock,
  Wifi,
  WifiOff,
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

export function MobileAppCard() {
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
    const payload = data?.pairing?.qrPayload;
    if (!payload) {
      setQrImage(null);
      return;
    }
    QRCode.toDataURL(payload, { errorCorrectionLevel: "M", margin: 1, width: 320 })
      .then(setQrImage)
      .catch(() => setQrImage(null));
  }, [data?.pairing?.qrPayload]);

  const genMut = useMutation({
    mutationFn: () => generate({ data: { expiresInMinutes: Number(expiry) } }),
    onSuccess: () => {
      toast.success("Nouveau QR code généré.");
      qc.invalidateQueries({ queryKey: ["mobile-pairing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeMut = useMutation({
    mutationFn: () => revoke(),
    onSuccess: () => {
      toast.success("Appareil révoqué.");
      setQrImage(null);
      qc.invalidateQueries({ queryKey: ["mobile-pairing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const connected = data?.connected ?? false;
  const pending = data?.status === "pending";
  const busy = genMut.isPending || revokeMut.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          Application mobile
          {connected ? (
            <Badge className="gap-1"><Wifi className="h-3 w-3" /> Connecté</Badge>
          ) : (
            <Badge variant="secondary" className="gap-1"><WifiOff className="h-3 w-3" /> Non connecté</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Appairez l'application mobile compagnon à cette boutique en scannant un
          QR code sécurisé. L'appareil n'accède qu'aux données de cette boutique,
          selon les permissions de l'utilisateur connecté.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connected device */}
        {connected && data?.pairing && (
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1 space-y-1 text-sm">
              <p className="font-medium">{data.pairing.device_name ?? "Appareil mobile"}</p>
              {data.pairing.paired_at && (
                <p className="text-muted-foreground">
                  Appairé le {new Date(data.pairing.paired_at).toLocaleString("fr-FR")}
                </p>
              )}
              {data.pairing.device_user_agent && (
                <p className="truncate text-xs text-muted-foreground">{data.pairing.device_user_agent}</p>
              )}
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => revokeMut.mutate()}
              disabled={busy}
            >
              <ShieldOff className="mr-2 h-4 w-4" /> Révoquer l'appareil
            </Button>
          </div>
        )}

        {/* Pending QR */}
        {pending && qrImage && (
          <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6">
            <img src={qrImage} alt="QR code d'appairage" className="h-56 w-56 rounded-lg bg-white p-2" />
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Expire le {new Date(data!.pairing!.expires_at).toLocaleString("fr-FR")}
            </p>
            <p className="max-w-sm text-center text-xs text-muted-foreground">
              Scannez ce code depuis l'application mobile pour appairer l'appareil.
              Le QR devient invalide après expiration ou révocation.
            </p>
            <Button variant="destructive" size="sm" onClick={() => revokeMut.mutate()} disabled={busy}>
              <ShieldOff className="mr-2 h-4 w-4" /> Annuler le QR
            </Button>
          </div>
        )}

        {/* Generate controls */}
        {!connected && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Durée de validité</p>
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
              {pending ? "Régénérer le QR code" : "Générer le QR code"}
            </Button>
          </div>
        )}

        {connected && (
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => {
                revokeMut.mutateAsync().then(() => genMut.mutate());
              }}
              disabled={busy}
            >
              <QrCode className="mr-2 h-4 w-4" /> Appairer un nouvel appareil
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
