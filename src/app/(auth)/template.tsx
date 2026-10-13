"use client";
import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

function AuthTemplateInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const search = useSearchParams();
  const routeKey = pathname + "?" + search.toString();
  const step = search.get("etape");
  const direction =
    step === "otp" ||
    step === "password" ||
    step === "identifiants" ||
    pathname === "/nouveau-mot-de-passe"
      ? "auth-stage-forward"
      : "auth-stage-backward";

  useEffect(() => {
    if (pathname === "/connexion") return;
    const heading = document.querySelector<HTMLElement>(".auth-stage h1, .auth-stage h2");
    if (heading) {
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
  }, [routeKey, pathname]);

  if (pathname === "/connexion") return <>{children}</>;

  return (
    <div key={routeKey} className={`auth-stage ${direction}`} aria-live="polite">
      {children}
    </div>
  );
}

export default function AuthTemplate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="auth-stage">{children}</div>}>
      <AuthTemplateInner>{children}</AuthTemplateInner>
    </Suspense>
  );
}
