import { createFileRoute } from "@tanstack/react-router";
import { JournalPage } from "@/routes/_authenticated/journal-quotidien";

export const Route = createFileRoute("/demo/journal-quotidien")({
  ssr: false,
  component: JournalPage,
});
