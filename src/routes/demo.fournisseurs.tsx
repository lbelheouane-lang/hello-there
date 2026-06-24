import { createFileRoute } from "@tanstack/react-router";
import { SuppliersPage } from "@/routes/_authenticated/fournisseurs";

export const Route = createFileRoute("/demo/fournisseurs")({
  ssr: false,
  component: SuppliersPage,
});
