import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export interface ActivationStatus {
  activated: boolean;
  storeName: string | null;
}

/** Public: is this deployment activated yet? Used to gate the login screen. */
export const getActivationStatus = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActivationStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("store_settings")
      .select("activated, store_name")
      .eq("singleton", true)
      .maybeSingle();
    return {
      activated: Boolean(data?.activated),
      storeName: data?.store_name ?? null,
    };
  },
);

const activateSchema = z.object({
  key: z.string().trim().min(4).max(64),
  storeName: z.string().trim().min(2).max(120),
});

export type ActivateResult = { ok: true } | { ok: false; error: string };

/**
 * Public: unlock the app for first-time use. Validates the access key sold to
 * the customer, records the store name, provisions the default PIN accounts,
 * and marks the deployment activated. Without a valid key the app stays locked.
 */
export const activateApp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => activateSchema.parse(d))
  .handler(async ({ data }): Promise<ActivateResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already activated? Refuse — a deployment activates once.
    const { data: settings } = await supabaseAdmin
      .from("store_settings")
      .select("id, activated")
      .eq("singleton", true)
      .maybeSingle();
    if (settings?.activated) {
      return { ok: false, error: "Cette application est déjà activée." };
    }

    // Validate the access key.
    const { data: keyRow } = await supabaseAdmin
      .from("access_keys")
      .select("id, status, expires_at, usage_count, client_id")
      .eq("key_value", data.key.trim())
      .maybeSingle();

    if (!keyRow) return { ok: false, error: "Clé d'accès invalide." };
    if (keyRow.status !== "active") {
      return { ok: false, error: "Cette clé d'accès a été désactivée." };
    }
    if (keyRow.expires_at && new Date(keyRow.expires_at).getTime() < Date.now()) {
      return { ok: false, error: "Cette clé d'accès a expiré." };
    }

    // Link or create the client record (for the owner's admin panel).
    let clientId = keyRow.client_id as string | null;
    if (clientId) {
      await supabaseAdmin
        .from("clients")
        .update({ company_name: data.storeName, status: "active" })
        .eq("id", clientId);
    } else {
      const { data: created } = await supabaseAdmin
        .from("clients")
        .insert({ company_name: data.storeName, status: "active" })
        .select("id")
        .single();
      clientId = created?.id ?? null;
      if (clientId) {
        await supabaseAdmin
          .from("access_keys")
          .update({ client_id: clientId })
          .eq("id", keyRow.id);
      }
    }

    // Provision the default PIN accounts (manager 1234, employee 0000).
    try {
      const { ensureBootstrapAccounts } = await import("./pin-auth.server");
      await ensureBootstrapAccounts();
    } catch {
      // Non-fatal: accounts may already exist.
    }

    // Tag the bootstrap employees with this client.
    if (clientId) {
      await supabaseAdmin
        .from("employees")
        .update({ client_id: clientId })
        .is("client_id", null);
    }

    // Record key usage.
    await supabaseAdmin
      .from("access_keys")
      .update({
        usage_count: (keyRow.usage_count ?? 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", keyRow.id);

    // Mark activated + store the chosen store name.
    const stamp = new Date().toISOString();
    if (settings?.id) {
      await supabaseAdmin
        .from("store_settings")
        .update({
          store_name: data.storeName,
          activated: true,
          activated_at: stamp,
          activation_key: data.key.trim(),
        })
        .eq("id", settings.id);
    } else {
      await supabaseAdmin.from("store_settings").insert({
        singleton: true,
        store_name: data.storeName,
        activated: true,
        activated_at: stamp,
        activation_key: data.key.trim(),
      });
    }

    return { ok: true };
  });
