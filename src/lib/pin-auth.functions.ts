import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pinSchema = z.object({ pin: z.string().min(1).max(12) });

export type PinLoginResult =
  | { ok: true; role: "admin" | "employe"; access_token: string; refresh_token: string }
  | { ok: false; error: string };

/**
 * Validate a PIN on the server, ensure the backing account exists, sign in
 * with the server-only credentials, and return session tokens for the client
 * to adopt via supabase.auth.setSession(). Passwords never leave the server.
 */
export const pinLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => pinSchema.parse(data))
  .handler(async ({ data }): Promise<PinLoginResult> => {
    const { roleForPin, ensurePinAccount, PIN_ACCOUNTS } = await import("./pin-auth.server");

    const role = roleForPin(data.pin);
    if (!role) return { ok: false, error: "Code PIN incorrect." };

    const account = PIN_ACCOUNTS[role];

    try {
      await ensurePinAccount(role);
    } catch {
      return { ok: false, error: "Préparation du compte impossible." };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: signin, error } = await supabase.auth.signInWithPassword({
      email: account.email,
      password: account.password,
    });

    if (error || !signin.session) {
      return { ok: false, error: "Connexion impossible. Réessayez." };
    }

    return {
      ok: true,
      role,
      access_token: signin.session.access_token,
      refresh_token: signin.session.refresh_token,
    };
  });
