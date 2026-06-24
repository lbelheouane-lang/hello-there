import { createFileRoute } from "@tanstack/react-router";
import { ExpensesPage } from "@/routes/_authenticated/depenses";

export const Route = createFileRoute("/demo/depenses")({
  ssr: false,
  component: ExpensesPage,
});
