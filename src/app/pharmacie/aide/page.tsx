import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { envoyerMessageChat } from "@/app/aide/actions";

const inputClass = "mt-1 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0A6B3A] focus:outline-none focus:ring-2 focus:ring-emerald-100";

export default async function PharmacieAidePage({ searchParams }: { searchParams: Promise<{ ticket?: string; erreur?: string }> }) {
  const filters = await searchParams;
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?espace=pharmacie&retour=%2Fpharmacie%2Faide");
  const { data: profile } = await sb.from("profiles").select("id,role,pharmacie_id,actif").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "pharmacie" || profile.actif === false || !profile.pharmacie_id) redirect("/");
  const pharmacyIds = [profile.pharmacie_id];
  const { data: tickets } = pharmacyIds.length
    ? await sb.from("tickets_support").select("id,sujet,type,statut,auteur_profile_id,pharmacie_id,created_at,first_response_at").in("pharmacie_id", pharmacyIds).eq("type", "conseil_pharmacien").order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  const current = (tickets ?? []).find((ticket) => ticket.id === filters.ticket) ?? (tickets ?? [])[0] ?? null;
  const { data: messages } = current
    ? await sb.from("messages_support").select("id,auteur_profile_id,contenu,created_at")
      .eq("ticket_id", current.id).eq("interne", false).order("created_at", { ascending: true }).limit(100)
    : { data: [] };
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900"><div className="mx-auto max-w-4xl space-y-5 pt-4">
    <header className="flex items-center justify-between gap-3"><Link href="/" className="font-bold text-[#064B2A]">← NAXA</Link><Link href="/pharmacie" className="font-bold text-[#064B2A] underline">"Espace pharmacie"</Link></header>
    <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      <div className="bg-[#064B2A] p-6 text-white"><p className="text-xs font-bold uppercase tracking-widest text-emerald-200">NAXA · Pharmacie</p><h1 className="mt-2 text-3xl font-black">Questions des clients</h1><p className="mt-2 text-sm text-emerald-50">Répondez aux conversations qui concernent votre pharmacie. Les réponses ne constituent pas un diagnostic médical.</p></div>
      {filters.erreur && <p role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">Le message n’a pas pu être envoyé. Actualisez la page et réessayez.</p>}
      <div className="grid gap-4 p-4 sm:grid-cols-[0.8fr_1.2fr] sm:p-6">
        <aside><h2 className="font-extrabold">Conversations reçues</h2>
          {(tickets ?? []).length === 0 && <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucune question pour le moment.</p>}
          <ul className="mt-3 space-y-2">{(tickets ?? []).map((ticket) => <li key={ticket.id}><Link href={"/pharmacie/aide?ticket=" + ticket.id} className={"block rounded-xl border p-3 text-sm " + (ticket.id === current?.id ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white")}>
            <span className="block font-bold">{new Date(ticket.created_at).toLocaleString("fr-FR")}</span><span className="mt-1 block text-slate-600">{ticket.statut === "ouvert" ? "À traiter / en cours" : ticket.statut}</span>
          </Link></li>)}</ul>
        </aside>
        <section className="min-w-0">
          {!current && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Sélectionnez une conversation pour répondre.</p>}
          {current && <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="bg-slate-50 p-4"><h2 className="font-extrabold">Conversation client</h2><p className="text-xs text-slate-500">Ouverte le {new Date(current.created_at).toLocaleString("fr-FR")}</p></div>
            <div className="max-h-[30rem] space-y-3 overflow-y-auto p-4">{(messages ?? []).map((message: { id: number | string; auteur_profile_id: string | null; contenu: string; created_at: string }) => <div key={message.id} className={message.auteur_profile_id === profile.id ? "ml-6 rounded-2xl rounded-br-sm bg-[#064B2A] p-3 text-sm leading-6 text-white" : "mr-6 rounded-2xl rounded-bl-sm bg-slate-100 p-3 text-sm leading-6 text-slate-800"}><p className="whitespace-pre-wrap break-words">{message.contenu}</p><p className="mt-1 text-right text-[10px] opacity-70">{new Date(message.created_at).toLocaleString("fr-FR")}</p></div>)}</div>
            {current.statut === "ouvert" && <form action={envoyerMessageChat} className="space-y-2 border-t border-slate-200 p-3"><input type="hidden" name="ticket_id" value={current.id}/><label className="block text-sm font-semibold">Réponse<textarea name="message" required maxLength={2000} rows={3} className={inputClass} placeholder="Répondre au client…"/></label><button className="min-h-11 w-full rounded-xl bg-[#064B2A] px-4 font-bold text-white" type="submit">Envoyer la réponse</button></form>}
            <div className="border-t border-slate-100 p-3 text-right"><Link href={"/pharmacie/aide?ticket=" + current.id} className="text-sm font-bold text-[#064B2A] underline">Actualiser</Link></div>
          </div>}
        </section>
      </div>
    </section>
  </div></main>;
}
