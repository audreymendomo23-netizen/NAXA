"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { mountScrollMotion, setScrollMotionRoute } from "@/lib/scroll-motion";
export function ScrollMotionProvider() {
  const pathname = usePathname();
  useEffect(() => mountScrollMotion(), []);
  useEffect(() => { setScrollMotionRoute(pathname || "/"); }, [pathname]);
  return null;
}
