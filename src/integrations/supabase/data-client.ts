// Demo-aware Supabase data client.
//
// In normal (authenticated) usage this proxy forwards every call to the real
// browser client (`./client`), so production behaviour is unchanged. When the
// public showroom demo is active (`window.__ORUS_DEMO__ === true`) it forwards
// to a session-less anonymous client instead. Anonymous reads are constrained
// by RLS to demo rows only (`is_demo = true`) and no write policies exist for
// the anon role, so the demo can never read or modify production data.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase as authedClient } from "./client";

const DEMO_FLAG = "__ORUS_DEMO__";

export function isDemoActive(): boolean {
  return (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>)[DEMO_FLAG] === true
  );
}

export function setDemoActive(active: boolean): void {
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>)[DEMO_FLAG] = active;
  }
}

let _demo: ReturnType<typeof createClient<Database>> | undefined;

function demoClient() {
  if (!_demo) {
    const url =
      import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const key =
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY;
    _demo = createClient<Database>(url!, key!, {
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return _demo;
}

// Drop-in replacement for the browser client. Same name (`supabase`) so files
// only need to change the import path, not the usage.
export const supabase = new Proxy(
  {} as ReturnType<typeof createClient<Database>>,
  {
    get(_, prop, receiver) {
      const target = isDemoActive() ? demoClient() : authedClient;
      return Reflect.get(target, prop, receiver);
    },
  },
);
