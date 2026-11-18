import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { AdminInbox } from "@/components/admin/AdminInbox";

export default async function AdminMessagerie() {
  const { sb } = await requireAdminActive("/admin/messagerie");
  const { data: tickets, error: ticketError } = await sb.from("tickets_support")
    .select("id,auteur_profile_id,pharmacie_id,sujet,type,statut,created_at,reference_code,categorie,last_activity_at")
    .order("last_activity_at", { ascending: false }).limit(150);
  const authorIds = [...new Set((tickets ?? []).map((ticket) => ticket.auteur_profile_id).filter((id): id is string => Boolean(id)))];
  const { data: authors } = authorIds.length
    ? await sb.from("profiles").select("id,username,first_name,last_name,role,fonction_interne").in("id", authorIds)
    : { data: [] };
  const authorLabels = Object.fromEntries((authors ?? []).map((author) => [author.id, {
    name: [author.first_name, author.last_name].filter(Boolean).join(" ") || author.username || "Compte professionnel",
    role: author.fonction_interne || author.role,
  }]));

  return <main className="space-y-5">
    <header><div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Support et requêtes</p><h1>Messagerie</h1><p className="mt-2 text-sm text-slate-600">Boîte de réception des tickets. Les demandes directes des Clients et professionnels sont individuelles et séparées des conversations Client–pharmacie.</p></div><Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Retour au tableau de bord</Link></header>
    {ticketError ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">La boîte de réception n’a pas pu être chargée. Vérifiez les politiques d’accès de tickets_support.</section> : <AdminInbox tickets={(tickets ?? []).map((ticket) => ({ ...ticket, auteur_label: authorLabels[ticket.auteur_profile_id ?? ""]?.name, auteur_role: authorLabels[ticket.auteur_profile_id ?? ""]?.role })) as any[]} />}
  </main>;
}
