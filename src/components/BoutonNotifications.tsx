"use client";
import Link from "next/link";
import { useNotifications } from "@/lib/messagerie";

export function BoutonNotifications() {
  const { nonLus } = useNotifications();
  return <Link href="/notifications" aria-label={nonLus ? `Notifications, ${nonLus} non lues` : "Notifications"} className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-white hover:bg-white/10">
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/></svg>
    {nonLus > 0 && <span className="absolute right-0 top-0 min-w-5 rounded-full bg-naxa-canari px-1 text-center text-[10px] font-extrabold leading-5 text-naxa-green-900">{nonLus > 9 ? "9+" : nonLus}</span>}
  </Link>;
}
