import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SuperAdminPasskeyRow {
  id: string;
  label: string;
  is_master: boolean;
  disabled: boolean;
  last_used_at: string | null;
  created_at: string;
}

export interface SuperAdminAccessLogRow {
  id: string;
  success: boolean;
  label: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export type SuperAdminLoginResult =
  | { ok: true; access_token: string; refresh_token: string }
  | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (!data) throw new Error("Accès réservé au Super Administrateur.");
}

function randomPasskey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) {
      s += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    groups.push(s);
  }
  return "ORUS-" + groups.join("-");
}

// ---------------------------------------------------------------------------
// Public login — passkey only
// ---------------------------------------------------------------------------

const passkeySchema = z.object({ passkey: z.string().min(6).max(128) });

/**
 * Validate a Super Admin passkey on the server. On success, sign in using the
 * server-only backing super_admin credentials (owner_access) and return
 * session tokens. Every attempt — success or failure — is logged. Normal
 * client passkeys live in a different table and can never match here.
 */
export const superAdminPasskeyLogin = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => passkeySchema.parse(data))
  .handler(async ({ data }): Promise<SuperAdminLoginResult> => {
    const { verifyPin } = await import("./pin-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getRequestHeader, getRequestIP } = await import(
      "@tanstack/react-start/server"
    );

    let ip: string | null = null;
    let userAgent: string | null = null;
    try {
      ip = getRequestIP({ xForwardedFor: true }) ?? null;
      userAgent = getRequestHeader("user-agent") ?? null;
    } catch {
      /* request context unavailable */
    }

    const passkey = data.passkey.trim();

    async function log(success: boolean, passkeyId: string | null, label: string | null) {
      await supabaseAdmin.from("super_admin_access_log").insert({
        success,
        passkey_id: passkeyId,
        label,
        ip_address: ip,
        user_agent: userAgent,
      });
    }

    const { data: rows } = await supabaseAdmin
      .from("super_admin_passkeys")
      .select("id, label, passkey_hash, passkey_salt, disabled");

    const match = (rows ?? []).find(
      (r) => !r.disabled && verifyPin(passkey, r.passkey_hash, r.passkey_salt),
    );

    if (!match) {
      await log(false, null, null);
      return { ok: false, error: "Passkey invalide." };
    }

    // Sign in with the server-only backing super_admin account.
    const { data: owner } = await supabaseAdmin
      .from("owner_access")
      .select("backing_email, backing_password")
      .limit(1)
      .maybeSingle();

    if (!owner) {
      await log(false, match.id, match.label);
      return { ok: false, error: "Accès Super Admin non configuré." };
    }

    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: signin, error } = await supabase.auth.signInWithPassword({
      email: owner.backing_email,
      password: owner.backing_password,
    });

    if (error || !signin.session) {
      await log(false, match.id, match.label);
      return { ok: false, error: "Connexion impossible. Réessayez." };
    }

    await supabaseAdmin
      .from("super_admin_passkeys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", match.id);
    await log(true, match.id, match.label);

    return {
      ok: true,
      access_token: signin.session.access_token,
      refresh_token: signin.session.refresh_token,
    };
  });

// ---------------------------------------------------------------------------
// Management (super admin only)
// ---------------------------------------------------------------------------

export const listSuperAdminPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminPasskeyRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("super_admin_passkeys")
      .select("id, label, is_master, disabled, last_used_at, created_at")
      .order("is_master", { ascending: false })
      .order("created_at", { ascending: false });
    return (data ?? []) as SuperAdminPasskeyRow[];
  });

export const createSuperAdminPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ label: z.string().trim().min(1).max(80) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ id: string; passkey: string }> => {
    await assertSuperAdmin(context);
    const { hashPin } = await import("./pin-auth.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const passkey = randomPasskey();
    const { hash, salt } = hashPin(passkey);

    const { data: row, error } = await supabaseAdmin
      .from("super_admin_passkeys")
      .insert({ label: data.label, passkey_hash: hash, passkey_salt: salt })
      .select("id")
      .single();

    if (error || !row) throw new Error("Création impossible.");
    return { id: row.id, passkey };
  });

export const setSuperAdminPasskeyDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("super_admin_passkeys")
      .update({ disabled: data.disabled })
      .eq("id", data.id);
    if (error) throw new Error("Mise à jour impossible.");
    return { ok: true };
  });

export const deleteSuperAdminPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("super_admin_passkeys")
      .select("is_master")
      .eq("id", data.id)
      .maybeSingle();
    if (row?.is_master) throw new Error("La passkey maître ne peut pas être supprimée.");
    const { error } = await supabaseAdmin
      .from("super_admin_passkeys")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error("Suppression impossible.");
    return { ok: true };
  });

export const listSuperAdminAccessLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminAccessLogRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("super_admin_access_log")
      .select("id, success, label, ip_address, user_agent, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []) as SuperAdminAccessLogRow[];
  });
