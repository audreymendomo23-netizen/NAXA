import type { ReactNode } from "react";
import { AuthFlowProvider } from "@/components/auth/AuthFlowContext";
import { AuthShell } from "@/components/auth/AuthShell";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <AuthFlowProvider><AuthShell>{children}</AuthShell></AuthFlowProvider>;
}
