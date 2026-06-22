import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

/**
 * Backup & Restore utilities.
 *
 * A backup is a `.zip` archive containing:
 *  - `data.json`     — a full snapshot of every application table (via the
 *                      secure `backup_all` database function, admin-only).
 *  - `manifest.json` — metadata describing the backup (version, store, counts).
 *
 * Restore reads such an archive, validates it, and replaces all current data
 * through the secure `restore_backup` database function (admin-only). The
 * database function temporarily disables triggers so derived rows (invoices,
 * purchases, history, audit logs) are restored exactly as saved.
 */

export const BACKUP_VERSION = 1;

export interface BackupManifest {
  version: number;
  app: string;
  store_name: string;
  created_at: string;
  created_by_name: string | null;
  record_counts: Record<string, number>;
}

export interface CreatedBackup {
  blob: Blob;
  fileName: string;
  sizeBytes: number;
  recordCounts: Record<string, number>;
  manifest: BackupManifest;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Sanitises a store name for safe use in a file name. */
function slug(name: string): string {
  return (name || "Boutique")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "Boutique";
}

/** Builds the backup filename: StoreName_Backup_YYYY-MM-DD_HH-MM.zip */
export function backupFileName(storeName: string, date = new Date()): string {
  const stamp =
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `_${pad(date.getHours())}-${pad(date.getMinutes())}`;
  return `${slug(storeName)}_Backup_${stamp}.zip`;
}

function countRecords(data: Record<string, unknown[]>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [table, rows] of Object.entries(data)) {
    counts[table] = Array.isArray(rows) ? rows.length : 0;
  }
  return counts;
}

/**
 * Creates a full backup archive in memory. Does NOT trigger a download or
 * record history — callers decide what to do with the result.
 */
export async function createBackup(
  storeName: string,
  createdByName: string | null,
): Promise<CreatedBackup> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("backup_all");
  if (error) throw new Error(error.message);

  const snapshot = (data ?? {}) as Record<string, unknown[]>;
  const recordCounts = countRecords(snapshot);

  const manifest: BackupManifest = {
    version: BACKUP_VERSION,
    app: "maison-dor",
    store_name: storeName,
    created_at: new Date().toISOString(),
    created_by_name: createdByName,
    record_counts: recordCounts,
  };

  const zip = new JSZip();
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("data.json", JSON.stringify(snapshot));
  const blob = await zip.generateAsync({
    type: "blob",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    fileName: backupFileName(storeName),
    sizeBytes: blob.size,
    recordCounts,
    manifest,
  };
}

/** Records a backup in the history table. */
export async function recordBackupHistory(
  backup: CreatedBackup,
  kind: "manual" | "auto",
  userId: string | null,
  userName: string | null,
): Promise<void> {
  const { error } = await supabase.from("backups").insert({
    file_name: backup.fileName,
    store_name: backup.manifest.store_name,
    size_bytes: backup.sizeBytes,
    record_counts: backup.recordCounts,
    kind,
    created_by: userId,
    created_by_name: userName,
  } as never);
  if (error) throw new Error(error.message);
}

/** Triggers a browser download for a generated backup blob. */
export function downloadBackup(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface ParsedBackup {
  manifest: BackupManifest | null;
  data: Record<string, unknown[]>;
}

/** Reads and validates a `.zip` backup file selected by the user. */
export async function parseBackupFile(file: File): Promise<ParsedBackup> {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    throw new Error("Le fichier doit être une archive .zip.");
  }
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("Archive illisible ou corrompue.");
  }

  const dataEntry = zip.file("data.json");
  if (!dataEntry) {
    throw new Error("Sauvegarde invalide : « data.json » introuvable.");
  }

  let data: Record<string, unknown[]>;
  try {
    data = JSON.parse(await dataEntry.async("string"));
  } catch {
    throw new Error("Sauvegarde invalide : données illisibles.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Sauvegarde invalide : format inattendu.");
  }

  let manifest: BackupManifest | null = null;
  const manifestEntry = zip.file("manifest.json");
  if (manifestEntry) {
    try {
      manifest = JSON.parse(await manifestEntry.async("string"));
    } catch {
      manifest = null;
    }
  }

  return { manifest, data };
}

/** Restores all data from a parsed backup via the secure database function. */
export async function restoreBackup(data: Record<string, unknown[]>): Promise<Record<string, number>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: result, error } = await (supabase.rpc as any)("restore_backup", { payload: data });
  if (error) throw new Error(error.message);
  return (result ?? {}) as Record<string, number>;
}

/** Human-readable file size. */
export function formatBytes(bytes: number): string {
  if (!bytes) return "0 o";
  const units = ["o", "Ko", "Mo", "Go"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Determines whether an automatic backup is due based on frequency/time. */
export function isAutoBackupDue(
  frequency: string,
  lastAt: string | null,
  now = new Date(),
): boolean {
  if (!lastAt) return true;
  const last = new Date(lastAt);
  const diffMs = now.getTime() - last.getTime();
  const day = 24 * 60 * 60 * 1000;
  switch (frequency) {
    case "daily":
      return diffMs >= day;
    case "monthly":
      return diffMs >= 30 * day;
    case "weekly":
    default:
      return diffMs >= 7 * day;
  }
}
