// Server-only PIN + employee credential helpers for Maison d'Or.
//
// PINs are the user-facing credential. Each employee is backed by a real auth
// account (email/password) that lives ONLY on the server so it never reaches
// the browser bundle. PINs are stored hashed (scrypt) in employee_credentials,
// a table the Data API cannot read. The database (RLS + roles) remains the
// real security boundary.

import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import {
  ALL_PERMISSIONS,
  DEFAULT_EMPLOYEE_PERMISSIONS,
  type PermissionKey,
} from "./permissions";

export type PinRole = "admin" | "employe";

interface BootstrapAccount {
  pin: string;
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: PinRole;
  permissions: PermissionKey[];
}

export const BOOTSTRAP_ACCOUNTS: BootstrapAccount[] = [
  {
    pin: "1234",
    username: "admin",
    email: "admin@maisondor.app",
    password: "Md0r!Admin-7Q2x9fLp_2026",
    firstName: "Administrateur",
    lastName: "",
    role: "admin",
    permissions: ALL_PERMISSIONS,
  },
  {
    pin: "0000",
    username: "employe",
    email: "employe@maisondor.app",
    password: "Md0r!Employe-3T8w1kZr_2026",
    firstName: "Employé",
    lastName: "",
    role: "employe",
    permissions: DEFAULT_EMPLOYEE_PERMISSIONS,
  },
];

// ---------------------------------------------------------------------------
// PIN hashing
// ---------------------------------------------------------------------------

export function hashPin(pin: string): { hash: string; salt: string } {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pin, salt, 64).toString("hex");
  return { hash, salt };
}

export function verifyPin(pin: string, hash: string, salt: string): boolean {
  try {
    const candidate = scryptSync(pin, salt, 64);
    const expected = Buffer.from(hash, "hex");
    if (candidate.length !== expected.length) return false;
    return timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

export function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function randomBackingPassword(): string {
  return `Md0r!${randomBytes(18).toString("base64url")}`;
}

// ---------------------------------------------------------------------------
// Bootstrap accounts (create-if-missing, never overwrites a changed PIN)
// ---------------------------------------------------------------------------

export async function ensureBootstrapAccounts(): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  for (const acc of BOOTSTRAP_ACCOUNTS) {
    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("username", acc.username)
      .maybeSingle();

    if (existing) continue; // already provisioned — leave PIN/permissions intact

    // Find or create the backing auth user.
    let userId: string | undefined;
    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
        user_metadata: { full_name: `${acc.firstName} ${acc.lastName}`.trim() },
      });

    if (!createErr && created?.user) {
      userId = created.user.id;
    } else {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
      const found = list?.users.find((u) => u.email === acc.email);
      userId = found?.id;
      if (userId) {
        await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: acc.password,
          email_confirm: true,
        });
      }
    }
    if (!userId) continue;

    // Exactly one role for this account.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: acc.role });

    const { data: emp } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: userId,
        first_name: acc.firstName,
        last_name: acc.lastName,
        username: acc.username,
        role: acc.role,
        is_active: true,
        is_bootstrap: true,
        permissions: acc.permissions,
      })
      .select("id")
      .single();

    if (emp) {
      const { hash, salt } = hashPin(acc.pin);
      await supabaseAdmin.from("employee_credentials").insert({
        employee_id: emp.id,
        backing_email: acc.email,
        backing_password: acc.password,
        pin_hash: hash,
        pin_salt: salt,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Login lookup
// ---------------------------------------------------------------------------

export interface MatchedEmployee {
  employeeId: string;
  userId: string;
  role: PinRole;
  backingEmail: string;
  backingPassword: string;
}

/** Find the active employee whose PIN matches. Compares against every active
 *  employee's hash (small directory). Returns null when none match. */
export async function findEmployeeByPin(pin: string): Promise<MatchedEmployee | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows } = await supabaseAdmin
    .from("employees")
    .select("id, user_id, role, is_active, employee_credentials(backing_email, backing_password, pin_hash, pin_salt)")
    .eq("is_active", true);

  for (const row of rows ?? []) {
    const cred = Array.isArray(row.employee_credentials)
      ? row.employee_credentials[0]
      : row.employee_credentials;
    if (!cred || !row.user_id) continue;
    if (verifyPin(pin, cred.pin_hash, cred.pin_salt)) {
      return {
        employeeId: row.id,
        userId: row.user_id,
        role: row.role as PinRole,
        backingEmail: cred.backing_email,
        backingPassword: cred.backing_password,
      };
    }
  }
  return null;
}
