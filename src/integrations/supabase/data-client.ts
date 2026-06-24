// Demo-aware Supabase data client.
//
// In normal (authenticated) usage this proxy forwards every call to the real
// browser client (`./client`), so production behaviour is unchanged. When the
// public showroom demo is active (`window.__ORUS_DEMO__ === true`) it forwards
// to a session-less anonymous client instead, wrapped so that every write is
// neutralised. Anonymous reads are constrained by RLS to demo rows only
// (`is_demo = true`) and no write policies exist for the anon role, so the demo
// can never read or modify production data.
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";
import { supabase as authedClient } from "./client";

const DEMO_FLAG = "__ORUS_DEMO__";

export const DEMO_READONLY_MESSAGE =
  "Mode démonstration : action désactivée (lecture seule).";

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

// A chainable, awaitable stand-in that always resolves to a read-only error,
// so existing `const { error } = await supabase.from(...).insert(...)` code
// paths surface a friendly message instead of mutating anything.
function blockedResult(): unknown {
  const result = { data: null, error: { message: DEMO_READONLY_MESSAGE } };
  const base: Record<string, unknown> = {
    then: (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
    catch: (onRejected: (v: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    finally: (cb: () => void) => Promise.resolve(result).finally(cb),
  };
  const self: unknown = new Proxy(base, {
    get(target, prop) {
      if (prop in target) return target[prop as string];
      // Any chained builder method (.select, .eq, .single, ...) returns self.
      return () => self;
    },
  });
  return self;
}

const WRITE_METHODS = new Set(["insert", "update", "upsert", "delete"]);

let _demo: ReturnType<typeof createClient<Database>> | undefined;

function rawDemoClient() {
  if (!_demo) {
    const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
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

// `blockedResult` references `proxy` lazily; defined here so the closure binds.
let proxy: unknown;
proxy = blockedResult();

function readOnlyDemoClient() {
  const client = rawDemoClient();
  return new Proxy(client, {
    get(target, prop, receiver) {
      const anyTarget = target as unknown as Record<string, unknown>;
      if (prop === "from") {
        return (table: string) => {
          const builder = (anyTarget.from as (t: string) => unknown)(
            table,
          ) as Record<string, unknown>;
          return new Proxy(builder, {
            get(b, p) {
              if (typeof p === "string" && WRITE_METHODS.has(p)) {
                return () => blockedResult();
              }
              const v = (b as Record<string, unknown>)[p as string];
              return typeof v === "function" ? v.bind(b) : v;
            },
          });
        };
      }
      if (prop === "storage") {
        const storage = anyTarget.storage as Record<string, unknown>;
        return new Proxy(storage, {
          get(s, p) {
            if (p === "from") {
              return () =>
                new Proxy(
                  {},
                  {
                    get() {
                      return () => blockedResult();
                    },
                  },
                );
            }
            const v = (s as Record<string, unknown>)[p as string];
            return typeof v === "function" ? v.bind(s) : v;
          },
        });
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

let _readOnly: ReturnType<typeof readOnlyDemoClient> | undefined;

// Drop-in replacement for the browser client. Same export name (`supabase`) so
// files only need to change the import path, not their usage.
export const supabase = new Proxy(
  {} as ReturnType<typeof createClient<Database>>,
  {
    get(_, prop, receiver) {
      if (isDemoActive()) {
        if (!_readOnly) _readOnly = readOnlyDemoClient();
        return Reflect.get(_readOnly, prop, receiver);
      }
      return Reflect.get(authedClient, prop, receiver);
    },
  },
);
