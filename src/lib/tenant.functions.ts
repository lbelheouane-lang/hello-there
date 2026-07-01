import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantRow {
  id: string;
  name: string;
  status: string;
  created_at: string;
  user_count: number;
}

export interface TenantKeyRow {
  id: string;
  label: string | null;
  tenant_id: string;
  tenant_name: string | null;
  status: string;
  used_count: number;
  max_uses: number;
  expires_at: string | null;
  created_at: string;
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

function randomKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const groups: string[] = [];
  for (let g = 0; g < 4; g++) {
    let s = "";
    for (let i = 0; i < 4; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    groups.push(s);
  }
  return "ORUS-KEY-" + groups.join("-");
}

// ---------------------------------------------------------------------------
// Super Admin — list tenants
// ---------------------------------------------------------------------------

export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: tenants, error }, { data: profiles }] = await Promise.all([
      supabaseAdmin.from("tenants").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("tenant_id"),
    ]);
    if (error) throw new Error(error.message);
    const counts = new Map<string, number>();
    (profiles ?? []).forEach((p) => {
      if (p.tenant_id) counts.set(p.tenant_id, (counts.get(p.tenant_id) ?? 0) + 1);
    });
    return (tenants ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      created_at: t.created_at,
      user_count: counts.get(t.id) ?? 0,
    }));
  });

// ---------------------------------------------------------------------------
// Super Admin — list access keys
// ---------------------------------------------------------------------------

export const listTenantKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TenantKeyRow[]> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: keys, error }, { data: tenants }] = await Promise.all([
      supabaseAdmin.from("tenant_access_keys").select("*").order("created_at", { ascending: false }),
      supabaseAdmin.from("tenants").select("id, name"),
    ]);
    if (error) throw new Error(error.message);
    const names = new Map((tenants ?? []).map((t) => [t.id, t.name]));
    return (keys ?? []).map((k) => ({
      id: k.id,
      label: k.label,
      tenant_id: k.tenant_id,
      tenant_name: names.get(k.tenant_id) ?? null,
      status: k.status,
      used_count: k.used_count,
      max_uses: k.max_uses,
      expires_at: k.expires_at,
      created_at: k.created_at,
    }));
  });

// ---------------------------------------------------------------------------
// Super Admin — create a new tenant + a single access key
// ---------------------------------------------------------------------------

const createSchema = z.object({
  tenantName: z.string().min(2).max(120),
  label: z.string().max(120).optional(),
});

export const createTenantWithKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ key: string; tenantId: string }> => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("./pin-auth.server");

    const { data: tenant, error: tErr } = await supabaseAdmin
      .from("tenants")
      .insert({ name: data.tenantName, status: "pending", created_by: context.userId })
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);

    const key = randomKey();
    const { hash, salt } = hashPin(key);
    const { error: kErr } = await supabaseAdmin.from("tenant_access_keys").insert({
      tenant_id: tenant.id,
      label: data.label ?? data.tenantName,
      key_hash: hash,
      key_salt: salt,
      status: "active",
      max_uses: 1,
      used_count: 0,
      created_by: context.userId,
    });
    if (kErr) throw new Error(kErr.message);

    return { key, tenantId: tenant.id };
  });

// ---------------------------------------------------------------------------
// Authenticated user — activate an access key on first login
// ---------------------------------------------------------------------------

const activateSchema = z.object({ key: z.string().min(6).max(128) });

export const activateTenantKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => activateSchema.parse(d))
  .handler(async ({ context, data }): Promise<{ ok: boolean; error?: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyPin } = await import("./pin-auth.server");

    // Already attached?
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (profile?.tenant_id) return { ok: true };

    const key = data.key.trim();
    const now = Date.now();
    const { data: rows } = await supabaseAdmin
      .from("tenant_access_keys")
      .select("id, tenant_id, key_hash, key_salt, status, max_uses, used_count, expires_at");

    const match = (rows ?? []).find(
      (r) =>
        r.status === "active" &&
        r.used_count < r.max_uses &&
        (!r.expires_at || new Date(r.expires_at).getTime() > now) &&
        verifyPin(key, r.key_hash, r.key_salt),
    );
    if (!match) return { ok: false, error: "Clé d'accès invalide ou déjà utilisée." };

    const { error } = await supabaseAdmin.rpc("provision_tenant_for_user", {
      _tenant_id: match.tenant_id,
      _user_id: context.userId,
      _key_id: match.id,
    });
    if (error) return { ok: false, error: error.message };

    return { ok: true };
  });
