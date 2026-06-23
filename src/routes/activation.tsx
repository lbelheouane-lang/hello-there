import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, KeyRound, Store, Loader2, ShieldCheck } from "lucide-react";
import { getActivationStatus, activateApp } from "@/lib/activation.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/activation")({
  beforeLoad: async () => {
    const status = await getActivationStatus();
    if (status.activated) throw redirect({ to: "/auth" });
  },
  head: () => ({
    meta: [
      { title: "Activation — première utilisation" },
      { name: "description", content: "Activez votre application avec votre clé d'accès." },
    ],
  }),
  component: ActivationPage,
});

function ActivationPage() {
  const navigate = useNavigate();
  const activate = useServerFn(activateApp);
  const [storeName, setStoreName] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await activate({ data: { key: key.trim(), storeName: storeName.trim() } });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      navigate({ to: "/auth", replace: true });
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent px-4 py-10">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <Gem className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-serif text-2xl font-semibold">Bienvenue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Activez votre application pour la première utilisation.
          </p>
        </div>

        <div className="mt-7 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="store-name">Nom de votre bijouterie</Label>
            <div className="relative">
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="store-name"
                className="pl-9"
                placeholder="Ex : Bijouterie El Djawhara"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                maxLength={120}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="access-key">Clé d'accès</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="access-key"
                className="pl-9 font-mono tracking-wide"
                placeholder="MK-XXXX-XXXX-XXXX"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">
              La clé d'accès vous a été remise lors de votre achat.
            </p>
          </div>
        </div>

        {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

        <Button type="submit" className="mt-6 w-full gap-2" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Activer l'application
        </Button>
      </form>
    </div>
  );
}
