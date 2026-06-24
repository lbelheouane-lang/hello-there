import { createFileRoute } from "@tanstack/react-router";
import { InvoicesPage } from "@/routes/_authenticated/factures";

export const Route = createFileRoute("/demo/factures")({
  ssr: false,
  component: InvoicesPage,
});
