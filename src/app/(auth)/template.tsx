"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
export default function AuthTemplate({children}:{children:ReactNode}) {
 const pathname=usePathname();
 const direction=pathname==="/connexion"?"auth-stage-backward":"auth-stage-forward";
 useEffect(()=>{const heading=document.querySelector<HTMLElement>(".auth-stage h1");if(heading){heading.setAttribute("tabindex","-1");heading.focus({preventScroll:true});}},[pathname]);
 return <div key={pathname} className={`auth-stage ${direction}`} aria-live="polite">{children}</div>;
}
