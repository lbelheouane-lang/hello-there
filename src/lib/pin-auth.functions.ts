import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pinSchema = z.object({
  pin: z.string().regex(/^\d{4,8}$/),
  expectedRole: z.enum(["admin", "employe"]).optional(),
});

export type PinLoginResult =
  | { ok: true; role: "admin" | "employe"; access_token: string; refresh_token: string }
  | { ok: false; error: string };

/**
 * Validate a PIN on the server against the employee directory, sign in with the
 * matched employee's server-only backing credentials, and return session tokens
 * for the client to adopt via supabase.auth.setSession(). PINs and passwords
 * never leave the server.
 */
export const pinLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => pinSchema.parse(data))
  .handler(async ({ data }): Promise<PinLoginResult> => {
    const { ensureBootstrapAccounts, findEmployeeByPin } = await import("./pin-auth.server");

    // The app stays locked until activated with a valid access key.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("activated")
      .eq("singleton", true)
      .maybeSingle();
    if (!settings?.activated) {
      return { ok: false, error: "Application non activée." };
    }

    // Make sure the two default accounts exist on a fresh install.
    try {
      await ensureBootstrapAccounts();
    } catch {
      // Non-fatal: existing accounts can still log in.
    }

    const match = await findEmployeeByPin(data.pin);
    if (!match) return { ok: false, error: "Code PIN incorrect." };

    // When a role is explicitly chosen on the access screen, the PIN must
    // belong to that role.
    if (data.expectedRole && match.role !== data.expectedRole) {
      return {
        ok: false,
        error:
          data.expectedRole === "admin"
            ? "Ce code PIN n'est pas un code administrateur."
            : "Ce code PIN n'est pas un code employé.",
      };
    }


    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: signin, error } = await supabase.auth.signInWithPassword({
      email: match.backingEmail,
      password: match.backingPassword,
    });

    if (error || !signin.session) {
      return { ok: false, error: "Connexion impossible. Réessayez." };
    }

    // Record the login time (best effort).
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("employees")
        .update({ last_login_at: new Date().toISOString() })
        .eq("id", match.employeeId);
    } catch {
      // ignore
    }

    return {
      ok: true,
      role: match.role,
      access_token: signin.session.access_token,
      refresh_token: signin.session.refresh_token,
    };
  });
