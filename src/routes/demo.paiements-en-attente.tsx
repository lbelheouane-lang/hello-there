import { createFileRoute } from "@tanstack/react-router";
import { PendingPaymentsPage } from "@/routes/_authenticated/paiements-en-attente";

export const Route = createFileRoute("/demo/paiements-en-attente")({
  ssr: false,
  component: PendingPaymentsPage,
});
