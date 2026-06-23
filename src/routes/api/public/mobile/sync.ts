import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const bodySchema = z.object({
  token: z.string().min(32).max(128),
  deviceId: z.string().trim().min(4).max(128),
});

/**
 * Public sync heartbeat for the mobile companion app. The device proves it is
 * still validly paired (token connected, not revoked/expired, matching
 * device_id) and the server stamps `last_sync`. It returns the store identity
 * the device is bound to so the app can enforce `WHERE store_id = current` on
 * its side. Actual data reads happen through the authenticated app session, so
 * RLS + user permissions still apply — this endpoint never returns store data.
 */
export const Route = createFileRoute("/api/public/mobile/sync")({
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
          .select("id, status, expires_at, device_id, store_id, store_name, license_id")
          .eq("token", parsed.token)
          .eq("device_id", parsed.deviceId)
          .maybeSingle();

        if (!row || row.status !== "connected") {
          return Response.json({ ok: false, error: "Appairage invalide." }, { status: 403 });
        }

        const now = new Date().toISOString();
        await supabaseAdmin
          .from("mobile_pairings")
          .update({ last_sync: now })
          .eq("id", row.id);

        return Response.json({
          ok: true,
          lastSync: now,
          storeId: row.store_id,
          storeName: row.store_name,
          licenseId: row.license_id,
        });
      },
    },
  },
});
