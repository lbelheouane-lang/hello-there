import { useEffect, useRef, useState } from "react";
import { Camera, ImageUp, Trash2, AlertTriangle, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getCameraSupport, queryCameraPermission, cameraErrorMessage,
} from "@/lib/camera";

interface PhotoCaptureFieldProps {
  /** Existing photo preview URL (signed URL or object URL), or null. */
  previewUrl: string | null;
  /** Called with a freshly captured / picked image file. */
  onCapture: (file: File) => void;
  /** Called when the user removes the photo. */
  onClear: () => void;
  label?: string;
}

/**
 * Inventory photo capture: live camera (desktop webcam + phone), retake,
 * gallery upload fallback and clear. Uses the shared camera helpers so
 * permission / secure-context errors are explained clearly in French.
 */
export function PhotoCaptureField({
  previewUrl, onCapture, onClear, label = "Photo de l'article",
}: PhotoCaptureFieldProps) {
  const [camOpen, setCamOpen] = useState(false);
  const galleryRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="h-full w-full object-cover" />
          ) : (
            <Camera className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setCamOpen(true)}>
            <Camera className="mr-1.5 h-4 w-4" />
            {previewUrl ? "Reprendre" : "Prendre une photo"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => galleryRef.current?.click()}>
            <ImageUp className="mr-1.5 h-4 w-4" /> Galerie
          </Button>
          {previewUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={onClear}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Retirer
            </Button>
          )}
        </div>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onCapture(f);
          e.target.value = "";
        }}
      />

      <CameraDialog
        open={camOpen}
        onOpenChange={setCamOpen}
        onCapture={(f) => { onCapture(f); setCamOpen(false); }}
      />
    </div>
  );
}

function CameraDialog({
  open, onOpenChange, onCapture,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError(null);
    setReady(false);

    const start = async () => {
      const support = getCameraSupport();
      if (!support.secure || !support.hasApi) {
        if (!cancelled) setError(cameraErrorMessage(null));
        return;
      }
      const perm = await queryCameraPermission();
      if (perm === "denied") {
        if (!cancelled) setError(cameraErrorMessage({ name: "NotAllowedError" }));
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setReady(true);
      } catch (e) {
        if (!cancelled) setError(cameraErrorMessage(e));
      }
    };

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" }));
    }, "image/jpeg", 0.85);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Prendre une photo
          </DialogTitle>
          <DialogDescription>
            Cadrez le bijou puis appuyez sur « Capturer ».
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} playsInline muted className="w-full" />
          </div>
        )}

        <input
          ref={fallbackRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCapture(f);
            e.target.value = "";
          }}
        />

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {!error && (
            <Button type="button" onClick={capture} disabled={!ready} className="w-full sm:w-auto">
              <Camera className="mr-2 h-4 w-4" /> Capturer
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => fallbackRef.current?.click()}
          >
            <ImageUp className="mr-2 h-4 w-4" /> Importer depuis la galerie
          </Button>
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={() => onOpenChange(false)}>
            <X className="mr-2 h-4 w-4" /> Annuler
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RefreshIconUnused() { return <RefreshCw />; }
