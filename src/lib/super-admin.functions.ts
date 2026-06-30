import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientRow {
  id: string;
  company_name: string;
  contact_name: string | null;
  email: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  last_login_at: string | null;
  user_count: number;
}

export interface InvitationRow {
  id: string;
  client_id: string | null;
  client_name: string | null;
  code: string;
  grant_role: string;
  max_uses: number;
  used_count: number;
  disabled: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface AccessKeyRow {
  id: string;
  name: string;
  key_value: string;
  client_id: string | null;
  client_name: string | null;
  status: string;
  expires_at: string | null;
  last_used_at: string | null;
  usage_count: number;
  created_at: string;
}

export interface SuperAdminStats {
  totalClients: number;
  activeClients: number;
  suspendedClients: number;
  totalUsers: number;
  activeInvitations: number;
  expiredInvitations: number;
  recentLogins: { name: string; at: string }[];
}

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

function randomCode(len = 10): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Dashboard stats
// ---------------------------------------------------------------------------

export const getSuperAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SuperAdminStats> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: clients }, { data: invites }, { data: emps }] = await Promise.all([
      supabaseAdmin.from("clients").select("status"),
      supabaseAdmin.from("invitations").select("disabled, expires_at, used_count, max_uses"),
      supabaseAdmin
        .from("employees")
        .select("first_name, last_name, username, last_login_at")
        .order("last_login_at", { ascending: false })
        .limit(8),
    ]);

    const now = Date.now();
    const activeInvitations = (invites ?? []).filter(
      (i) =>
        !i.disabled &&
        i.used_count < i.max_uses &&
        (!i.expires_at || new Date(i.expires_at).getTime() > now),
    ).length;
    const expiredInvitations = (invites ?? []).length - activeInvitations;

    return {
      totalClients: (clients ?? []).length,
      activeClients: (clients ?? []).filter((c) => c.status === "active").length,
      suspendedClients: (clients ?? []).filter((c) => c.status === "suspended").length,
      totalUsers: (emps ?? []).length, // see listUsers for full count
      activeInvitations,
      expiredInvitations,
      recentLogins: (emps ?? [])
        .filter((e) => e.last_login_at)
        .map((e) => ({
          name: `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || e.username,
          at: e.last_login_at as string,
        }))
        .slice(0, 6),
    };
  });

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export const listClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: clients, error }, { data: emps }] = await Promise.all([
      supabaseAdmin.from("clients").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("employees").select("client_id, last_login_at"),
    ]);
    if (error) throw new Error(error.message);

    return (clients ?? []).map((c) => {
      const members = (emps ?? []).filter((e) => e.client_id === c.id);
      const lastLogin = members
        .map((m) => m.last_login_at)
        .filter(Boolean)
        .sort()
        .reverse()[0];
      return {
        id: c.id,
        company_name: c.company_name,
        contact_name: c.contact_name,
        email: c.email,
        status: c.status,
        notes: c.notes,
        created_at: c.created_at,
        last_login_at: (lastLogin as string) ?? c.last_login_at,
        user_count: members.length,
      };
    });
  });

const createClientSchema = z.object({
  companyName: z.string().trim().min(1).max(120),
  contactName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().or(z.literal("")).optional().default(""),
  notes: z.string().trim().max(500).optional().default(""),
});

export const createClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createClientSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: client, error } = await supabaseAdmin
      .from("clients")
      .insert({
        company_name: data.companyName,
        contact_name: data.contactName || null,
        email: data.email || null,
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !client) throw new Error("Création du client impossible.");
    return { ok: true, id: client.id };
  });

export const setClientStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "suspended"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Suspend/activate all the client's users too.
    await supabaseAdmin.from("clients").update({ status: data.status }).eq("id", data.id);
    await supabaseAdmin
      .from("employees")
      .update({ is_active: data.status === "active" })
      .eq("client_id", data.id);
    return { ok: true };
  });

export const deleteClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove the client's backing auth users first.
    const { data: members } = await supabaseAdmin
      .from("employees")
      .select("user_id, is_bootstrap")
      .eq("client_id", data.id);
    for (const m of members ?? []) {
      if (m.user_id && !m.is_bootstrap) {
        await supabaseAdmin.auth.admin.deleteUser(m.user_id).catch(() => undefined);
      }
    }
    await supabaseAdmin.from("clients").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const listInvitations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<InvitationRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("invitations")
      .select("*, clients(company_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((i: any) => ({
      id: i.id,
      client_id: i.client_id,
      client_name: i.clients?.company_name ?? null,
      code: i.code,
      grant_role: i.grant_role,
      max_uses: i.max_uses,
      used_count: i.used_count,
      disabled: i.disabled,
      expires_at: i.expires_at,
      created_at: i.created_at,
    }));
  });

const createInviteSchema = z.object({
  clientId: z.string().uuid(),
  grantRole: z.enum(["admin", "employe"]).default("admin"),
  maxUses: z.number().int().min(1).max(100).default(1),
  expiresInDays: z.number().int().min(0).max(365).default(7),
});

export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createInviteSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires_at =
      data.expiresInDays > 0
        ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
        : null;

    let code = randomCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error } = await supabaseAdmin.from("invitations").insert({
        client_id: data.clientId,
        code,
        grant_role: data.grantRole,
        max_uses: data.maxUses,
        expires_at,
        created_by: context.userId,
      });
      if (!error) return { ok: true, code };
      if (!error.message?.includes("duplicate")) throw new Error(error.message);
      code = randomCode();
    }
    throw new Error("Impossible de générer un code unique.");
  });

export const setInvitationDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), disabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invitations").update({ disabled: data.disabled }).eq("id", data.id);
    return { ok: true };
  });

export const deleteInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("invitations").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Access keys
// ---------------------------------------------------------------------------

function randomKey(): string {
  const seg = () => randomCode(4);
  return `MK-${seg()}-${seg()}-${seg()}`;
}

export const listAccessKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccessKeyRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("access_keys")
      .select("*, clients(company_name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((k: any) => ({
      id: k.id,
      name: k.name,
      key_value: k.key_value,
      client_id: k.client_id,
      client_name: k.clients?.company_name ?? null,
      status: k.status,
      expires_at: k.expires_at,
      last_used_at: k.last_used_at,
      usage_count: k.usage_count,
      created_at: k.created_at,
    }));
  });

const createKeySchema = z.object({
  name: z.string().trim().min(1).max(120),
  clientId: z.string().uuid().optional().nullable(),
  expiresInDays: z.number().int().min(0).max(3650).default(0),
});

export const createAccessKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createKeySchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const expires_at =
      data.expiresInDays > 0
        ? new Date(Date.now() + data.expiresInDays * 86400000).toISOString()
        : null;
    const key_value = randomKey();
    const { error } = await supabaseAdmin.from("access_keys").insert({
      name: data.name,
      key_value,
      client_id: data.clientId || null,
      expires_at,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true, key: key_value };
  });

export const setAccessKeyStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), status: z.enum(["active", "disabled"]) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("access_keys").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const regenerateAccessKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const key_value = randomKey();
    await supabaseAdmin
      .from("access_keys")
      .update({ key_value, status: "active", usage_count: 0, last_used_at: null })
      .eq("id", data.id);
    return { ok: true, key: key_value };
  });

export const deleteAccessKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("access_keys").delete().eq("id", data.id);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Clean start — reset an instance for a brand-new client
// ---------------------------------------------------------------------------

/**
 * Wipes ALL business + demo + onboarding data so a freshly remixed instance
 * starts empty for a new jeweller. Super Admin accounts, master passkeys and
 * store settings are preserved. Requires typing the confirmation phrase.
 */
export const resetInstanceForNewClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ confirm: z.literal("REINITIALISER") }).parse(d),
  )
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("reset_instance_for_new_client");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
