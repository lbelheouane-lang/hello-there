import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getLocalActivation, isDeveloperEmail } from "@/lib/license-activation";

export const Route = createFileRoute("/")({
  ssr: false,
  component: LandingRedirect,
});

function LandingRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      // Hidden developer override: the developer account skips activation
      // entirely and lands directly on the License Management dashboard.
      const { data } = await supabase.auth.getUser();
      if (!active) return;
      if (isDeveloperEmail(data.user?.email)) {
        navigate({ to: "/licences", replace: true });
        return;
      }

      // First-launch gate: if this installation has not been activated yet,
      // the Activation Page is the landing page. Otherwise open the app normally.
      if (getLocalActivation()) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        navigate({ to: "/activate", replace: true });
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  return <div className="min-h-screen bg-background" />;
}
