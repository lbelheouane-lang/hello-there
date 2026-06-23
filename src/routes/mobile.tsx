import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gem, Share, Plus, ArrowRight, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStoreSettings } from "@/lib/store-settings";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/mobile")({
  validateSearch: (search: Record<string, unknown>) => ({
    store: typeof search.store === "string" ? search.store : "",
    name: typeof search.name === "string" ? search.name : "",
  }),
  head: () => ({
    meta: [
      { title: "Application mobile — Maison d'Or" },
      {
        name: "description",
        content: "Accédez à votre boutique depuis votre téléphone et ajoutez l'application à l'écran d'accueil.",
      },
      { name: "theme-color", content: "#1a1a1a" },
    ],
  }),
  component: MobileEntry,
});

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function MobileEntry() {
  const navigate = useNavigate();
  const { name: storeFromUrl } = Route.useSearch();
  const { data: settings } = useStoreSettings();
  const storeName = settings?.store_name || storeFromUrl || "Maison d'Or";

  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [checking, setChecking] = useState(true);

  // If already logged in, send the user straight into the app.
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      if (data.session) {
        navigate({ to: "/dashboard" });
      } else {
        setChecking(false);
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const isIos =
    typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);

  const handleInstall = async () => {
    if (!installEvt) return;
    await installEvt.prompt();
    const choice = await installEvt.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setInstallEvt(null);
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary to-accent px-5 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-1/3 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={storeName} className="h-full w-full object-contain" />
            ) : (
              <Gem className="h-8 w-8" />
            )}
          </div>
          <h1 className="mt-5 font-serif text-2xl font-semibold tracking-tight">{storeName}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <Smartphone className="h-4 w-4" /> Application mobile
          </p>
        </div>

        <Button
          className="mt-8 w-full"
          size="lg"
          disabled={checking}
          onClick={() => navigate({ to: "/auth" })}
        >
          Se connecter <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {!installed && (
          <div className="mt-6 rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-sm font-medium">Ajouter à l'écran d'accueil</p>
            {installEvt ? (
              <Button variant="outline" className="mt-3 w-full" onClick={handleInstall}>
                <Plus className="mr-2 h-4 w-4" /> Installer l'application
              </Button>
            ) : isIos ? (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                Appuyez sur <Share className="inline h-3.5 w-3.5" /> puis « Sur l'écran d'accueil »
                pour une expérience plein écran.
              </p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">
                Ouvrez le menu de votre navigateur puis « Ajouter à l'écran d'accueil »
                pour une expérience plein écran.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
