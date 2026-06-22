/** Local (device) activation state for the License Management system. */

const STORAGE_KEY = "maisondor.license_activation";

/**
 * Hidden system-level developer override. The single account matching this
 * email bypasses activation, licensing and the normal store-isolation flow,
 * and is granted full access to every module including License Management.
 * This applies ONLY to this exact email — no other user can obtain it.
 */
export const DEVELOPER_EMAIL = "belheouanelotfi@gmail.com";

export function isDeveloperEmail(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === DEVELOPER_EMAIL;
}

export interface LocalActivation {
  license_id: string;
  license_key: string;
  store_name: string;
  activated_at: string;
}

export function getLocalActivation(): LocalActivation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalActivation;
    if (!parsed?.license_key) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setLocalActivation(a: LocalActivation): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(a));
}

export function clearLocalActivation(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
