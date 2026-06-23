import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Crown, Delete, Loader2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pinLogin } from "@/lib/pin-auth.functions";
import { useStoreSettings } from "@/lib/store-settings";
import { defaultRouteForRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";

type SelectedRole = "admin" | "employe";

export const PIN_DONE_KEY = "md_pin_done";

export const Route = createFileRoute("/acces")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Accès — Maison d'Or" }],
  }),
  component: AccessPage,
});

const MAX_PIN = 8;

function AccessPage() {
  const navigate = useNavigate();
  const { data: storeSettings } = useStoreSettings();
  const storeName = storeSettings?.store_name || "Maison d'Or";

  const [role, setRole] = useState<SelectedRole>("admin");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);
  const [checking, setChecking] = useState(true);

  // Require a completed email/password sign-in before showing the PIN pad.
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error: err }) => {
      if (!active) return;
      if (err || !data.user) {
        navigate({ to: "/auth", replace: true });
        return;
      }
      if (sessionStorage.getItem(PIN_DONE_KEY) === "1") {
        navigate({ to: "/dashboard", replace: true });
        return;
      }
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  function append(digit: string) {
    if (busy) return;
    setError(null);
    setPin((p) => (p.length >= MAX_PIN ? p : p + digit));
  }

  function backspace() {
    if (busy) return;
    setError(null);
    setPin((p) => p.slice(0, -1));
  }

  async function submit(value: string) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await pinLogin({ data: { pin: value, expectedRole: role } });
      if (!res.ok) {
        setError(res.error);
        setPin("");
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setBusy(false);
        return;
      }
      // Adopt the matched operator's session, then mark the PIN gate cleared.
      const { error: sessErr } = await supabase.auth.setSession({
        access_token: res.access_token,
        refresh_token: res.refresh_token,
      });
      if (sessErr) {
        setError("Connexion impossible. Réessayez.");
        setPin("");
        setBusy(false);
        return;
      }
      sessionStorage.setItem(PIN_DONE_KEY, "1");
      navigate({ to: defaultRouteForRole(res.role), replace: true });
    } catch {
      setError("Une erreur est survenue. Réessayez.");
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setBusy(false);
    }
  }

  // Auto-submit once enough digits are entered is avoided (variable PIN length);
  // the user confirms with the Valider button or Enter key.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") append(e.key);
      else if (e.key === "Backspace") backspace();
      else if (e.key === "Enter" && pin.length >= 4) submit(pin);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin, busy]);

  async function signOut() {
    sessionStorage.removeItem(PIN_DONE_KEY);
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (checking) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary to-accent px-4 py-10">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
          style={{ animation: "auth-glow 6s ease-in-out infinite" }}
        />
      </div>

      <div
        className={`relative w-full max-w-xs rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur ${
          shake ? "animate-auth-shake" : ""
        }`}
        style={{ animation: "auth-card-in 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="mt-4 font-serif text-2xl font-semibold tracking-tight">{storeName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choisissez un rôle, puis entrez le code PIN
          </p>
        </div>

        {/* Role selector */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {([
            { value: "admin" as const, label: "Administrateur", icon: Crown },
            { value: "employe" as const, label: "Employé", icon: UserRound },
          ]).map((opt) => {
            const active = role === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={busy}
                onClick={() => {
                  setRole(opt.value);
                  setError(null);
                  setPin("");
                }}
                className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-sm font-medium transition-colors disabled:opacity-50 ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* PIN dots */}
        <div className="mt-6 flex items-center justify-center gap-2">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${
                i < pin.length ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {error && <p className="mt-3 text-center text-sm text-destructive">{error}</p>}

        {/* Keypad */}
        <div className="mt-6 grid grid-cols-3 gap-3">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <Button
              key={d}
              type="button"
              variant="secondary"
              className="h-14 text-xl font-medium"
              onClick={() => append(d)}
              disabled={busy}
            >
              {d}
            </Button>
          ))}
          <Button
            type="button"
            variant="ghost"
            className="h-14"
            onClick={backspace}
            disabled={busy || pin.length === 0}
            aria-label="Effacer"
          >
            <Delete className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-14 text-xl font-medium"
            onClick={() => append("0")}
            disabled={busy}
          >
            0
          </Button>
          <Button
            type="button"
            className="h-14"
            onClick={() => submit(pin)}
            disabled={busy || pin.length < 4}
            aria-label="Valider"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "OK"}
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          className="mt-6 w-full justify-center gap-2 text-muted-foreground"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" /> Changer de compte
        </Button>
      </div>
    </div>
  );
}
