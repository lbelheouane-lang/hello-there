import { createFileRoute } from "@tanstack/react-router";
import { ParuresPage } from "@/routes/_authenticated/parures";

export const Route = createFileRoute("/demo/parures")({
  ssr: false,
  component: ParuresPage,
});
