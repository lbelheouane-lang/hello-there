import { useEffect, useState } from "react";
import { Gem } from "lucide-react";
import { useStoreSettings } from "@/lib/store-settings";

const SESSION_KEY = "maisondor:intro-shown";

/**
 * Non-blocking premium opening animation.
 * Renders a full-bleed overlay that reveals the brand, then fades away
 * to expose the dashboard which has been loading underneath. Shows once
 * per browser session and respects reduced-motion preferences.
 */
export function BrandIntro() {
  const [show, setShow] = useState(false);
  const { data: settings } = useStoreSettings();
  const storeName = settings?.store_name || "Maison d'Or";
  const storeTag = settings?.slogan || settings?.tagline || "Gestion de bijouterie";


  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, "1");
    setShow(true);
    const t = setTimeout(() => setShow(false), 2900);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      className="brand-intro pointer-events-none fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 30%, color-mix(in oklab, var(--primary) 14%, var(--background)) 0%, var(--background) 60%)",
        animation: "brand-intro-out 2.9s ease-in-out forwards",
      }}
      aria-hidden="true"
    >
      {/* Soft floating particles */}
      {Array.from({ length: 10 }).map((_, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${8 + i * 9}%`,
            bottom: "30%",
            width: `${6 + (i % 3) * 4}px`,
            height: `${6 + (i % 3) * 4}px`,
            background: "color-mix(in oklab, var(--primary) 55%, transparent)",
            filter: "blur(1px)",
            animation: `brand-float ${2.4 + (i % 4) * 0.4}s ease-out ${i * 0.12}s forwards`,
          }}
        />
      ))}

      <div className="relative flex flex-col items-center gap-5 px-6 text-center">
        <div className="relative">
          {/* Expanding rings */}
          <span
            className="absolute inset-0 rounded-3xl border"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 50%, transparent)",
              animation: "brand-ring 2.4s ease-out 0.2s forwards",
            }}
          />
          <span
            className="absolute inset-0 rounded-3xl border"
            style={{
              borderColor: "color-mix(in oklab, var(--primary) 35%, transparent)",
              animation: "brand-ring 2.4s ease-out 0.6s forwards",
            }}
          />
          <div
            className="relative flex h-20 w-20 items-center justify-center rounded-3xl text-primary-foreground shadow-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--primary), color-mix(in oklab, var(--primary) 60%, white))",
              animation: "brand-logo-reveal 1s cubic-bezier(0.22,1,0.36,1) forwards",
            }}
          >
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={storeName} className="h-14 w-14 object-contain" />
            ) : (
              <Gem className="h-10 w-10" />
            )}
          </div>
        </div>

        <h1
          className="font-serif text-4xl font-semibold"
          style={{
            opacity: 0,
            animation: "brand-text-rise 0.9s ease-out 0.4s forwards",
            backgroundImage:
              "linear-gradient(90deg, var(--foreground) 0%, var(--primary) 45%, var(--foreground) 90%)",
            backgroundSize: "200% 100%",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          <span
            style={{
              display: "inline-block",
              animation: "brand-shimmer 2s linear 0.6s 1 forwards",
            }}
          >
            Maison d'Or
          </span>
        </h1>
        <p
          className="text-sm tracking-widest text-muted-foreground uppercase"
          style={{ opacity: 0, animation: "brand-text-rise 0.9s ease-out 0.7s forwards" }}
        >
          Gestion de bijouterie
        </p>
      </div>
    </div>
  );
}
