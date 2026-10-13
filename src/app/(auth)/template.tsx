"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
export default function AuthTemplate({children}:{children:ReactNode}) {
 const pathname=usePathname(), search=useSearchParams();
 const routeKey=pathname+"?"+search.toString();
 const step=search.get("etape");
 const direction=(step==="otp"||step==="password"||step==="identifiants"||pathname==="/nouveau-mot-de-passe")?"auth-stage-forward":"auth-stage-backward";
 useEffect(()=>{const heading=document.querySelector<HTMLElement>(".auth-stage h1");if(heading){heading.setAttribute("tabindex","-1");heading.focus({preventScroll:true);}},[routeKey]);
 return <div key={routeKey} className={`auth-stage ${direction}`} aria-live="polite">{children}</div>;
}
