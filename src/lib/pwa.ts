// PWA service-worker cleanup with Lovable-preview safety guards.
// The previous worker could keep serving stale broken builds on phones/PCs.
// Keep this cleanup active so every device loads the latest published app from network.

const SW_URL = "/sw.js";

function isRefusedContext(): boolean {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;

  // Inside an iframe (Lovable preview embeds the app in an iframe).
  try {
    if (window.self !== window.top) return true;
  } catch {
    return true;
  }

  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;

  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;

  return false;
}

async function unregisterAppWorker() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.allSettled(
    regs.map((r) => r.unregister()),
  );
}

async function clearAppCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.allSettled(
    keys
      .filter((key) => key.includes("orus") || key.includes("workbox") || key.includes("precache"))
      .map((key) => caches.delete(key)),
  );
}

async function resetPwaState() {
  await unregisterAppWorker();
  await clearAppCaches();
}

export function registerPwa() {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

  void isRefusedContext();
  window.addEventListener("load", () => void resetPwaState(), { once: true });
}
