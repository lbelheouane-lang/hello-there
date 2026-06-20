import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Gem, Shield, ShoppingCart, Delete, Loader2, ArrowLeft, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { pinLogin } from "@/lib/pin-auth.functions";
import { useStoreSettings } from "@/lib/store-settings";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Connexion — Maison d'Or" },
      { name: "description", content: "Accédez à votre espace de gestion de bijouterie par code PIN." },
    ],
  }),
  component: AuthPage,
});

type Phase = "intro" | "profiles" | "pin" | "success";
type Profile = "admin" | "employe";

const PROFILES: { key: Profile; label: string; desc: string; icon: typeof Shield }[] = [
  { key: "admin", label: "Administrateur", desc: "Accès complet à la boutique", icon: Shield },
  { key: "employe", label: "Employé", desc: "Ventes et clients", icon: ShoppingCart },
];

function AuthPage() {
  const navigate = useNavigate();
  const login = useServerFn(pinLogin);

  const [phase, setPhase] = useState<Phase>("intro");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const submittingRef = useRef(false);

  // Startup animation — data/session checks happen behind it.
  useEffect(() => {
    const t = setTimeout(() => setPhase("profiles"), 2600);
    return () => clearTimeout(t);
  }, []);

  const selectProfile = (p: Profile) => {
    setProfile(p);
    setPin("");
    setError(false);
    setPhase("pin");
  };

  const submitPin = useCallback(
    async (value: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setBusy(true);
      setError(false);
      try {
        const res = await login({ data: { pin: value } });
        if (!res.ok) {
          setError(true);
          setPin("");
          setBusy(false);
          submittingRef.current = false;
          return;
        }
        // Profile mismatch (e.g. employee PIN under admin card) — guide the user.
        if (profile && res.role !== profile) {
          setError(true);
          setPin("");
          setBusy(false);
          submittingRef.current = false;
          return;
        }
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        });
        if (sessErr) {
          setError(true);
          setPin("");
          setBusy(false);
          submittingRef.current = false;
          return;
        }
        setPhase("success");
        setTimeout(() => {
          navigate({ to: res.role === "admin" ? "/dashboard" : "/nouvelle-vente" });
        }, 1300);
      } catch {
        setError(true);
        setPin("");
        setBusy(false);
        submittingRef.current = false;
      }
    },
    [login, navigate, profile],
  );

  const pushDigit = (d: string) => {
    if (busy || pin.length >= 8) return;
    setError(false);
    setPin((p) => p + d);
  };

  const popDigit = () => {
    if (busy) return;
    setError(false);
    setPin((p) => p.slice(0, -1));
  };

  const validate = () => {
    if (busy || pin.length < 4) return;
    submitPin(pin);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-background via-secondary to-accent px-4 py-10">
      <AmbientGlow />

      {phase === "intro" && <Intro />}

      {phase === "profiles" && (
        <ProfileSelect onSelect={selectProfile} />
      )}

      {phase === "pin" && profile && (
        <PinEntry
          profile={PROFILES.find((p) => p.key === profile)!}
          pin={pin}
          error={error}
          busy={busy}
          onDigit={pushDigit}
          onBackspace={popDigit}
          onBack={() => setPhase("profiles")}
        />
      )}

      {phase === "success" && <SuccessTransition />}
    </div>
  );
}

function AmbientGlow() {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <div
        className="absolute left-1/2 top-1/3 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl"
        style={{ animation: "auth-glow 6s ease-in-out infinite" }}
      />
    </div>
  );
}

function Brand({ subtitle }: { subtitle?: string }) {
  const { data: settings } = useStoreSettings();
  const storeName = settings?.store_name || "Maison d'Or";
  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative">
        <span
          className="absolute inset-0 -z-10 rounded-3xl bg-primary/30 blur-xl"
          style={{ animation: "auth-glow 4s ease-in-out infinite" }}
          aria-hidden
        />
        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl bg-primary text-primary-foreground shadow-lg">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt={storeName} className="h-full w-full object-contain" />
          ) : (
            <Gem className="h-8 w-8" />
          )}
        </div>
      </div>
      <h1 className="mt-5 font-serif text-3xl font-semibold tracking-tight">{storeName}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Intro() {
  const { data: settings } = useStoreSettings();
  const storeName = settings?.store_name || "Maison d'Or";
  const storeTag = settings?.slogan || settings?.tagline || "Gestion de bijouterie d'exception";
  return (
    <div className="brand-intro relative flex flex-col items-center text-center">
      {/* expanding rings */}
      {[0, 0.4, 0.8].map((delay, i) => (
        <span
          key={i}
          className="absolute top-8 h-16 w-16 rounded-full border border-primary/40"
          style={{ animation: `brand-ring 2.4s ease-out ${delay}s infinite` }}
          aria-hidden
        />
      ))}
      {/* floating particles */}
      {Array.from({ length: 8 }).map((_, i) => (
        <span
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-primary/70"
          style={{
            left: `${12 + i * 10}%`,
            bottom: "20%",
            animation: `brand-float ${2.6 + (i % 4) * 0.4}s ease-in ${i * 0.25}s infinite`,
          }}
          aria-hidden
        />
      ))}
      <div
        className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-2xl"
        style={{ animation: "brand-logo-reveal 1.1s cubic-bezier(0.22,1,0.36,1) both" }}
      >
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt={storeName} className="h-14 w-14 object-contain" />
        ) : (
          <Gem className="h-10 w-10" />
        )}
      </div>
      <h1
        className="mt-6 bg-gradient-to-r from-foreground via-primary to-foreground bg-[length:200%_100%] bg-clip-text font-serif text-4xl font-semibold text-transparent"
        style={{ animation: "brand-text-rise 1s ease-out 0.3s both, brand-shimmer 2.5s linear 0.3s infinite" }}
      >
        {storeName}
      </h1>
      <p
        className="mt-2 text-sm tracking-wide text-muted-foreground"
        style={{ animation: "auth-rise 0.8s ease-out 0.7s both" }}
      >
        {storeTag}
      </p>
    </div>
  );
}

function ProfileSelect({ onSelect }: { onSelect: (p: Profile) => void }) {
  return (
    <div className="relative w-full max-w-2xl">
      <div style={{ animation: "auth-rise 0.5s ease-out both" }}>
        <Brand subtitle="Choisissez votre profil" />
      </div>
      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PROFILES.map((p, i) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelect(p.key)}
            className="group relative overflow-hidden rounded-2xl border border-border bg-card/80 p-8 text-left shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:border-primary/60 hover:shadow-xl"
            style={{ animation: `auth-card-in 0.6s cubic-bezier(0.22,1,0.36,1) ${0.15 + i * 0.12}s both` }}
          >
            <span className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r from-primary to-primary/40 transition-transform duration-300 group-hover:scale-x-100" />
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
              <p.icon className="h-7 w-7" />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-semibold">{p.label}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

function PinEntry({
  profile,
  pin,
  error,
  busy,
  onDigit,
  onBackspace,
  onBack,
}: {
  profile: { key: Profile; label: string; icon: typeof Shield };
  pin: string;
  error: boolean;
  busy: boolean;
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onBack: () => void;
}) {
  // Hardware keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") onDigit(e.key);
      else if (e.key === "Backspace") onBackspace();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onDigit, onBackspace]);

  return (
    <div
      className="relative w-full max-w-sm rounded-3xl border border-border bg-card/85 p-8 shadow-xl backdrop-blur"
      style={{ animation: "auth-card-in 0.45s cubic-bezier(0.22,1,0.36,1) both" }}
    >
      <button
        type="button"
        onClick={onBack}
        className="absolute left-5 top-5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour
      </button>

      <div className="flex flex-col items-center text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <profile.icon className="h-7 w-7" />
        </div>
        <h2 className="mt-4 font-serif text-xl font-semibold">{profile.label}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Saisissez votre code PIN</p>
      </div>

      <div className={`mt-7 flex justify-center gap-3 ${error ? "animate-auth-shake" : ""}`}>
        {Array.from({ length: 4 }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <span
              key={i}
              className={`h-4 w-4 rounded-full border transition-colors ${
                error
                  ? "border-destructive bg-destructive"
                  : filled
                    ? "border-primary bg-primary"
                    : "border-muted-foreground/40"
              } ${filled ? "animate-auth-pin" : ""}`}
            />
          );
        })}
      </div>

      {error && (
        <p className="mt-3 text-center text-xs text-destructive">Code incorrect. Réessayez.</p>
      )}

      <div className="mt-7 grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <PinKey key={d} disabled={busy} onClick={() => onDigit(d)}>
            {d}
          </PinKey>
        ))}
        <div />
        <PinKey disabled={busy} onClick={() => onDigit("0")}>
          0
        </PinKey>
        <PinKey disabled={busy} onClick={onBackspace} aria-label="Effacer">
          <Delete className="h-5 w-5" />
        </PinKey>
      </div>

      {busy && (
        <div className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Vérification…
        </div>
      )}
    </div>
  );
}

function PinKey({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-16 items-center justify-center rounded-2xl border border-border bg-background/60 font-serif text-xl font-medium transition-all hover:border-primary/60 hover:bg-primary/5 active:scale-95 disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}

function SuccessTransition() {
  return (
    <div className="flex flex-col items-center text-center" style={{ animation: "auth-rise 0.4s ease-out both" }}>
      <div className="relative">
        <span
          className="absolute inset-0 -z-10 rounded-full bg-primary/30 blur-xl"
          style={{ animation: "auth-glow 2s ease-in-out infinite" }}
          aria-hidden
        />
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl">
          <Check className="h-10 w-10" style={{ animation: "auth-pin-pop 0.4s cubic-bezier(0.22,1,0.36,1)" }} />
        </div>
      </div>
      <h2 className="mt-6 font-serif text-2xl font-semibold">Bienvenue</h2>
      <p className="mt-1 text-sm text-muted-foreground">Ouverture de votre espace…</p>
      <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ animation: "auth-progress 1.2s ease-out both" }} />
      </div>
    </div>
  );
}
