import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AdminInbox } from "@/components/admin/AdminInbox";

export default async function AdminMessagerie() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/messagerie");
  const { data: profile } = await sb.from("profiles").select("role,actif").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin" || profile.actif === false) redirect("/");
  const { data: tickets, error: ticketError } = await sb.from("tickets_support")
    .select("id,auteur_profile_id,pharmacie_id,sujet,type,statut,created_at")
    .order("created_at", { ascending: false }).limit(100);
  const ids = (tickets ?? []).map((ticket) => ticket.id);
  const { data: messages, error: messageError } = ids.length
    ? await sb.from("messages_support").select("id,ticket_id,auteur_profile_id,contenu,interne,created_at").in("ticket_id", ids).order("created_at", { ascending: true })
    : { data: [], error: null };

  return <main className="space-y-5">
    <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Support et requêtes</p><h1>Messagerie</h1><p className="mt-2 text-sm text-slate-600">Boîte de réception des tickets support NAXA et réponse dans le fil d’origine.</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Retour au tableau de bord</Link></header>
    {(ticketError || messageError) ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">La boîte de réception n’a pas pu être chargée. Vérifiez les politiques d’accès de tickets_support et messages_support.</section> : <AdminInbox tickets={(tickets ?? []) as any[]} messages={(messages ?? []) as any[]} />}
  </main>;
}
