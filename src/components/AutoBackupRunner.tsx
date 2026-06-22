import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useStoreSettings } from "@/lib/store-settings";
import { supabase } from "@/integrations/supabase/client";
import {
  createBackup, uploadBackup, recordBackupHistory, isAutoBackupDue,
} from "@/lib/backup";

// Ensures a single automatic-backup attempt per browser session.
let attemptedThisSession = false;

/**
 * Runs an automatic backup in the background when an administrator is signed in,
 * automatic backups are enabled, and one is due per the configured frequency.
 * The archive is stored online and recorded in history (no forced download).
 * Renders nothing.
 */
export function AutoBackupRunner() {
  const { user, role } = useAuth();
  const { data: settings } = useStoreSettings();

  useEffect(() => {
    if (attemptedThisSession) return;
    if (role !== "admin" || !user || !settings) return;
    if (!settings.auto_backup_enabled) return;
    if (!isAutoBackupDue(settings.auto_backup_frequency, settings.last_auto_backup_at)) return;

    attemptedThisSession = true;
    (async () => {
      try {
        const backup = await createBackup(settings.store_name, user.email ?? null);
        let storagePath: string | null = null;
        try {
          storagePath = await uploadBackup(backup.blob, backup.fileName, user.id);
        } catch {
          storagePath = null;
        }
        await recordBackupHistory(backup, "auto", user.id, user.email ?? null, storagePath);
        await supabase
          .from("store_settings")
          .update({ last_auto_backup_at: new Date().toISOString() } as never)
          .eq("singleton", true);
      } catch {
        // Silent: automatic backups must never disrupt the user's session.
        attemptedThisSession = false;
      }
    })();
  }, [user, role, settings]);

  return null;
}
