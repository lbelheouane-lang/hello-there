import { createFileRoute } from "@tanstack/react-router";

/**
 * Endpoint déclenché par pg_cron (toutes les minutes) pour mettre à jour le
 * cours de l'or. Protégé par la clé publique Supabase (header apikey).
 */
export const Route = createFileRoute("/api/public/hooks/update-gold-prices")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (!apikey || apikey !== process.env.SUPABASE_PUBLISHABLE_KEY) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          const { runGoldPriceUpdate } = await import("@/lib/gold-price-provider.server");
          const result = await runGoldPriceUpdate();
          return new Response(JSON.stringify(result), {
            status: result.ok ? 200 : 502,
            headers: { "content-type": "application/json" },
          });
        } catch (err) {
          console.error("[update-gold-prices]", err);
          return new Response(
            JSON.stringify({ ok: false, error: (err as Error).message }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
