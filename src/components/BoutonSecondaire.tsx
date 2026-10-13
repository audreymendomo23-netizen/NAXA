import type { ButtonHTMLAttributes, ReactNode } from "react";
export function BoutonSecondaire({children,...props}:ButtonHTMLAttributes<HTMLButtonElement>&{children:ReactNode}) {
 return <button {...props} className={`inline-flex min-h-[48px] items-center justify-center rounded-2xl border border-[#0A6B3A] bg-white px-5 font-bold text-[#064B2A] transition-colors duration-200 hover:bg-[#F2FAF5] disabled:opacity-50 ${props.className??""}`}>{children}</button>;
}
