import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X, ImageUp, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getCameraSupport, queryCameraPermission, cameraErrorMessage,
} from "@/lib/camera";

interface QrScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the decoded text. The dialog closes automatically after a scan. */
  onScan: (text: string) => void;
}

/**
 * Camera-based QR / barcode scanner using html5-qrcode. Works with a phone or
 * laptop camera. Handles secure-context and permission checks, shows clear
 * error messages, and always offers a gallery-image fallback so users can
 * scan a code even when the live camera is unavailable.
 */
export function QrScanDialog({ open, onOpenChange, onScan }: QrScanDialogProps) {
  const containerId = "qr-scan-region";
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setStarting(true);

    const start = async () => {
      const support = getCameraSupport();
      if (!support.secure || !support.hasApi) {
        if (!cancelled) {
          setError(cameraErrorMessage(null));
          setStarting(false);
        }
        return;
      }

      const perm = await queryCameraPermission();
      if (perm === "denied") {
        if (!cancelled) {
          setError(cameraErrorMessage({ name: "NotAllowedError" }));
          setStarting(false);
        }
        return;
      }

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
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (!cancelled) {
          setError(cameraErrorMessage(e));
          setStarting(false);
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().then(() => s.clear()).catch(() => {});
      }
    };
  }, [open, onScan, onOpenChange]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    // Stop the live camera first if it is running.
    const live = scannerRef.current;
    scannerRef.current = null;
    if (live) {
      try { await live.stop(); await live.clear(); } catch { /* noop */ }
    }
    try {
      const scanner = new Html5Qrcode(containerId, { verbose: false });
      const decoded = await scanner.scanFile(file, true);
      await scanner.clear();
      onScan(decoded);
      onOpenChange(false);
    } catch {
      setError("Aucun code lisible dans cette image. Réessayez avec une photo nette du code.");
    }
  };

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

        {error && (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p>{error}</p>
          </div>
        )}
        {/* Container stays mounted (hidden on error) so the gallery
            fallback can always construct a scanner for scanFile(). */}
        <div className={error ? "hidden" : ""}>
          <div id={containerId} className="overflow-hidden rounded-xl border" />
          {!error && starting && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Démarrage de la caméra…
            </p>
          )}
        </div>

        {/* Gallery fallback — always available */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ""; }}
        />
        <Button
          variant="outline"
          className="w-full"
          onClick={() => fileInputRef.current?.click()}
        >
          <ImageUp className="mr-2 h-4 w-4" /> Importer une image depuis la galerie
        </Button>
      </DialogContent>
    </Dialog>
  );
}
