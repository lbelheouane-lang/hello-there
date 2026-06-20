import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERMISSION_KEYS } from "./permissions";

const ROLES = ["admin", "employe"] as const;
const permList = z.array(z.enum(PERMISSION_KEYS as [string, ...string[]]));
const pinField = z.string().regex(/^\d{4,8}$/, "Le PIN doit comporter 4 à 8 chiffres.");

export interface EmployeeRow {
  id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  username: string;
  phone: string | null;
  role: "admin" | "employe";
  is_active: boolean;
  permissions: string[];
  last_login_at: string | null;
  is_bootstrap: boolean;
  created_at: string;
}

export interface PinAuditRow {
  id: string;
  actor_name: string | null;
  target_name: string | null;
  action: string;
  created_at: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

function displayName(first?: string | null, last?: string | null, fallback = "—") {
  const n = `${first ?? ""} ${last ?? ""}`.trim();
  return n || fallback;
}

/** List all employees (admin only). */
export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EmployeeRow[]> => {
    await assertAdmin(context);
    // Ensure the two default accounts exist so they always appear in the list.
    try {
      const { ensureBootstrapAccounts } = await import("./pin-auth.server");
      await ensureBootstrapAccounts();
    } catch {
      // non-fatal
    }
    const { data, error } = await context.supabase
      .from("employees")
      .select(
        "id, user_id, first_name, last_name, username, phone, role, is_active, permissions, last_login_at, is_bootstrap, created_at",
      )
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as EmployeeRow[];
  });

/** PIN change/reset history (admin only). */
export const listPinAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PinAuditRow[]> => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("pin_audit_log")
      .select("id, actor_name, target_name, action, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as PinAuditRow[];
  });

const createSchema = z.object({
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(""),
  username: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9._-]+$/, "Nom d'utilisateur invalide."),
  phone: z.string().trim().max(40).optional().default(""),
  role: z.enum(ROLES),
  permissions: permList.default([]),
  pin: pinField,
});

/** Create a new employee with a backing auth account and PIN (admin only). */
export const createEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin, randomBackingPassword } = await import("./pin-auth.server");

    const username = data.username.toLowerCase();
    const email = `${username}@maisondor.app`;

    const { data: dupe } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (dupe) throw new Error("Ce nom d'utilisateur existe déjà.");

    const password = randomBackingPassword();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName(data.firstName, data.lastName) },
    });
    if (createErr || !created?.user) {
      throw new Error("Impossible de créer le compte employé (email peut-être déjà utilisé).");
    }
    const userId = created.user.id;

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: data.role });

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        username,
        phone: data.phone || null,
        role: data.role,
        permissions: data.permissions,
        is_active: true,
        is_bootstrap: false,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (empErr || !emp) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error("Création de l'employé impossible.");
    }

    const { hash, salt } = hashPin(data.pin);
    await supabaseAdmin.from("employee_credentials").insert({
      employee_id: emp.id,
      backing_email: email,
      backing_password: password,
      pin_hash: hash,
      pin_salt: salt,
    });

    await logPin(supabaseAdmin, context.userId, userId, "created");
    return { ok: true };
  });

const updateSchema = z.object({
  id: z.string().uuid(),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).default(""),
  phone: z.string().trim().max(40).optional().default(""),
  role: z.enum(ROLES),
  permissions: permList.default([]),
});

/** Update employee info, role, and permissions (admin only). */
export const updateEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("user_id, is_bootstrap, role")
      .eq("id", data.id)
      .single();
    if (!emp) throw new Error("Employé introuvable.");

    await supabaseAdmin
      .from("employees")
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
        phone: data.phone || null,
        role: data.role,
        permissions: data.permissions,
      })
      .eq("id", data.id);

    // Keep user_roles in sync (don't demote the last bootstrap admin).
    if (emp.user_id && data.role !== emp.role) {
      if (emp.is_bootstrap && emp.role === "admin" && data.role !== "admin") {
        throw new Error("Le compte administrateur par défaut ne peut pas être rétrogradé.");
      }
      await supabaseAdmin.from("user_roles").delete().eq("user_id", emp.user_id);
      await supabaseAdmin.from("user_roles").insert({ user_id: emp.user_id, role: data.role });
    }
    return { ok: true };
  });

/** Activate / deactivate an employee (admin only). */
export const setEmployeeActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("is_bootstrap, role")
      .eq("id", data.id)
      .single();
    if (emp?.is_bootstrap && emp.role === "admin" && !data.active) {
      throw new Error("Le compte administrateur par défaut ne peut pas être désactivé.");
    }
    await supabaseAdmin.from("employees").update({ is_active: data.active }).eq("id", data.id);
    return { ok: true };
  });

/** Delete an employee and its backing account (admin only). */
export const deleteEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("user_id, is_bootstrap")
      .eq("id", data.id)
      .single();
    if (!emp) throw new Error("Employé introuvable.");
    if (emp.is_bootstrap) throw new Error("Les comptes par défaut ne peuvent pas être supprimés.");
    if (emp.user_id === context.userId) throw new Error("Vous ne pouvez pas supprimer votre propre compte.");

    if (emp.user_id) {
      // Cascades to employees + employee_credentials via FK.
      await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
    } else {
      await supabaseAdmin.from("employees").delete().eq("id", data.id);
    }
    return { ok: true };
  });

const changePinSchema = z.object({ currentPin: pinField, newPin: pinField });

/** Authenticated user changes their own PIN (requires current PIN). */
export const changeOwnPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => changePinSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin, verifyPin } = await import("./pin-auth.server");

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, user_id, employee_credentials(pin_hash, pin_salt)")
      .eq("user_id", context.userId)
      .single();
    const cred = emp?.employee_credentials
      ? Array.isArray(emp.employee_credentials)
        ? emp.employee_credentials[0]
        : emp.employee_credentials
      : null;
    if (!emp || !cred) throw new Error("Compte introuvable.");
    if (!verifyPin(data.currentPin, cred.pin_hash, cred.pin_salt)) {
      throw new Error("Le PIN actuel est incorrect.");
    }
    const { hash, salt } = hashPin(data.newPin);
    await supabaseAdmin
      .from("employee_credentials")
      .update({ pin_hash: hash, pin_salt: salt })
      .eq("employee_id", emp.id);

    await logPin(supabaseAdmin, context.userId, context.userId, "changed");
    return { ok: true };
  });

const resetPinSchema = z.object({ employeeId: z.string().uuid(), newPin: pinField });

/** Admin resets an employee's PIN (no current PIN needed). */
export const resetEmployeePin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => resetPinSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin } = await import("./pin-auth.server");

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .select("id, user_id")
      .eq("id", data.employeeId)
      .single();
    if (!emp) throw new Error("Employé introuvable.");

    const { hash, salt } = hashPin(data.newPin);
    await supabaseAdmin
      .from("employee_credentials")
      .update({ pin_hash: hash, pin_salt: salt })
      .eq("employee_id", emp.id);

    await logPin(supabaseAdmin, context.userId, emp.user_id, "reset");
    return { ok: true };
  });

// ---------------------------------------------------------------------------

async function logPin(
  admin: typeof import("@/integrations/supabase/client.server")["supabaseAdmin"],
  actorUserId: string,
  targetUserId: string | null,
  action: "created" | "changed" | "reset",
) {
  try {
    const ids = [actorUserId, targetUserId].filter(Boolean) as string[];
    const { data: emps } = await admin
      .from("employees")
      .select("user_id, first_name, last_name, username")
      .in("user_id", ids);
    const nameFor = (uid: string | null) => {
      const e = emps?.find((r) => r.user_id === uid);
      if (!e) return null;
      return `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim() || e.username;
    };
    await admin.from("pin_audit_log").insert({
      actor_user_id: actorUserId,
      actor_name: nameFor(actorUserId),
      target_user_id: targetUserId,
      target_name: nameFor(targetUserId),
      action,
    });
  } catch {
    // best effort
  }
}
