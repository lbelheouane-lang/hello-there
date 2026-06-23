import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PasskeyStatus = "active" | "used" | "expired" | "disabled";

export interface PasskeyRow {
  id: string;
  code: string;
  label: string | null;
  status: PasskeyStatus;
  disabled: boolean;
  expires_at: string | null;
  used_by_email: string | null;
  used_at: string | null;
  created_at: string;
}

export interface ManagedUserRow {
  id: string;
  email: string | null;
  full_name: string | null;
  role: string;
  disabled: boolean;
  created_at: string;
  signup_passkey: string | null;
}

export type SignUpResult = { ok: true } | { ok: false; error: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cryptographically random, unambiguous passkey (24 chars, grouped). */
async function generatePasskey(): Promise<string> {
  const { randomBytes } = await import("crypto");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if ((i + 1) % 6 === 0 && i < 23) out += "-";
  }
  return out; // e.g. ABCDEF-GHJKLM-NPQRST-UVWXYZ
}

function computeStatus(row: {
  disabled: boolean;
  used_at: string | null;
  expires_at: string | null;
}): PasskeyStatus {
  if (row.used_at) return "used";
  if (row.disabled) return "disabled";
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "active";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("is_super_admin", {
    _user_id: context.userId,
  });
  if (!data) throw new Error("Accès réservé au Super Administrateur.");
}

// ---------------------------------------------------------------------------
// Public: account creation gated by passkey (server-side validated)
// ---------------------------------------------------------------------------

const signUpSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  passkey: z.string().trim().min(4).max(64),
});

export const signUpWithPasskey = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => signUpSchema.parse(d))
  .handler(async ({ data }): Promise<SignUpResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // The app stays locked until activated with a valid access key.
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("activated")
      .eq("singleton", true)
      .maybeSingle();
    if (!settings?.activated) {
      return { ok: false, error: "Application non activée." };
    }

    const code = data.passkey.trim().toUpperCase();
    const email = data.email.trim().toLowerCase();

    // 1. Validate the passkey server-side. Users can never bypass this.
    const { data: pk } = await supabaseAdmin
      .from("passkeys")
      .select("id, disabled, expires_at, used_at")
      .eq("code", code)
      .maybeSingle();

    if (!pk) return { ok: false, error: "Passkey invalide." };
    if (pk.used_at) return { ok: false, error: "Cette passkey a déjà été utilisée." };
    if (pk.disabled) return { ok: false, error: "Cette passkey a été désactivée." };
    if (pk.expires_at && new Date(pk.expires_at).getTime() < Date.now()) {
      return { ok: false, error: "Cette passkey a expiré." };
    }

    // 2. Create the auth user (email confirmed so they can sign in immediately).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (createErr || !created.user) {
      const msg = createErr?.message ?? "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        return { ok: false, error: "Un compte existe déjà avec cet e-mail." };
      }
      return { ok: false, error: "Création du compte impossible. Réessayez." };
    }
    const uid = created.user.id;

    // 3. Force the default 'client' role (the signup trigger may assign another).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: "client" });

    // 4. Record the profile + which passkey was used.
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, signup_passkey_id: pk.id, disabled: false })
      .eq("id", uid);

    // 5. Atomically mark the passkey as used (prevents reuse / races).
    const { data: claimed } = await supabaseAdmin
      .from("passkeys")
      .update({ used_by: uid, used_by_email: email, used_at: new Date().toISOString() })
      .eq("id", pk.id)
      .is("used_at", null)
      .select("id");

    if (!claimed || claimed.length === 0) {
      // Someone claimed it between our check and write — roll back the user.
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => undefined);
      return { ok: false, error: "Cette passkey a déjà été utilisée." };
    }

    // 6. Audit log.
    await supabaseAdmin.from("passkey_events").insert({
      passkey_id: pk.id,
      event_type: "used",
      detail: `Compte créé : ${data.fullName} <${email}>`,
      actor: uid,
    });

    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Super Admin: passkey management
// ---------------------------------------------------------------------------

export const listPasskeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PasskeyRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("passkeys")
      .select("id, code, label, disabled, expires_at, used_by_email, used_at, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      code: p.code,
      label: p.label,
      status: computeStatus(p),
      disabled: p.disabled,
      expires_at: p.expires_at,
      used_by_email: p.used_by_email,
      used_at: p.used_at,
      created_at: p.created_at,
    }));
  });

const createPasskeySchema = z.object({
  label: z.string().trim().max(120).optional().default(""),
  expiresInDays: z.number().int().min(0).max(3650).default(0),
});

export const createPasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createPasskeySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires_at =
      data.expiresInDays > 0
        ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
        : null;

    let code = await generatePasskey();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: inserted, error } = await supabaseAdmin
        .from("passkeys")
        .insert({
          code,
          label: data.label || null,
          expires_at,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (!error && inserted) {
        await supabaseAdmin.from("passkey_events").insert({
          passkey_id: inserted.id,
          event_type: "created",
          detail: data.label ? `Passkey créée : ${data.label}` : "Passkey créée",
          actor: context.userId,
        });
        return { ok: true, code };
      }
      if (!error?.message?.includes("duplicate")) throw new Error(error?.message ?? "Erreur");
      code = await generatePasskey();
    }
    throw new Error("Impossible de générer une passkey unique.");
  });

export const setPasskeyDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("passkeys").update({ disabled: data.disabled }).eq("id", data.id);
    return { ok: true };
  });

export const deletePasskey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("passkeys").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Super Admin: user management
// ---------------------------------------------------------------------------

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUserRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: authList }, { data: profiles }, { data: roleRows }, { data: pks }] =
      await Promise.all([
        supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
        supabaseAdmin.from("profiles").select("id, full_name, disabled, signup_passkey_id"),
        supabaseAdmin.from("user_roles").select("user_id, role"),
        supabaseAdmin.from("passkeys").select("id, code"),
      ]);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const pkMap = new Map((pks ?? []).map((p) => [p.id, p.code]));
    const rolesByUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(String(r.role));
      rolesByUser.set(r.user_id, arr);
    }

    function pickRole(roles: string[]): string {
      if (roles.includes("super_admin")) return "super_admin";
      if (roles.includes("admin")) return "admin";
      if (roles.includes("developer")) return "developer";
      if (roles.includes("employe")) return "employe";
      if (roles.includes("client")) return "client";
      return roles[0] ?? "—";
    }

    return (authList?.users ?? []).map((u) => {
      const prof = profileMap.get(u.id);
      const roles = rolesByUser.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email ?? null,
        full_name: prof?.full_name ?? (u.user_metadata?.full_name as string) ?? null,
        role: pickRole(roles),
        disabled: Boolean(prof?.disabled) || Boolean(u.banned_until),
        created_at: u.created_at,
        signup_passkey: prof?.signup_passkey_id ? pkMap.get(prof.signup_passkey_id) ?? null : null,
      };
    });
  });

export const setUserDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.id === context.userId) throw new Error("Vous ne pouvez pas vous désactiver.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ disabled: data.disabled }).eq("id", data.id);
    await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.disabled ? "876000h" : "none",
    });
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.id === context.userId) throw new Error("Vous ne pouvez pas vous supprimer.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.auth.admin.deleteUser(data.id).catch(() => undefined);
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), password: z.string().min(8).max(128) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const createUserSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "employe", "client"]).default("admin"),
});

/** Lets the Super Admin bootstrap/create staff (admin/employe) accounts. */
export const createUserAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createUserSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (error || !created.user) {
      const msg = (error?.message ?? "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        throw new Error("Un compte existe déjà avec cet e-mail.");
      }
      throw new Error("Création du compte impossible.");
    }
    const uid = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", uid);
    await supabaseAdmin.from("user_roles").insert({ user_id: uid, role: data.role });
    await supabaseAdmin
      .from("profiles")
      .update({ full_name: data.fullName, disabled: false })
      .eq("id", uid);
    return { ok: true };
  });
