import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalActivation } from "@/lib/license-activation";
import { recordLicenseActivity } from "@/lib/licenses.functions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "authed">("loading");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        navigate({ to: "/auth" });
        return;
      }

      const activation = getLocalActivation();
      if (activation) {
        // Track activity on login; if the license is no longer valid, block.
        try {
          const res = await recordLicenseActivity({
            data: { license_key: activation.license_key, store_name: activation.store_name },
          });
          if (!res.valid) {
            navigate({ to: "/activation" });
            return;
          }
        } catch {
          // Network hiccup shouldn't lock out an already-activated store.
        }
        if (active) setStatus("authed");
        return;
      }

      // Not activated on this device: developers may still manage licenses.
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const isDeveloper = (roleRows ?? []).some((r) => (r.role as string) === "developer");
      if (isDeveloper) {
        if (active) setStatus("authed");
      } else {
        navigate({ to: "/activation" });
      }
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  if (status === "loading") {
    return <div className="min-h-screen bg-background" />;
  }

  return <Outlet />;
}
