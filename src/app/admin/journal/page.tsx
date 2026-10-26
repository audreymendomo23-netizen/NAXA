import Link from "next/link";
import { requireAdminActive } from "@/lib/admin/require-admin-active";

export default async function JournalAdministration() {
  const { sb } = await requireAdminActive("/admin/journal");
  const { data: events, error } = await sb.from("audit_log")
    .select("id,actor_id,action,entity_type,entity_id,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return <main className="admin-analytics-page space-y-4">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-extrabold uppercase tracking-widest text-emerald-800">Traçabilité transversale</p><h1>Journal d’administration</h1><p className="mt-2 text-sm text-slate-600">Événements présents dans le journal d’audit commun, tous univers confondus. Affichage limité aux 200 événements les plus récents.</p></div>
      <Link href="/admin" className="rounded-full border px-4 py-2 text-sm font-bold">Retour au tableau de bord</Link>
    </header>
    {error ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-900">Le journal d’audit n’est pas accessible avec les droits de ce compte.</section> : !events?.length ? <section className="rounded-2xl border p-5"><h2 className="font-extrabold">Aucun événement disponible</h2><p className="mt-2 text-sm text-slate-600">Aucun événement n’est actuellement lisible dans le journal d’audit commun.</p></section> : <section className="overflow-hidden rounded-2xl border bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">Date</th><th className="p-3">Action</th><th className="p-3">Univers / entité</th><th className="p-3">Identifiant</th><th className="p-3">Acteur</th><th className="p-3">Détails</th></tr></thead><tbody>{events.map((event: any) => <tr key={event.id} className="border-t align-top"><td className="p-3 whitespace-nowrap">{new Date(event.created_at).toLocaleString("fr-FR")}</td><td className="p-3 font-semibold">{String(event.action ?? "Action").replace(/[._]/g, " ")}</td><td className="p-3">{event.entity_type ?? "—"}</td><td className="p-3 font-mono text-xs">{event.entity_id ?? "—"}</td><td className="p-3 font-mono text-xs">{event.actor_id ?? "Système"}</td><td className="max-w-sm whitespace-pre-wrap break-words p-3 text-xs">{event.metadata ? JSON.stringify(event.metadata) : "—"}</td></tr>)}</tbody></table></div></section>}
  </main>;
}
