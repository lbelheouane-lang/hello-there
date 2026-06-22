import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export type AppRole = "admin" | "employe" | "developer";

export interface AuthState {
  user: User | null;
  role: AppRole | null;
  permissions: PermissionKey[];
  isDeveloper: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile(uid: string) {


      const [{ data: roleRows }, { data: emp }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", uid)
          .order("role", { ascending: true }),
        supabase
          .from("employees")
          .select("permissions, is_active")
          .eq("user_id", uid)
          .maybeSingle(),
      ]);
      if (!active) return;

      const roles = (roleRows ?? []).map((r) => r.role as AppRole);
      const dev = roles.includes("developer");
      setIsDeveloper(dev);
      const nonDev = roles.filter((r) => r !== "developer");
      const resolvedRole = nonDev.includes("admin")
        ? "admin"
        : nonDev[0] ?? (dev ? "developer" : null);
      setRole(resolvedRole);

      if (resolvedRole === "admin") {
        setPermissions(ALL_PERMISSIONS);
      } else {
        setPermissions((emp?.permissions ?? []) as PermissionKey[]);
      }

      // Deactivated employees are signed out immediately.
      if (emp && emp.is_active === false) {
        await supabase.auth.signOut();
      }
    }

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user ?? null);
      if (data.user) loadProfile(data.user.id).finally(() => active && setLoading(false));
      else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setUser(session?.user ?? null);
      if (session?.user) loadProfile(session.user.id);
      else {
        setRole(null);
        setPermissions([]);
        setIsDeveloper(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, role, permissions, isDeveloper, loading };
}
