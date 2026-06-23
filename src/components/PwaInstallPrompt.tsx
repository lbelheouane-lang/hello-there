import { useEffect, useState } from "react";
import { Download, Share, X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "orus-pwa-install-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

export function PwaInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);

    // iOS has no beforeinstallprompt — show manual instructions.
    if (isIos() && !isStandalone()) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    setVisible(false);
    setShowIosHelp(false);
    sessionStorage.setItem(DISMISS_KEY, "1");
  };

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") setVisible(false);
      setDeferred(null);
      return;
    }
    if (isIos()) {
      setShowIosHelp((v) => !v);
    }
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] flex justify-center p-3 sm:bottom-4 sm:p-0">
      <div className="w-full max-w-md rounded-xl border border-border bg-card text-card-foreground shadow-lg">
        <div className="flex items-center gap-3 p-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-sidebar">
            <img src="/icons/app-icon-192.png" alt="Orus" className="h-full w-full object-cover" width={40} height={40} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Installer Orus</p>
            <p className="truncate text-xs text-muted-foreground">
              Accès rapide en plein écran, comme une application.
            </p>
          </div>
          <Button size="sm" onClick={install} className="shrink-0 gap-1">
            <Download className="h-4 w-4" />
            Installer
          </Button>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Fermer"
            className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {showIosHelp && (
          <div className="border-t border-border px-3 py-2.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              1. Appuyez sur <Share className="h-3.5 w-3.5" /> Partager dans Safari.
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              2. Choisissez <Plus className="h-3.5 w-3.5" /> « Sur l'écran d'accueil ».
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
