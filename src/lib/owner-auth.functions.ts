import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const passkeySchema = z.object({ passkey: z.string().min(6).max(128) });

export type OwnerLoginResult =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; error: string };

/**
 * Validate the owner passkey on the server against the hashed value in
 * owner_access, then sign in with the owner's server-only backing credentials
 * and return session tokens for the client to adopt via setSession().
 * The passkey and backing password never leave the server.
 */
export const ownerLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => passkeySchema.parse(data))
  .handler(async ({ data }): Promise<OwnerLoginResult> => {
    const { verifyPin } = await import("./pin-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("owner_access")
      .select("backing_email, backing_password, passkey_hash, passkey_salt")
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false, error: "Accès propriétaire non configuré." };

    if (!verifyPin(data.passkey.trim(), row.passkey_hash, row.passkey_salt)) {
      return { ok: false, error: "Passkey incorrect." };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: signin, error } = await supabase.auth.signInWithPassword({
      email: row.backing_email,
      password: row.backing_password,
    });

    if (error || !signin.session) {
      return { ok: false, error: "Connexion impossible. Réessayez." };
    }

    return {
      ok: true,
      access_token: signin.session.access_token,
      refresh_token: signin.session.refresh_token,
    };
  });
