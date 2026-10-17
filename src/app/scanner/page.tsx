"use client";

import { Suspense } from "react";
import { ScannerShell } from "@/components/ScannerShell";

export default function ScannerPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-[#0B1F15] text-white" />}>
      <ScannerShell />
    </Suspense>
  );
}
