import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(32).max(128),
  deviceName: z.string().trim().max(120).optional(),
});

/**
 * Public pairing-confirmation endpoint called by the mobile companion app once
 * it has scanned the QR code. It validates the secure pairing token (not
 * expired, not revoked, still pending) and binds the device to the store that
 * generated it. A mobile app can therefore only ever reach the store whose QR
 * it scanned — the token carries no other store's identity.
 */
export const Route = createFileRoute("/api/public/mobile/pair")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let parsed: z.infer<typeof bodySchema>;
        try {
          parsed = bodySchema.parse(await request.json());
        } catch {
          return Response.json({ ok: false, error: "Requête invalide." }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: row } = await supabaseAdmin
          .from("mobile_pairings")
          .select("*")
          .eq("token", parsed.token)
          .maybeSingle();

        if (!row) {
          return Response.json({ ok: false, error: "Jeton inconnu." }, { status: 404 });
        }
        if (row.status === "revoked") {
          return Response.json({ ok: false, error: "Jeton révoqué." }, { status: 410 });
        }
        if (row.status === "expired" || new Date(row.expires_at).getTime() < Date.now()) {
          await supabaseAdmin
            .from("mobile_pairings")
            .update({ status: "expired" })
            .eq("id", row.id);
          return Response.json({ ok: false, error: "Jeton expiré." }, { status: 410 });
        }
        if (row.status === "connected") {
          return Response.json({ ok: false, error: "Déjà appairé." }, { status: 409 });
        }

        const userAgent = request.headers.get("user-agent") ?? null;
        await supabaseAdmin
          .from("mobile_pairings")
          .update({
            status: "connected",
            paired_at: new Date().toISOString(),
            device_name: parsed.deviceName ?? "Appareil mobile",
            device_user_agent: userAgent,
          })
          .eq("id", row.id);

        // Only the store identity is returned — never another store's data.
        return Response.json({
          ok: true,
          storeId: row.store_id,
          storeName: row.store_name,
        });
      },
    },
  },
});
