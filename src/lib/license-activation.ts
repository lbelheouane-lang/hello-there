/** Local (device) activation state for the License Management system. */

const STORAGE_KEY = "maisondor.license_activation";

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
