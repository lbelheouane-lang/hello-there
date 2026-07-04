import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setDemoActive } from "@/integrations/supabase/data-client";


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "authed">("loading");

  useEffect(() => {
    // Authenticated app must never run against the read-only demo client.
    setDemoActive(false);
    let active = true;

    supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        navigate({ to: "/auth" });
        return;
      }

      // Multi-tenant guard: a user not yet attached to a boutique must
      // activate an access key before seeing any data. Super admins and
      // developers operate across tenants and are exempt.
      const [{ data: prof }, { data: roleRows }] = await Promise.all([
        supabase.from("profiles").select("tenant_id").eq("id", data.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      ]);
      if (!active) return;
      const roles = (roleRows ?? []).map((r) => String(r.role));
      const isPrivileged = roles.includes("super_admin") || roles.includes("developer");
      if (!isPrivileged && !prof?.tenant_id) {
        navigate({ to: "/rejoindre" });
        return;
      }

      // The PIN step selects the operating role for this session.
      if (sessionStorage.getItem("md_pin_done") !== "1") {
        navigate({ to: "/acces" });
        return;
      }
      setStatus("authed");
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
