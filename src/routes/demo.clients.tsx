import { createFileRoute } from "@tanstack/react-router";
import { ClientsPage } from "@/routes/_authenticated/clients";

export const Route = createFileRoute("/demo/clients")({
  ssr: false,
  component: ClientsPage,
});
