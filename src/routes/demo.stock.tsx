import { createFileRoute } from "@tanstack/react-router";
import { StockPage } from "@/routes/_authenticated/stock";

export const Route = createFileRoute("/demo/stock")({
  ssr: false,
  component: StockPage,
});
