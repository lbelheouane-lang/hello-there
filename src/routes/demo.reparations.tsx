import { createFileRoute } from "@tanstack/react-router";
import { RepairsPage } from "@/routes/_authenticated/reparations";

export const Route = createFileRoute("/demo/reparations")({
  ssr: false,
  component: RepairsPage,
});
