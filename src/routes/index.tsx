import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getLocalActivation } from "@/lib/license-activation";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingRedirect,
});

function LandingRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    // First-launch gate: if this installation has not been activated yet,
    // the Activation Page is the landing page. Otherwise open the app normally.
    if (getLocalActivation()) {
      navigate({ to: "/dashboard", replace: true });
    } else {
      navigate({ to: "/activation", replace: true });
    }
  }, [navigate]);

  return <div className="min-h-screen bg-background" />;
}
