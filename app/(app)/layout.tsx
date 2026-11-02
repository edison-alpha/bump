import type { ReactNode } from "react";
import { AuthGate } from "@/modules/session/auth-gate";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
