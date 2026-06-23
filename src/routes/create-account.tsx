import { createFileRoute, useNavigate, redirect, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, Loader2, Mail, Lock, User, KeyRound, ArrowLeft, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getActivationStatus } from "@/lib/activation.functions";
import { signUpWithPasskey } from "@/lib/passkey-auth.functions";
import { useStoreSettings } from "@/lib/store-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/create-account")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
    const status = await getActivationStatus();
    if (!status.activated) throw redirect({ to: "/activation" });
  },
  head: () => ({
    meta: [
      { title: "Créer un compte — Maison d'Or" },
      {
        name: "description",
        content: "Créez votre compte avec une passkey d'invitation.",
      },
    ],
  }),
  component: CreateAccountPage,
});

function CreateAccountPage() {
  const navigate = useNavigate();
  const signUp = useServerFn(signUpWithPasskey);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passkey, setPasskey] = useState("");
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
    setError(null);

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setBusy(true);
    try {
      const res = await signUp({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          password,
          passkey: passkey.trim(),
        },
      });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      // Auto sign-in after a successful creation.
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signErr) {
        navigate({ to: "/auth" });
        return;
      }
      navigate({ to: "/dashboard" });
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      setBusy(false);
    }
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
        className="relative w-full max-w-md rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur"
        style={{ animation: "auth-card-in 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <Link
          to="/auth"
          className="absolute left-5 top-5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Connexion
        </Link>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Gem className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-semibold">Créer un compte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une passkey valide est requise pour {storeName}.
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nom complet</Label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="fullName"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="pl-9"
                placeholder="Votre nom"
              />
            </div>
          </div>

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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirmer</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="passkey">Passkey d'invitation</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="passkey"
                required
                value={passkey}
                onChange={(e) => setPasskey(e.target.value.toUpperCase())}
                className="pl-9 font-mono tracking-wider"
                placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
              />
            </div>
          </div>

          {error && <p className="text-center text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full gap-2" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Création…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" /> Créer mon compte
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
