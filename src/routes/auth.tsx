import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Gem, Loader2, Mail, Lock, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActivationStatus } from "@/lib/activation.functions";
import { useStoreSettings } from "@/lib/store-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/acces" });
    // App stays locked until activated with a valid access key.
    const status = await getActivationStatus();
    if (!status.activated) throw redirect({ to: "/activation" });
  },
  head: () => ({
    meta: [
      { title: "Connexion — Maison d'Or" },
      {
        name: "description",
        content: "Accédez à votre espace de gestion de bijouterie.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: storeSettings } = useStoreSettings();
  const storeName = storeSettings?.store_name || "Maison d'Or";

  const bgStyle = storeSettings?.login_background_url
    ? {
        backgroundImage: `url(${storeSettings.login_background_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const { error: signErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signErr) {
      setError("E-mail ou mot de passe incorrect.");
      setBusy(false);
      return;
    }
    navigate({ to: "/dashboard" });
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary to-accent px-4 py-10"
      style={bgStyle}
    >
      {storeSettings?.login_background_url && (
        <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" aria-hidden />
      )}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
          style={{ animation: "auth-glow 6s ease-in-out infinite" }}
        />
      </div>

      <div
        className="relative w-full max-w-sm rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur"
        style={{ animation: "auth-card-in 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <span
              className="absolute inset-0 -z-10 rounded-3xl bg-primary/30 blur-xl"
              style={{ animation: "auth-glow 4s ease-in-out infinite" }}
              aria-hidden
            />
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg">
              {storeSettings?.login_logo_url || storeSettings?.logo_url ? (
                <img
                  src={storeSettings.login_logo_url || storeSettings.logo_url || ""}
                  alt={storeName}
                  className="h-full w-full object-contain"
                />
              ) : (
                <Gem className="h-8 w-8" />
              )}
            </div>
          </div>
          <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">{storeName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Connectez-vous à votre espace</p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                placeholder="vous@exemple.com"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                placeholder="••••••••"
              />
            </div>
          </div>

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Connexion…
              </>
            ) : (
              <>
                Se connecter <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            to="/create-account"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
