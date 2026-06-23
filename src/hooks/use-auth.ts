import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { ALL_PERMISSIONS, type PermissionKey } from "@/lib/permissions";

export type AppRole = "admin" | "employe" | "developer" | "client";

export interface AuthState {
  user: User | null;
  role: AppRole | null;
  permissions: PermissionKey[];
  isDeveloper: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [isDeveloper, setIsDeveloper] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProfile(uid: string) {


      const [{ data: roleRows }, { data: emp }, { data: prof }] = await Promise.all([
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
        supabase
          .from("profiles")
          .select("disabled")
          .eq("id", uid)
          .maybeSingle(),
      ]);
      if (!active) return;

      // Suspended accounts are signed out immediately.
      if ((prof && prof.disabled === true) || (emp && emp.is_active === false)) {
        await supabase.auth.signOut();
        return;
      }

      const roles = (roleRows ?? []).map((r) => String(r.role));
      const dev = roles.includes("developer");
      setIsDeveloper(dev);
      setIsSuperAdmin(roles.includes("super_admin"));
      const nonDev = roles.filter(
        (r) => r !== "developer" && r !== "super_admin",
      ) as AppRole[];
      const resolvedRole: AppRole | null = nonDev.includes("admin")
        ? "admin"
        : nonDev[0] ?? (roles.includes("super_admin") ? "admin" : dev ? "developer" : null);
      setRole(resolvedRole);

      if (resolvedRole === "admin") {
        setPermissions(ALL_PERMISSIONS);
      } else {
        setPermissions((emp?.permissions ?? []) as PermissionKey[]);
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
        setIsSuperAdmin(false);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, role, permissions, isDeveloper, isSuperAdmin, loading };
}
