import {Suspense} from "react";
import {AcceptCourierInvitationClient} from "@/components/AcceptCourierInvitationClient";

export const dynamic="force-dynamic";

export default function AccepterInvitationLivreurPage({
  searchParams,
}:{searchParams:{token?:string}}){
  return <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#F4F8F5] px-4"><p className="rounded-xl bg-white p-5 text-sm text-slate-600">Chargement de l’invitation…</p></main>}>
    <AcceptCourierInvitationClient token={searchParams.token??""}/>
  </Suspense>;
}
