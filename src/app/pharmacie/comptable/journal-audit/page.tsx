import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateFr = (value: string) =>
  new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default async function JournalAuditComptablePage({ searchParams }: { searchParams?: { debut?: string; fin?: string; action?: string } }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/journal-audit");
  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const validDate = (v?: string) => {
    if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
    const parsed = new Date(v + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === v ? v : "";
  };
  const safeMotif = (value: string | null) => value ? "Motif enregistré — détail masqué pour protéger les données confidentielles" : "—";
  const debut = validDate(searchParams?.debut);
  const fin = validDate(searchParams?.fin);
  const action = (searchParams?.action ?? "").trim().slice(0, 80);
  const invalid = Boolean(debut && fin && debut > fin);
  let query = sb.from("compta_audit")
    .select("sequence_no,acteur_id,action,objet_type,objet_id,resultat,motif,horodatage")
    .eq("pharmacie_id", profile.pharmacie_id)
    .order("horodatage", { ascending: false }).limit(200);
  if (debut) query = query.gte("horodatage", debut + "T00:00:00+01:00");
  if (fin) query = query.lt("horodatage", new Date(Date.parse(fin + "T00:00:00+01:00") + 86400000).toISOString());
  if (action) query = query.ilike("action", "%" + action.replace(/[%,()]/g, "") + "%");
  const result = invalid ? { data: null, error: { message: "Période invalide" } } : await query;
  const rows = result.data ?? [];
  const integrity = invalid
    ? { data: null, error: { message: "Période invalide" } }
    : await sb.rpc("compta_verifier_audit", { p_pharmacie: profile.pharmacie_id });

  return <main className="mx-auto max-w-7xl space-y-5 px-4 py-5 pb-16">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 p-5 text-white">
      <div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Journal d’audit</h1><p className="mt-1 text-sm text-emerald-100">Lecture seule · périmètre de votre pharmacie</p></div>
      <Link href="/pharmacie/comptable" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold">Retour au tableau de bord</Link>
    </header>
    <form className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-4">
      <label className="text-sm font-medium text-slate-700">Du<input name="debut" type="date" defaultValue={debut} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Au<input name="fin" type="date" defaultValue={fin} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium text-slate-700">Action contient<input name="action" maxLength={80} defaultValue={action} className="mt-1 block min-h-11 w-full rounded-xl border border-slate-300 px-3" /></label>
      <div className="flex items-end gap-2"><button className="min-h-11 rounded-xl bg-naxa-green-900 px-4 font-semibold text-white">Filtrer</button><Link href="/pharmacie/comptable/journal-audit" className="rounded-xl border border-slate-300 px-3 py-3 text-sm">Réinitialiser</Link></div>
    </form>
    {integrity.error ? <section role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Intégrité non vérifiée.</strong> La vérification de la chaîne n’a pas pu aboutir ; cela ne signifie pas nécessairement qu’elle est altérée. Contrôlez les privilèges et réessayez.</section> : <section role="status" className={integrity.data === true ? "rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900" : "rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"}><strong>{integrity.data === true ? "Chaîne d’audit vérifiée." : "Alerte : chaîne d’audit invalide."}</strong> {integrity.data === true ? "Séquences, liens de hachage et empreintes correspondent au contrôle disponible." : "Ne considérez pas le journal comme intègre avant investigation."}</section>}
    {result.error ? <section role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Le journal d’audit n’a pas pu être chargé. Vérifiez les privilèges et les politiques RLS.</section> :
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 p-4"><h2 className="font-bold">Événements récents</h2><p className="mt-1 text-sm text-slate-600">{rows.length} événement(s) affiché(s), maximum 200. Les données sont consultables mais non modifiables depuis ce poste.</p></div>
        {rows.length === 0 ? <p className="p-5 text-sm text-slate-600">Aucun événement correspondant à ces filtres.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead><tr className="border-b bg-slate-50 text-xs uppercase text-slate-500"><th className="p-3">Date</th><th className="p-3">Acteur</th><th className="p-3">Action</th><th className="p-3">Objet</th><th className="p-3">Résultat</th><th className="p-3">Motif</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={row.sequence_no} className="border-b border-slate-100 align-top last:border-0"><td className="whitespace-nowrap p-3">{dateFr(row.horodatage)}</td><td className="p-3 font-mono text-xs">{row.acteur_id ? row.acteur_id.slice(0, 8) : "Système"}</td><td className="p-3">{row.action}</td><td className="p-3">{row.objet_type}{row.objet_id ? <span className="block font-mono text-xs text-slate-500">{row.objet_id.slice(0, 24)}</span> : null}</td><td className="p-3">{row.resultat}</td><td className="max-w-xs whitespace-pre-wrap p-3">{safeMotif(row.motif)}</td></tr>)}</tbody></table></div>}
      </section>}
  </main>;
}
