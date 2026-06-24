import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
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
  FileText,
  Wallet2,
  Store,
  Wrench,
  Layers,
  Recycle,
  BookOpen,
  Repeat,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandIntro } from "@/components/BrandIntro";
import { useAuth, type AppRole } from "@/hooks/use-auth";
import type { PermissionKey } from "@/lib/permissions";
import { useStoreSettings } from "@/lib/store-settings";
import { useUserPreferences } from "@/lib/user-preferences";
import { RequireRole } from "@/components/RequireRole";
import { AutoBackupRunner } from "@/components/AutoBackupRunner";
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
import { useDemoMode } from "@/lib/demo/demo-context";
import { DemoBanner } from "@/components/demo/DemoBanner";
import { DemoFooter } from "@/components/demo/DemoFooter";

/** Navigation shown in the public showroom (read-only modules only). */
const DEMO_NAV: readonly { to: string; label: string; icon: typeof Gem }[] = [
  { to: "/demo/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/demo/stock", label: "Stock", icon: Package },
  { to: "/demo/parures", label: "Parures", icon: Layers },
  { to: "/demo/or-casse", label: "Or Cassé", icon: Recycle },
  { to: "/demo/clients", label: "Clients", icon: Users },
  { to: "/demo/fournisseurs", label: "Fournisseurs", icon: Truck },
  { to: "/demo/factures", label: "Ventes & Factures", icon: FileText },
  { to: "/demo/paiements-en-attente", label: "Paiements en attente", icon: Wallet },
  { to: "/demo/depenses", label: "Dépenses", icon: Wallet2 },
  { to: "/demo/reparations", label: "Réparations", icon: Wrench },
  { to: "/demo/journal-quotidien", label: "Journal Quotidien", icon: BookOpen },
  { to: "/demo/cours-or", label: "Cours de l'or", icon: Coins },
];

function DemoSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Gem className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="font-serif text-lg font-semibold">ORUS DZ</p>
            <p className="text-xs text-sidebar-foreground/60">Démonstration</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DEMO_NAV.map((item) => (
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
          <p className="truncate text-sm font-medium">Visiteur</p>
          <p className="text-xs text-sidebar-foreground/60">Mode démonstration</p>
        </div>
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent"
          asChild
        >
          <Link to="/demo">
            <LogOut className="h-4 w-4" /> Quitter la démo
          </Link>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}



const NAV: readonly {
  to: string;
  label: string;
  icon: typeof Gem;
  roles: readonly AppRole[];
  perm?: PermissionKey;
  developerOnly?: boolean;
}[] = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin"], perm: "dashboard" },
  { to: "/nouvelle-vente", label: "Nouvelle vente", icon: ShoppingCart, roles: ["admin", "employe"], perm: "sales" },
  { to: "/clients", label: "Clients", icon: Users, roles: ["admin", "employe"], perm: "customers" },
  { to: "/paiements-en-attente", label: "Paiements en attente", icon: Wallet, roles: ["admin", "employe"], perm: "sales" },
  { to: "/factures", label: "Ventes", icon: FileText, roles: ["admin", "employe"], perm: "invoices" },
  { to: "/reparations", label: "Réparations", icon: Wrench, roles: ["admin", "employe"] },
  { to: "/stock", label: "Stock", icon: Package, roles: ["admin"], perm: "inventory" },
  { to: "/parures", label: "Parures", icon: Layers, roles: ["admin"], perm: "jewelry_sets" },
  { to: "/or-casse", label: "Or Cassé", icon: Recycle, roles: ["admin"], perm: "scrap_gold" },
  { to: "/fournisseurs", label: "Fournisseurs", icon: Truck, roles: ["admin"], perm: "suppliers" },
  { to: "/depenses", label: "Dépenses", icon: Wallet2, roles: ["admin"], perm: "reports" },
  { to: "/journal-quotidien", label: "Journal Quotidien", icon: BookOpen, roles: ["admin", "employe"], perm: "reports" },
  { to: "/cours-or", label: "Cours de l'or", icon: Coins, roles: ["admin"] },
  { to: "/boutique", label: "Boutique", icon: Store, roles: ["admin"], perm: "settings" },
  { to: "/parametres", label: "Paramètres", icon: Settings, roles: ["admin"], perm: "settings" },
];

/** A nav item is visible when the role allows it and (admin, no permission gate,
 *  or the employee has been granted that permission). Developer-only items are
 *  shown solely to users holding the developer role. */
function canAccess(
  item: { roles: readonly AppRole[]; perm?: PermissionKey; developerOnly?: boolean },
  role: AppRole | null,
  permissions: PermissionKey[],
  isDeveloper: boolean,
): boolean {
  if (item.developerOnly) return isDeveloper;
  if (role == null || !item.roles.includes(role)) return false;
  if (role === "admin" || !item.perm) return true;
  return permissions.includes(item.perm);
}

function AppSidebar() {
  const navigate = useNavigate();
  const { user, role, permissions, isDeveloper } = useAuth();
  const { data: settings } = useStoreSettings();
  const { data: prefs } = useUserPreferences();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const storeName = settings?.store_name || "Maison d'Or";
  const storeTag = settings?.slogan || settings?.tagline || "Gestion bijouterie";

  const orderedNav = (() => {
    const items = NAV.filter((item) => canAccess(item, role, permissions, isDeveloper));
    const order = prefs?.menu_order;
    if (!order || order.length === 0) return items;
    return [...items].sort(
      (a, b) =>
        (order.indexOf(a.to) === -1 ? 999 : order.indexOf(a.to)) -
        (order.indexOf(b.to) === -1 ? 999 : order.indexOf(b.to)),
    );
  })();

  async function signOut() {
    sessionStorage.removeItem("md_pin_done");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function switchRole() {
    // Keep the email/password session, re-show the PIN gate so the operator
    // can pick a different role (admin / employé) on the same device.
    sessionStorage.removeItem("md_pin_done");
    navigate({ to: "/acces", replace: true });
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            {settings?.logo_url ? (
              <img src={settings.logo_url} alt={storeName} className="h-full w-full object-contain" />
            ) : (
              <Gem className="h-5 w-5" />
            )}
          </div>
          <div className="leading-tight">
            <p className="font-serif text-lg font-semibold">{storeName}</p>
            <p className="text-xs text-sidebar-foreground/60">{storeTag}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {orderedNav.map((item) => (
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
            {role === "admin" ? "Administrateur" : role === "developer" ? "Développeur" : "Employé"}
            {isDeveloper && role === "admin" ? " · Développeur" : ""}
          </p>
        </div>
        <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={switchRole}>
          <Repeat className="h-4 w-4" /> Changer de rôle
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-2 text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
          <LogOut className="h-4 w-4" /> Déconnexion
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

/** Redirects employees who reach a route they lack permission for (direct URL). */
function PermissionGuard({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { role, permissions, isDeveloper, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || role == null || role === "admin") return;
    const item = NAV.find((n) => n.to === pathname);
    if (item && !canAccess(item, role, permissions, isDeveloper)) {
      navigate({ to: "/nouvelle-vente", replace: true });
    }
  }, [loading, role, permissions, isDeveloper, pathname, navigate]);

  return <>{children}</>;
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
  const isDemo = useDemoMode();
  const { data: prefs } = useUserPreferences();
  const headerStyle = prefs?.header_color
    ? { backgroundColor: prefs.header_color }
    : undefined;

  if (isDemo) {
    return (
      <SidebarProvider>
        <DemoSidebar />
        <SidebarInset>
          <DemoBanner />
          <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
            <SidebarTrigger />
            <h1 className="font-serif text-xl font-semibold">{title}</h1>
          </header>
          <main
            className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6"
            style={{ animation: "brand-content-in 0.6s ease-out both" }}
          >
            {children}
          </main>
          <DemoFooter />
        </SidebarInset>
      </SidebarProvider>
    );
  }


  const inner = (
    <SidebarProvider defaultOpen={prefs?.sidebar_default !== "collapsed"}>
      <BrandIntro />
      <AutoBackupRunner />
      <AppSidebar />
      <SidebarInset>
        <header
          className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur"
          style={{
            ...headerStyle,
            paddingTop: "env(safe-area-inset-top)",
            height: "calc(3.5rem + env(safe-area-inset-top))",
          }}
        >
          <SidebarTrigger />
          <h1 className="font-serif text-xl font-semibold">{title}</h1>
        </header>
        <main
          className="min-w-0 flex-1 overflow-x-hidden p-4 md:p-6"
          style={{ animation: "brand-content-in 0.6s ease-out both" }}
        >
          <PermissionGuard>{children}</PermissionGuard>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );

  if (allow) {
    return <RequireRole allow={allow}>{inner}</RequireRole>;
  }
  return inner;
}
