import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";

interface QrScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the decoded text. The dialog closes automatically after a scan. */
  onScan: (text: string) => void;
}

/**
 * Camera-based QR / barcode scanner using html5-qrcode. Works with a phone or
 * laptop camera. The scanner only mounts while the dialog is open and is fully
 * torn down on close so the camera light turns off.
 */
export function QrScanDialog({ open, onOpenChange, onScan }: QrScanDialogProps) {
  const containerId = "qr-scan-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);

    const start = async () => {
      try {
        const scanner = new Html5Qrcode(containerId, { verbose: false });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 240 } },
          (decodedText) => {
            if (cancelled) return;
            onScan(decodedText);
            onOpenChange(false);
          },
          () => {
            /* ignore per-frame decode errors */
          },
        );
      } catch (e) {
        if (!cancelled) {
          setError(
            "Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur.",
          );
        }
      }
    };

    start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, onScan, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Scanner un code
          </DialogTitle>
          <DialogDescription>
            Présentez le QR code ou le code-barres du bijou devant la caméra.
          </DialogDescription>
        </DialogHeader>
        {error ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted-foreground">
            <X className="h-8 w-8 text-destructive" />
            {error}
          </div>
        ) : (
          <div id={containerId} className="overflow-hidden rounded-xl border" />
        )}
      </DialogContent>
    </Dialog>
  );
}
