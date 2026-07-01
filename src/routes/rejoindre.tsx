import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, KeyRound, Loader2 } from "lucide-react";
import { activateTenantKey } from "@/lib/tenant.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/rejoindre")({
  head: () => ({
    meta: [
      { title: "Rejoindre votre espace — ORUS" },
      { name: "description", content: "Activez votre espace avec votre clé d'accès." },
    ],
  }),
  component: RejoindrePage,
});

function RejoindrePage() {
  const navigate = useNavigate();
  const activate = useServerFn(activateTenantKey);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await activate({ data: { key: key.trim() } });
      if (!res.ok) {
        setError(res.error ?? "Clé d'accès invalide.");
        return;
      }
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
            <Gem className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-xl font-semibold">Activez votre espace</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saisissez la clé d'accès qui vous a été remise pour créer votre espace
            sécurisé et isolé.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="key">Clé d'accès</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                placeholder="ORUS-KEY-XXXX-XXXX-XXXX-XXXX"
                className="pl-9 font-mono tracking-wide"
                autoComplete="off"
                autoFocus
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={busy || key.trim().length < 6}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Activer mon espace
          </Button>
        </form>
      </div>
    </div>
  );
}
