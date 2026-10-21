import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const dateFr = (value: string | null) => value ? new Intl.DateTimeFormat("fr-CM", { dateStyle: "medium" }).format(new Date(value)) : "—";
const fcfa = (value: number | null) => new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", maximumFractionDigits: 0 }).format(value ?? 0);

export default async function DocumentsComptablePage() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/documents");
  const { data: profile, error: profileError } = await sb.from("profiles").select("id,actif,pharmacie_id")
    .eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null,
  });
  if (permissionError || allowed !== true) redirect("/pharmacie");

  const [reportsResult, recallsResult] = await Promise.all([
    sb.from("rapports").select("id,periode,du,au,texte,created_at,contenu")
      .eq("scope_type", "PHARMACIE").eq("scope_pharmacie_id", profile.pharmacie_id)
      .order("created_at", { ascending: false }).limit(50),
    sb.from("rappels_lots").select("id,reference_rappel,motif,statut,date_rappel,created_at")
      .eq("pharmacie_id", profile.pharmacie_id).order("created_at", { ascending: false }).limit(50),
  ]);

  return <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 pb-16">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-naxa-green-900 p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Documents autorisés</h1><p className="mt-1 text-sm text-emerald-100">Rapports et rappels de lots · lecture seule</p></div><Link href="/pharmacie/comptable" className="rounded-full border border-white/70 px-4 py-2 text-sm font-semibold">Retour au tableau de bord</Link></header>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">Rapports disponibles</h2><p className="mt-1 text-sm text-slate-600">Historique des rapports enregistrés pour cette pharmacie. Le fichier téléchargeable n’est proposé que par le parcours d’export correspondant.</p>
      {reportsResult.error ? <p role="alert" className="mt-3 text-sm text-red-700">Les rapports n’ont pas pu être chargés.</p> : (reportsResult.data ?? []).length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucun rapport enregistré.</p> : <ul className="mt-3 divide-y divide-slate-100">{(reportsResult.data ?? []).map(r => <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{r.periode ?? "Rapport"} · {dateFr(r.du)} – {dateFr(r.au)}</p><p className="mt-1 text-sm text-slate-600">{r.texte ?? "Rapport enregistré"} · généré le {dateFr(r.created_at)}</p></div><Link href="/pharmacie/comptable/rapports-exports" className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold">Ouvrir les exports</Link></li>)}</ul>}
    </section>
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4"><h2 className="font-bold text-amber-950">Reçus d’abonnement NAXA</h2><p className="mt-1 text-sm text-amber-900">Non disponibles pour le rôle Comptable dans les privilèges RLS actuellement confirmés : la table des paiements d’abonnement est réservée à l’administration. Aucun contournement par clé de service n’est utilisé. Une lecture métier dédiée doit être arbitrée avant d’exposer ces références ici.</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-bold">Rappels de lots à conséquence financière</h2><p className="mt-1 text-sm text-slate-600">Métadonnées du rappel uniquement ; aucune modification de stock ou décision de rappel depuis le poste Comptable.</p>
      {recallsResult.error ? <p role="alert" className="mt-3 text-sm text-red-700">Les rappels n’ont pas pu être chargés.</p> : (recallsResult.data ?? []).length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Aucun rappel de lot enregistré.</p> : <ul className="mt-3 divide-y divide-slate-100">{(recallsResult.data ?? []).map(r => <li key={r.id} className="py-3"><p className="font-semibold">{r.reference_rappel} · {r.statut}</p><p className="mt-1 text-sm text-slate-600">{r.motif} · {dateFr(r.date_rappel)}</p></li>)}</ul>}
    </section>
    <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Limite actuelle : les sources disponibles ne confirment pas de stockage centralisé de factures PDF ni de reçus téléchargeables. Cette page ne fabrique aucun document officiel ; elle liste uniquement les références réelles accessibles.</p>
  </main>;
}
