import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { AdminInbox } from "@/components/admin/AdminInbox";

export default async function AdminMessagerie() {
  const { sb } = await requireAdminActive("/admin/messagerie");
  const { data: tickets, error: ticketError } = await sb.from("tickets_support")
    .select("id,auteur_profile_id,pharmacie_id,sujet,type,statut,created_at")
    .order("created_at", { ascending: false }).limit(100);

  return <main className="space-y-5">
    <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Support et requêtes</p><h1>Messagerie</h1><p className="mt-2 text-sm text-slate-600">Boîte de réception des tickets support NAXA et réponse dans le fil d’origine. L’historique est chargé uniquement pour le ticket sélectionné.</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Retour au tableau de bord</Link></header>
    {ticketError ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">La boîte de réception n’a pas pu être chargée. Vérifiez les politiques d’accès de tickets_support.</section> : <AdminInbox tickets={(tickets ?? []) as any[]} />}
  </main>;
}
