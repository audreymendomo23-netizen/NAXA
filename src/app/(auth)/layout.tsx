import type { ReactNode } from "react";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
export default function AuthLayout({children}:{children:ReactNode}) { return <Suspense fallback={null}><AuthShell>{children}</AuthShell></Suspense>; }
