import { createFileRoute } from "@tanstack/react-router";
import { DashboardPage } from "@/routes/_authenticated/dashboard";

export const Route = createFileRoute("/demo/dashboard")({
  ssr: false,
  component: DashboardPage,
});
