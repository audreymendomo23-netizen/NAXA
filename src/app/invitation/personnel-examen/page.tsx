import { Suspense } from "react";
import AcceptExamStaffInvitationClient from "@/components/AcceptExamStaffInvitationClient";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Invitation au personnel — NAXA",
  robots: { index: false, follow: false },
};

export default function AcceptExamStaffInvitationPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = String(searchParams?.token ?? "");
  return (
    <Suspense fallback={<main className="min-h-screen bg-slate-50 p-6 text-sm text-slate-600">Chargement de l’invitation…</main>}>
      <AcceptExamStaffInvitationClient token={token} />
    </Suspense>
  );
}
