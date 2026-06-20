// Server-only PIN → account mapping for Maison d'Or.
// PINs are the user-facing credential; the underlying email/password accounts
// live ONLY on the server so they never reach the browser bundle. The database
// (RLS + roles) remains the real security boundary.

export type PinRole = "admin" | "employe";

interface PinAccount {
  pin: string;
  email: string;
  password: string;
  fullName: string;
}

export const PIN_ACCOUNTS: Record<PinRole, PinAccount> = {
  admin: {
    pin: "1234",
    email: "admin@maisondor.app",
    password: "Md0r!Admin-7Q2x9fLp_2026",
    fullName: "Administrateur",
  },
  employe: {
    pin: "0000",
    email: "employe@maisondor.app",
    password: "Md0r!Employe-3T8w1kZr_2026",
    fullName: "Employé",
  },
};

export function roleForPin(pin: string): PinRole | null {
  if (pin === PIN_ACCOUNTS.admin.pin) return "admin";
  if (pin === PIN_ACCOUNTS.employe.pin) return "employe";
  return null;
}

/**
 * Make sure the backing auth account exists with the expected password and a
 * single, correct role. Idempotent — safe to call on every PIN login.
 */
export async function ensurePinAccount(role: PinRole): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const account = PIN_ACCOUNTS[role];

  let userId: string | undefined;

  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: { full_name: account.fullName },
  });

  if (!createErr && created?.user) {
    userId = created.user.id;
  } else {
    // Already exists — find it and make sure the password is the known one.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const existing = list?.users.find((u) => u.email === account.email);
    userId = existing?.id;
    if (userId) {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: account.password,
        email_confirm: true,
      });
    }
  }

  if (!userId) throw new Error("Impossible de préparer le compte.");

  // Exactly one role for this account (overrides the signup trigger default).
  await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
  await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
}
