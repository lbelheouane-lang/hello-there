import { createContext, useContext, useEffect, type ReactNode } from "react";
import { setDemoActive } from "@/integrations/supabase/data-client";

interface DemoModeValue {
  isDemo: boolean;
}

const DemoModeContext = createContext<DemoModeValue>({ isDemo: false });

/** Activates the public read-only showroom for everything rendered inside. */
export function DemoModeProvider({ children }: { children: ReactNode }) {
  // Set synchronously on first render so the very first data query already
  // routes through the anonymous, read-only demo client.
  setDemoActive(true);
  useEffect(() => {
    setDemoActive(true);
    return () => setDemoActive(false);
  }, []);
  return (
    <DemoModeContext.Provider value={{ isDemo: true }}>
      {children}
    </DemoModeContext.Provider>
  );
}

/** True only when rendered under <DemoModeProvider> (the showroom). */
export function useDemoMode(): boolean {
  return useContext(DemoModeContext).isDemo;
}
