import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Rafraîchissement manuel du cours de l'or (réservé aux admins). */
export const refreshGoldPrices = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { runGoldPriceUpdate } = await import("@/lib/gold-price-provider.server");
    return runGoldPriceUpdate();
  });
