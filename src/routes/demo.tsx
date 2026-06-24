import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DemoModeProvider } from "@/lib/demo/demo-context";

export const Route = createFileRoute("/demo")({
  ssr: false,
  component: DemoLayout,
});

function DemoLayout() {
  return (
    <DemoModeProvider>
      <Outlet />
    </DemoModeProvider>
  );
}
