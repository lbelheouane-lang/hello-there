import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/activation")({
  ssr: false,
  component: ActivationRedirect,
});

// The activation page now lives at /activate. Keep this legacy route as a
// permanent redirect so any old links/bookmarks still work.
function ActivationRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/activate", replace: true });
  }, [navigate]);
  return <div className="min-h-screen bg-background" />;
}
