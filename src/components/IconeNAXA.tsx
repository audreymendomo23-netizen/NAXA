import type { SVGProps } from "react";

export type IconeNAXAName = "arrow-left" | "bell" | "chevron-right" | "heart" | "lock" | "map-pin" | "search" | "shopping-cart" | "store" | "trash" | "user-round";

export function IconeNAXA({ name, size = 20, filled = false, className }: { name: IconeNAXAName; size?: number; filled?: boolean; className?: string }) {
  const props: SVGProps<SVGSVGElement> = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.9,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    "aria-hidden": true,
    focusable: false,
  };
  return <svg {...props}>
    {name === "arrow-left" && <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>}
    {name === "bell" && <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></>}
    {name === "chevron-right" && <path d="m9 18 6-6-6-6"/>}
    {name === "heart" && <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z" fill={filled ? "currentColor" : "none"}/>}
    {name === "lock" && <><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>}
    {name === "map-pin" && <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>}
    {name === "search" && <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></>}
    {name === "shopping-cart" && <><circle cx="9" cy="20" r="1"/><circle cx="18" cy="20" r="1"/><path d="M2 3h2l2.6 12.1a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 1.9-1.5L22 8H5"/></>}
    {name === "store" && <><path d="M3 10v10h18V10"/><path d="M2 10l2-6h16l2 6"/><path d="M2 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M9 20v-5h6v5"/></>}
    {name === "trash" && <><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 10v6M14 10v6"/></>}
    {name === "user-round" && <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>}
  </svg>;
}
