import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pinSchema = z.object({ pin: z.string().regex(/^\d{4,8}$/) });

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

    // Make sure the two default accounts exist on a fresh install.
    try {
      await ensureBootstrapAccounts();
    } catch {
      // Non-fatal: existing accounts can still log in.
    }

    const match = await findEmployeeByPin(data.pin);
    if (!match) return { ok: false, error: "Code PIN incorrect." };

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
