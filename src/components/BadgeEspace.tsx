import type { ReactNode } from "react";
export function BadgeEspace({children,icon}:{children:ReactNode;icon?:ReactNode}) {
 return <span className="inline-flex min-h-10 max-w-[65vw] items-center gap-2 truncate rounded-full border border-[#D8E9DE] bg-white/85 px-4 py-2 text-sm font-extrabold text-[#064B2A] shadow-sm">{icon}<span className="truncate">{children}</span></span>;
}
