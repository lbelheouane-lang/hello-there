import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConnectedDevice {
  id: string;
  device_id: string | null;
  device_name: string | null;
  device_user_agent: string | null;
  status: string;
  paired_at: string | null;
  last_sync: string | null;
  created_at: string;
}

export interface PairingState {
  /** All currently connected devices for this store. */
  devices: ConnectedDevice[];
  /** True when at least one device is connected. */
  connected: boolean;
  /** The live pending QR (if any) waiting to be scanned. */
  pending: {
    id: string;
    expires_at: string;
    qrPayload: string;
  } | null;
}

// ---------------------------------------------------------------------------
// Guard
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Accès réservé aux administrateurs.");
}

function secureToken(): string {
  // 32 bytes of cryptographically-strong randomness, URL-safe hex.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function buildPayload(row: {
  token: string;
  store_id: string | null;
  store_name: string | null;
  license_id: string | null;
  expires_at: string;
}): string {
  return JSON.stringify({
    v: 1,
    storeId: row.store_id,
    storeName: row.store_name,
    licenseId: row.license_id,
    token: row.token,
    expiresAt: row.expires_at,
  });
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export const getPairingState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PairingState> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Lazily expire stale pending tokens.
    await supabaseAdmin
      .from("mobile_pairings")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const [{ data: devicesRaw }, { data: pendingRaw }] = await Promise.all([
      supabaseAdmin
        .from("mobile_pairings")
        .select("*")
        .eq("status", "connected")
        .order("paired_at", { ascending: false }),
      supabaseAdmin
        .from("mobile_pairings")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const devices: ConnectedDevice[] = (devicesRaw ?? []).map((d) => ({
      id: d.id,
      device_id: d.device_id,
      device_name: d.device_name,
      device_user_agent: d.device_user_agent,
      status: d.status,
      paired_at: d.paired_at,
      last_sync: d.last_sync,
      created_at: d.created_at,
    }));

    return {
      devices,
      connected: devices.length > 0,
      pending: pendingRaw
        ? { id: pendingRaw.id, expires_at: pendingRaw.expires_at, qrPayload: buildPayload(pendingRaw) }
        : null,
    };
  });

// ---------------------------------------------------------------------------
// Generate QR / pairing token
// ---------------------------------------------------------------------------

const generateSchema = z.object({
  expiresInMinutes: z.number().int().min(1).max(1440).default(15),
});

export const generatePairing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => generateSchema.parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true; qrPayload: string }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: store } = await supabaseAdmin
      .from("store_settings")
      .select("id, store_name")
      .eq("singleton", true)
      .maybeSingle();

    // Only one QR is ever live — invalidate previous pending tokens.
    // Connected devices are NOT affected.
    await supabaseAdmin
      .from("mobile_pairings")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .eq("status", "pending");

    const token = secureToken();
    const expires_at = new Date(Date.now() + data.expiresInMinutes * 60_000).toISOString();

    const { data: inserted, error } = await supabaseAdmin
      .from("mobile_pairings")
      .insert({
        token,
        store_id: store?.id ?? null,
        store_name: store?.store_name ?? null,
        license_id: store?.id ?? null,
        status: "pending",
        expires_at,
        created_by: context.userId,
      })
      .select("token, store_id, store_name, license_id, expires_at")
      .single();
    if (error || !inserted) throw new Error("Génération du QR impossible.");

    return { ok: true, qrPayload: buildPayload(inserted) };
  });

// ---------------------------------------------------------------------------
// Revoke / disconnect a device (or the pending token)
// ---------------------------------------------------------------------------

export const revokeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const update = { status: "revoked", revoked_at: new Date().toISOString() };
    if (data.id) {
      await supabaseAdmin.from("mobile_pairings").update(update).eq("id", data.id);
    } else {
      // No id → revoke everything currently active (pending + connected).
      await supabaseAdmin
        .from("mobile_pairings")
        .update(update)
        .in("status", ["pending", "connected"]);
    }
    return { ok: true };
  });
