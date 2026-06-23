import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/owner")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.session.user.id);
      if ((roles ?? []).some((r) => String(r.role) === "super_admin")) {
        throw redirect({ to: "/super-admin" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "Espace propriétaire" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: OwnerLogin,
});

function OwnerLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signErr || !data.user) {
        setError("Identifiants incorrects.");
        setBusy(false);
        return;
      }
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isOwner = (roles ?? []).some((r) => String(r.role) === "super_admin");
      if (!isOwner) {
        await supabase.auth.signOut();
        setError("Ce compte n'a pas les droits propriétaire.");
        setBusy(false);
        return;
      }
      navigate({ to: "/super-admin", replace: true });
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur"
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-semibold">Espace propriétaire</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Accès réservé au propriétaire de l'application.
          </p>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="owner-email">Email</Label>
            <Input
              id="owner-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner-password">Mot de passe</Label>
            <Input
              id="owner-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </div>

        {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

        <Button type="submit" className="mt-6 w-full gap-2" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Se connecter
        </Button>
      </form>
    </div>
  );
}
