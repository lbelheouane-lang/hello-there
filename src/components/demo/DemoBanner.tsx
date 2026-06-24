import { Eye } from "lucide-react";

/** Permanent banner shown on every showroom page. */
export function DemoBanner() {
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 bg-primary px-4 py-1.5 text-center text-xs font-medium text-primary-foreground sm:text-sm"
      style={{ paddingTop: "calc(0.375rem + env(safe-area-inset-top))" }}
    >
      <span className="inline-flex items-center gap-1.5 font-semibold">
        <Eye className="h-3.5 w-3.5" />
        ORUS DZ — VERSION DE DÉMONSTRATION
      </span>
      <span className="opacity-90">Mode lecture seule · Données fictives.</span>
    </div>
  );
}
