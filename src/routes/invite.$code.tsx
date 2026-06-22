import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, Loader2, Check, ShieldCheck, AlertTriangle } from "lucide-react";
import { getInvitation, redeemInvitation, type InvitationInfo } from "@/lib/invite.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/invite/$code")({
  head: () => ({
    meta: [
      { title: "Activation de compte — Maison d'Or" },
      { name: "description", content: "Créez votre compte via votre invitation privée." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: InvitePage,
});

function InvitePage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const inspect = useServerFn(getInvitation);
  const redeem = useServerFn(redeemInvitation);

  const [info, setInfo] = useState<InvitationInfo | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    inspect({ data: { code } })
      .then(setInfo)
      .catch(() => setInfo({ valid: false, reason: "Invitation introuvable." }));
  }, [code, inspect]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!/^\d{4,8}$/.test(pin)) {
      setError("Le PIN doit comporter 4 à 8 chiffres.");
      return;
    }
    if (pin !== pin2) {
      setError("Les deux PIN ne correspondent pas.");
      return;
    }
    setBusy(true);
    try {
      const res = await redeem({ data: { code, firstName, lastName, pin } });
      if (!res.ok) {
        setError(res.error);
        setBusy(false);
        return;
      }
      setDone(true);
      setTimeout(() => navigate({ to: "/auth" }), 2200);
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-secondary to-accent px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-lg">
            <Gem className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-serif text-2xl font-semibold">Maison d'Or</h1>
          <p className="mt-1 text-sm text-muted-foreground">Activation de votre compte</p>
        </div>

        {!info && (
          <div className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Vérification de l'invitation…
          </div>
        )}

        {info && !info.valid && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm text-destructive">{info.reason}</p>
            <p className="text-xs text-muted-foreground">
              Contactez votre administrateur pour obtenir une nouvelle invitation.
            </p>
          </div>
        )}

        {info && info.valid && done && (
          <div className="mt-8 flex flex-col items-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-7 w-7" />
            </div>
            <p className="font-serif text-lg">Compte créé !</p>
            <p className="text-sm text-muted-foreground">
              Vous pouvez maintenant vous connecter avec votre PIN.
            </p>
          </div>
        )}

        {info && info.valid && !done && (
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center text-sm">
              <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-primary" />
              Invitation valide pour <strong>{info.companyName || "votre société"}</strong>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="fn">Prénom</Label>
                <Input id="fn" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ln">Nom</Label>
                <Input id="ln" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">Choisissez un code PIN (4 à 8 chiffres)</Label>
              <Input
                id="pin"
                inputMode="numeric"
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 8))}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin2">Confirmez le code PIN</Label>
              <Input
                id="pin2"
                inputMode="numeric"
                type="password"
                value={pin2}
                onChange={(e) => setPin2(e.target.value.replace(/\D/g, "").slice(0, 8))}
                required
              />
            </div>
            {error && <p className="text-center text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer mon compte"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
