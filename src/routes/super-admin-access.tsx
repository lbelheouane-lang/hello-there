import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { superAdminPasskeyLogin } from "@/lib/super-admin-passkey.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/super-admin-access")({
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
      { title: "Accès" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: SuperAdminAccess,
});

function SuperAdminAccess() {
  const navigate = useNavigate();
  const login = useServerFn(superAdminPasskeyLogin);
  const [passkey, setPasskey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await login({ data: { passkey: passkey.trim() } });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (sessErr) {
        setError("Connexion impossible. Réessayez.");
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
          <h1 className="mt-4 font-serif text-2xl font-semibold">Accès Super Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Saisissez votre passkey Super Admin pour continuer.
          </p>
        </div>

        <div className="mt-6 space-y-2">
          <Label htmlFor="sa-passkey">Passkey Super Admin</Label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="sa-passkey"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="ORUS-XXXX-XXXX-XXXX-XXXX"
              className="pl-9 font-mono tracking-wide"
              value={passkey}
              onChange={(e) => setPasskey(e.target.value)}
              required
            />
          </div>
        </div>

        {error && <p className="mt-4 text-center text-sm text-destructive">{error}</p>}

        <Button type="submit" className="mt-6 w-full gap-2" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Accéder
        </Button>
      </form>
    </div>
  );
}
