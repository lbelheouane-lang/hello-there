import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth, type AppRole } from "@/hooks/use-auth";

/** Default landing route for each role after access decisions. */
export function defaultRouteForRole(role: AppRole | null): string {
  return role === "admin" ? "/dashboard" : "/nouvelle-vente";
}

/**
 * Client-side role gate. Renders children only when the current user's role
 * is allowed; otherwise redirects to that role's default interface. This is a
 * UX guard — the database RLS policies are the real security boundary.
 */
export function RequireRole({
  allow,
  children,
}: {
  allow: AppRole[];
  children: ReactNode;
}) {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  const permitted = role != null && allow.includes(role);

  useEffect(() => {
    if (loading) return;
    if (!permitted) {
      navigate({ to: defaultRouteForRole(role), replace: true });
    }
  }, [loading, permitted, role, navigate]);

  if (loading || !permitted) {
    return <div className="min-h-screen bg-background" />;
  }

  return <>{children}</>;
}
