import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Ensure the caller is an authenticated administrator. Throws otherwise. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("Action réservée aux administrateurs.");
}

/** Counts of demo records, used to display demo status in the UI. */
export const getDemoStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const tables = ["products", "customers", "sales", "suppliers", "gold_prices"] as const;
    const counts: Record<string, number> = {};
    for (const t of tables) {
      const { count } = await context.supabase
        .from(t)
        .select("*", { count: "exact", head: true })
        .eq("is_demo", true);
      counts[t] = count ?? 0;
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total, active: total > 0 };
  });

/** Generate (or regenerate) the demo dataset. Admin only. */
export const generateDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("seed_demo_data");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Remove every demo record. Admin only. */
export const deleteDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("delete_demo_data");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
