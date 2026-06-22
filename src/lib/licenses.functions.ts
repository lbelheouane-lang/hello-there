import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Result returned to the client after an activation attempt. */
export interface ActivationData {
  license_id: string;
  license_key: string;
  store_name: string;
  status: string;
}

export type ActivationResult =
  | ({ ok: true } & ActivationData)
  | { ok: false; error: string };

const activateSchema = z.object({
  store_name: z.string().trim().min(1, "Le nom de la boutique est requis."),
  license_key: z.string().trim().min(1, "La clé de licence est requise."),
});

/**
 * Public activation endpoint. Verifies that the license key exists and is
 * Active, then records the activation and stamps the activity timestamps.
 * Uses the service-role client because the app is not yet authenticated at
 * activation time.
 */
export const activateLicense = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => activateSchema.parse(d))
  .handler(async ({ data }): Promise<ActivationResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const key = data.license_key.trim();
    const store = data.store_name.trim();

    const { data: lic, error } = await supabaseAdmin
      .from("licenses")
      .select("id, license_key, store_name, status, activation_date")
      .eq("license_key", key)
      .maybeSingle();

    if (error) throw new Error("Erreur lors de la vérification de la licence.");
    if (!lic) throw new Error("Clé de licence introuvable. Vérifiez la clé saisie.");
    if (lic.status !== "Active") {
      throw new Error(
        lic.status === "Suspended"
          ? "Cette licence est suspendue. Contactez le développeur."
          : "Cette licence a été révoquée. Contactez le développeur.",
      );
    }

    const now = new Date().toISOString();

    await supabaseAdmin
      .from("licenses")
      .update({
        last_activity: now,
        activation_date: lic.activation_date ?? now,
      })
      .eq("id", lic.id);

    // One activation row per (license, store): update if present, else insert.
    const { data: existing } = await supabaseAdmin
      .from("license_activations")
      .select("id")
      .eq("license_id", lic.id)
      .eq("store_name", store)
      .maybeSingle();

    if (existing) {
      await supabaseAdmin
        .from("license_activations")
        .update({ last_activity: now })
        .eq("id", existing.id);
    } else {
      await supabaseAdmin.from("license_activations").insert({
        license_id: lic.id,
        store_name: store,
        activated_at: now,
        last_activity: now,
      });
    }

    return {
      license_id: lic.id,
      license_key: lic.license_key,
      store_name: store,
      status: lic.status,
    };
  });

const activitySchema = z.object({
  license_key: z.string().trim().min(1),
  store_name: z.string().trim().min(1).optional(),
});

/**
 * Updates last_activity on the license (and matching activation row). Called
 * whenever a licensed store logs in. Returns whether the license is still
 * valid so the client can re-block access if the license was suspended/revoked.
 */
export const recordLicenseActivity = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => activitySchema.parse(d))
  .handler(async ({ data }): Promise<{ valid: boolean; status: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: lic } = await supabaseAdmin
      .from("licenses")
      .select("id, status")
      .eq("license_key", data.license_key.trim())
      .maybeSingle();

    if (!lic) return { valid: false, status: null };

    const now = new Date().toISOString();
    await supabaseAdmin.from("licenses").update({ last_activity: now }).eq("id", lic.id);

    if (data.store_name) {
      await supabaseAdmin
        .from("license_activations")
        .update({ last_activity: now })
        .eq("license_id", lic.id)
        .eq("store_name", data.store_name.trim());
    }

    return { valid: lic.status === "Active", status: lic.status };
  });
