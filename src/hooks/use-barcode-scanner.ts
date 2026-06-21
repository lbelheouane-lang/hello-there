import { useEffect, useRef } from "react";

/**
 * Listen for input from a USB barcode scanner operating in keyboard-wedge mode.
 *
 * Such scanners "type" the code very quickly and finish with an Enter key.
 * We buffer characters that arrive in rapid succession and, on Enter, emit the
 * collected string. Slow human typing is ignored (gap between keys resets the
 * buffer), so this does not interfere with manual data entry in other fields.
 */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true) {
  const bufferRef = useRef("");
  const lastTimeRef = useRef(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled) return;

    const GAP_MS = 50; // max delay between scanner keystrokes
    const MIN_LEN = 3; // ignore stray single keys

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      const now = Date.now();
      const gap = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current;
        bufferRef.current = "";
        if (code.length >= MIN_LEN) {
          // Only treat as a scan when keys arrived fast (scanner, not typing).
          onScanRef.current(code);
          if (!isEditable) e.preventDefault();
        }
        return;
      }

      if (e.key.length === 1) {
        if (gap > GAP_MS) bufferRef.current = "";
        bufferRef.current += e.key;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled]);
}
