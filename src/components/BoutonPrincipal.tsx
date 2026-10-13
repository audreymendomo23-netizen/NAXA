import type { ButtonHTMLAttributes, ReactNode } from "react";
export function BoutonPrincipal({children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children:ReactNode}) {
 return <button {...props} className={`inline-flex min-h-[52px] w-full items-center justify-center rounded-2xl bg-[#FFE33D] px-5 font-extrabold text-[#064B2A] transition-[transform,opacity,background-color] duration-200 hover:bg-[#F5D91F] active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-50 ${props.className??""}`}>{children}</button>;
}
