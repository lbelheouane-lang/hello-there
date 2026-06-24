/**
 * Shared camera/permission helpers used by the QR scanner and any future
 * photo-capture features. Centralises secure-context checks, permission
 * detection and human-readable (French) error messages so every camera
 * surface behaves consistently across Android, iPhone and desktop.
 */

export type CameraPermission =
  | "granted"
  | "denied"
  | "prompt"
  | "unknown";

export interface CameraSupport {
  /** Page is served over HTTPS, localhost or an installed PWA. */
  secure: boolean;
  /** The browser exposes the getUserMedia API. */
  hasApi: boolean;
}

/** Returns whether the current context can legally use the camera. */
export function getCameraSupport(): CameraSupport {
  const secure =
    typeof window !== "undefined" &&
    (window.isSecureContext ||
      location.hostname === "localhost" ||
      location.hostname === "127.0.0.1");
  const hasApi =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  return { secure, hasApi };
}

/** Best-effort camera permission state (Safari often returns "unknown"). */
export async function queryCameraPermission(): Promise<CameraPermission> {
  try {
    const perms = (navigator as Navigator & {
      permissions?: {
        query: (d: { name: PermissionName }) => Promise<PermissionStatus>;
      };
    }).permissions;
    if (!perms?.query) return "unknown";
    const status = await perms.query({ name: "camera" as PermissionName });
    return (status.state as CameraPermission) ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Maps a getUserMedia / scanner error to a clear French message. */
export function cameraErrorMessage(err: unknown): string {
  const support = getCameraSupport();
  if (!support.secure) {
    return "Connexion sécurisée requise. La caméra ne fonctionne qu'en HTTPS, sur localhost ou dans l'application installée.";
  }
  if (!support.hasApi) {
    return "Ce navigateur ne prend pas en charge l'accès à la caméra. Importez une image depuis la galerie.";
  }
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur puis réessayez.";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "Aucune caméra détectée sur cet appareil.";
    case "NotReadableError":
    case "TrackStartError":
      return "La caméra est déjà utilisée par une autre application.";
    default:
      return "Impossible d'accéder à la caméra. Vérifiez les autorisations du navigateur ou importez une image.";
  }
}
