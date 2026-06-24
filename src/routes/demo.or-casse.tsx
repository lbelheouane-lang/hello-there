import { createFileRoute } from "@tanstack/react-router";
import { ScrapGoldPage } from "@/routes/_authenticated/or-casse";

export const Route = createFileRoute("/demo/or-casse")({
  ssr: false,
  component: ScrapGoldPage,
});
