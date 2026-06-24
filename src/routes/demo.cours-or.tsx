import { createFileRoute } from "@tanstack/react-router";
import { GoldPricePage } from "@/routes/_authenticated/cours-or";

export const Route = createFileRoute("/demo/cours-or")({
  ssr: false,
  component: GoldPricePage,
});
