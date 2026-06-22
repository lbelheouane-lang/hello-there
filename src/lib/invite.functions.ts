import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface InvitationInfo {
  valid: boolean;
  reason?: string;
  companyName?: string;
  grantRole?: string;
}

function clean(s: string) {
  return s.replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

/** Public: inspect an invitation code so the client can see what they're joining. */
export const getInvitation = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ code: z.string().min(1).max(40) }).parse(d))
  .handler(async ({ data }): Promise<InvitationInfo> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("*, clients(company_name, status)")
      .eq("code", data.code.toUpperCase())
      .maybeSingle();

    if (!inv) return { valid: false, reason: "Invitation introuvable." };
    if (inv.disabled) return { valid: false, reason: "Cette invitation a été désactivée." };
    if (inv.used_count >= inv.max_uses)
      return { valid: false, reason: "Cette invitation a déjà été utilisée." };
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now())
      return { valid: false, reason: "Cette invitation a expiré." };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (inv as any).clients;
    if (client?.status === "suspended")
      return { valid: false, reason: "Le compte client est suspendu." };

    return {
      valid: true,
      companyName: client?.company_name ?? "",
      grantRole: inv.grant_role,
    };
  });

const redeemSchema = z.object({
  code: z.string().min(1).max(40),
  firstName: z.string().trim().min(1).max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  pin: z.string().regex(/^\d{4,8}$/, "Le PIN doit comporter 4 à 8 chiffres."),
});

/** Public: redeem a valid invitation to create a PIN account tied to the client. */
export const redeemInvitation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => redeemSchema.parse(d))
  .handler(async ({ data }): Promise<{ ok: true } | { ok: false; error: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { hashPin, randomBackingPassword } = await import("./pin-auth.server");

    const code = data.code.toUpperCase();
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("*, clients(company_name, status)")
      .eq("code", code)
      .maybeSingle();

    if (!inv) return { ok: false, error: "Invitation introuvable." };
    if (inv.disabled) return { ok: false, error: "Cette invitation a été désactivée." };
    if (inv.used_count >= inv.max_uses)
      return { ok: false, error: "Cette invitation a déjà été utilisée." };
    if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now())
      return { ok: false, error: "Cette invitation a expiré." };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = (inv as any).clients;
    if (client?.status === "suspended")
      return { ok: false, error: "Le compte client est suspendu." };

    // Unique username derived from company name.
    const base = clean(client?.company_name || "client") || "client";
    let username = "";
    for (let i = 0; i < 8; i++) {
      const candidate = `${base}${Math.floor(1000 + Math.random() * 9000)}`.slice(0, 40);
      const { data: dupe } = await supabaseAdmin
        .from("employees")
        .select("id")
        .eq("username", candidate)
        .maybeSingle();
      if (!dupe) {
        username = candidate;
        break;
      }
    }
    if (!username) return { ok: false, error: "Impossible de générer un identifiant." };

    const email = `${username}@maisondor.app`;
    const password = randomBackingPassword();
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `${data.firstName} ${data.lastName}`.trim() },
    });
    if (createErr || !created?.user) return { ok: false, error: "Création du compte impossible." };
    const userId = created.user.id;
    const role = inv.grant_role === "employe" ? "employe" : "admin";

    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });

    const { data: emp, error: empErr } = await supabaseAdmin
      .from("employees")
      .insert({
        user_id: userId,
        first_name: data.firstName,
        last_name: data.lastName,
        username,
        role,
        is_active: true,
        is_bootstrap: false,
        client_id: inv.client_id,
        permissions: [],
      })
      .select("id")
      .single();
    if (empErr || !emp) {
      await supabaseAdmin.auth.admin.deleteUser(userId).catch(() => undefined);
      return { ok: false, error: "Création du compte impossible." };
    }

    const { hash, salt } = hashPin(data.pin);
    await supabaseAdmin.from("employee_credentials").insert({
      employee_id: emp.id,
      backing_email: email,
      backing_password: password,
      pin_hash: hash,
      pin_salt: salt,
    });

    // Consume one use of the invitation.
    await supabaseAdmin
      .from("invitations")
      .update({ used_count: inv.used_count + 1 })
      .eq("id", inv.id);

    return { ok: true };
  });
