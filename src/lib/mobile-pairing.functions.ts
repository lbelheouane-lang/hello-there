import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PairingState {
  /** Whether a device is currently connected. */
  connected: boolean;
  status: "none" | "pending" | "connected";
  /** The active (pending or connected) pairing record, if any. */
  pairing: {
    id: string;
    status: string;
    expires_at: string;
    device_name: string | null;
    device_user_agent: string | null;
    paired_at: string | null;
    created_at: string;
    /** Secure payload to encode in the QR — only present while pending. */
    qrPayload: string | null;
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
  // 32 bytes of cryptographically-strong randomness, URL-safe.
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

    // Expire any stale pending tokens lazily.
    await supabaseAdmin
      .from("mobile_pairings")
      .update({ status: "expired" })
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());

    const { data } = await supabaseAdmin
      .from("mobile_pairings")
      .select("*")
      .in("status", ["pending", "connected"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) return { connected: false, status: "none", pairing: null };

    return {
      connected: data.status === "connected",
      status: data.status as "pending" | "connected",
      pairing: {
        id: data.id,
        status: data.status,
        expires_at: data.expires_at,
        device_name: data.device_name,
        device_user_agent: data.device_user_agent,
        paired_at: data.paired_at,
        created_at: data.created_at,
        qrPayload: data.status === "pending" ? buildPayload(data) : null,
      },
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

    // Read the single store profile for identity stamping.
    const { data: store } = await supabaseAdmin
      .from("store_settings")
      .select("id, store_name")
      .eq("singleton", true)
      .maybeSingle();

    // Invalidate any previous still-pending tokens so only one QR is ever live.
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
// Revoke connected device / pending token
// ---------------------------------------------------------------------------

export const revokeDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("mobile_pairings")
      .update({ status: "revoked", revoked_at: new Date().toISOString() })
      .in("status", ["pending", "connected"]);
    return { ok: true };
  });
