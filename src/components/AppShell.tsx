import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  Gem,
  LayoutDashboard,
  Package,
  Truck,
  Coins,
  LogOut,
  ShoppingCart,
  Users,
  Settings,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandIntro } from "@/components/BrandIntro";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import { RequireRole } from "@/components/RequireRole";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  SidebarInset,
} from "@/components/ui/sidebar";

const NAV: readonly {
  to: string;
  label: string;
  icon: typeof Gem;
  roles: readonly AppRole[];
}[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin"] },
  { to: "/nouvelle-vente", label: "Nouvelle vente", icon: ShoppingCart, roles: ["admin", "employe"] },
  { to: "/clients", label: "Clients", icon: Users, roles: ["admin", "employe"] },
  { to: "/stock", label: "Stock", icon: Package, roles: ["admin"] },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck, roles: ["admin"] },
  { to: "/cours-or", label: "Cours de l'or", icon: Coins, roles: ["admin"] },
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["admin"] },
];

function AppSidebar() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Gem className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-serif text-lg font-semibold">Maison d'Or</p>
            <p className="text-xs text-sidebar-foreground/60">Gestion bijouterie</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.filter((item) => role != null && item.roles.includes(role)).map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild isActive={pathname === item.to}>
                    <Link to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="px-2 py-2">
          <p className="truncate text-sm font-medium">{user?.email}</p>
          <p className="text-xs capitalize text-sidebar-foreground/60">
            {role === "admin" ? "Administrateur" : "Employé"}
          </p>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Déconnexion
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppShell({
  title,
  children,
  allow,
}: {
  title: string;
  children: ReactNode;
  allow?: AppRole[];
}) {
  const inner = (
    <SidebarProvider>
      <BrandIntro />
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <h1 className="font-serif text-xl font-semibold">{title}</h1>
        </header>
        <main
          className="flex-1 p-4 md:p-6"
          style={{ animation: "brand-content-in 0.6s ease-out both" }}
        >
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );

  if (allow) {
    return <RequireRole allow={allow}>{inner}</RequireRole>;
  }
  return inner;
}
