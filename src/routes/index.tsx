import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingRedirect,
});

function LandingRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      navigate({ to: data.user ? "/dashboard" : "/auth", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return <div className="min-h-screen bg-background" />;
}
