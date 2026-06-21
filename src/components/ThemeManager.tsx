import { useEffect } from "react";
import { useUserPreferences, applyPreferences, DEFAULT_PREFERENCES } from "@/lib/user-preferences";
import { useStoreSettings } from "@/lib/store-settings";

/**
 * Loads the signed-in administrator's interface preferences and applies them
 * to the document (theme, color mode, custom colors, density). Renders nothing.
 * Preferences are restored automatically on login because they are fetched
 * from the database. New users fall back to the system default theme.
 */
export function ThemeManager() {
  const { data } = useUserPreferences();
  const { data: settings } = useStoreSettings();

  useEffect(() => {
    applyPreferences(data ?? DEFAULT_PREFERENCES);
  }, [data]);

  // Apply a custom favicon when one is configured.
  useEffect(() => {
    const href = settings?.favicon_url;
    if (!href || typeof document === "undefined") return;
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    link.href = href;
  }, [settings?.favicon_url]);

  return null;
}
