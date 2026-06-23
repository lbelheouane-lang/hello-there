import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthGate,
});

function AuthGate() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "authed">("loading");

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        navigate({ to: "/auth" });
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
