import { useEffect } from "react";
import { useUserPreferences, applyPreferences, DEFAULT_PREFERENCES } from "@/lib/user-preferences";

/**
 * Loads the signed-in administrator's interface preferences and applies them
 * to the document (theme, color mode, custom colors, density). Renders nothing.
 * Preferences are restored automatically on login because they are fetched
 * from the database. New users fall back to the system default theme.
 */
export function ThemeManager() {
  const { data } = useUserPreferences();

  useEffect(() => {
    applyPreferences(data ?? DEFAULT_PREFERENCES);
  }, [data]);

  return null;
}
