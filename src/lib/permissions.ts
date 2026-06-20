// Module access permissions for employees. Client-safe (no secrets).
// Administrators always have full access; permissions only refine what an
// "employe" account can reach.

export type PermissionKey =
  | "dashboard"
  | "inventory"
  | "categories"
  | "jewelry_sets"
  | "scrap_gold"
  | "sales"
  | "invoices"
  | "customers"
  | "suppliers"
  | "reports"
  | "settings";

export const PERMISSION_KEYS: PermissionKey[] = [
  "dashboard",
  "inventory",
  "categories",
  "jewelry_sets",
  "scrap_gold",
  "sales",
  "invoices",
  "customers",
  "suppliers",
  "reports",
  "settings",
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  dashboard: "Tableau de bord",
  inventory: "Inventaire (stock)",
  categories: "Catégories",
  jewelry_sets: "Parures",
  scrap_gold: "Or cassé",
  sales: "Ventes",
  invoices: "Factures",
  customers: "Clients",
  suppliers: "Fournisseurs",
  reports: "Rapports",
  settings: "Paramètres",
};

/** Default permissions granted to a freshly created employee. */
export const DEFAULT_EMPLOYEE_PERMISSIONS: PermissionKey[] = [
  "sales",
  "invoices",
  "customers",
];

/** Full permission set (used for administrators / bootstrap admin). */
export const ALL_PERMISSIONS: PermissionKey[] = [...PERMISSION_KEYS];
