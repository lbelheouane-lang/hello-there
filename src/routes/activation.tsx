import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, KeyRound, Store, Loader2, ShieldCheck, AlertCircle } from "lucide-react";
import { activateLicense } from "@/lib/licenses.functions";
import { getLocalActivation, setLocalActivation } from "@/lib/license-activation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/activation")({
  head: () => ({
    meta: [
      { title: "Activation — Maison d'Or" },
      { name: "description", content: "Activez votre licence pour accéder à l'application de gestion de bijouterie." },
    ],
  }),
  component: ActivationPage,
});

function ActivationPage() {
  const navigate = useNavigate();
  const activate = useServerFn(activateLicense);

  const [storeName, setStoreName] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already activated on this device → skip straight to login.
  useEffect(() => {
    if (getLocalActivation()) navigate({ to: "/auth", replace: true });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await activate({ data: { store_name: storeName, license_key: licenseKey } });
      setLocalActivation({
        license_id: res.license_id,
        license_key: res.license_key,
        store_name: res.store_name,
        activated_at: new Date().toISOString(),
      });
      navigate({ to: "/auth", replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec de l'activation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-lg">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Gem className="h-7 w-7" />
          </div>
          <h1 className="font-serif text-2xl font-semibold">Activation de la licence</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entrez les informations de votre boutique pour activer l'application.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store">Nom de la boutique</Label>
            <div className="relative">
              <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="store"
                className="pl-9"
                placeholder="Ex. Maison d'Or"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="key">Clé de licence</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="key"
                className="pl-9 font-mono tracking-wide"
                placeholder="XXXX-XXXX-XXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Activer
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Licence introuvable ou inactive ? Contactez votre développeur.
        </p>
      </div>
    </div>
  );
}
