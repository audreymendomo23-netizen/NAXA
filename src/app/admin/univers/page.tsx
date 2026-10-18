import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";

const spaces = [
  ["parapharmacie", "Parapharmacie", "universe.parapharmacie"],
  ["bebe-maman", "Bébé & Maman", "universe.bebe-maman"],
  ["examens", "Examens médicaux", "universe.examens"],
  ["suivi", "Suivi santé", "universe.suivi"],
  ["prestations", "Prestations à domicile", "universe.prestations"],
  ["aide", "Aide NAXA", ""],
] as const;

export default async function AdminUnivers() {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/admin/univers");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if (profile?.role !== "admin") redirect("/");
  const [u, f, p] = await Promise.all([
    sb.from("universes").select("slug,name,enabled,display_order").order("display_order"),
    sb.from("feature_flags").select("flag_key,enabled,description").order("flag_key"),
    sb.from("partners").select("id,name,partner_type,city,neighborhood,status,created_at").order("created_at", { ascending: false }).limit(100),
  ]);
  const missing = !!(u.error || f.error || p.error);
  const flags = new Map((f.data ?? []).map((x) => [x.flag_key, x]));
  const state: Record<string, string> = { pending: "À vérifier", active: "Actif", suspended: "Suspendu" };
  return <main className="min-h-screen bg-[#F8FAF9] px-4 pb-12 text-slate-900"><div className="mx-auto max-w-5xl space-y-5 pt-4">
    <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white sm:mx-0 sm:rounded-2xl"><Logo taille={32}/><Link href="/admin" className="font-bold underline">← Administration</Link></header>
    <div><p className="text-xs font-extrabold uppercase tracking-widest text-teal-800">NAXA · Administration</p><h1 className="mt-1 text-3xl font-black">Univers et partenaires</h1><p className="mt-2 text-sm leading-6 text-slate-600">Contrôle du socle multi-univers. Les espaces commerciaux restent désactivés tant que leurs parcours et données ne sont pas prêts.</p></div>
    {missing && <div role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Migration 098 requise.</strong> Les tables ne sont pas accessibles. Vérifiez puis appliquez la migration séparément dans Supabase. Aucun changement de base n’est effectué par cette page.</div>}
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><h2 className="text-xl font-extrabold">État des espaces</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{spaces.map(([slug,name,key])=>{const row=(u.data??[]).find(x=>x.slug===slug);const flag=key?flags.get(key):null;const active=!!row?.enabled&&(!key||!!flag?.enabled);return <article key={slug} className="rounded-xl border p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-bold">{name}</h3><span className={active?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900":"rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>{active?"Actif":"Inactif"}</span></div><p className="mt-2 text-xs leading-5 text-slate-600">{row?(flag?.description??"Espace informatif"): "Configuration non disponible"}</p></article>})}</div></section>
    <section className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="text-xl font-extrabold">Partenaires</h2><span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{p.data?.length??0}</span></div>{!p.data?.length?<p className="mt-3 text-sm text-slate-600">Aucun partenaire enregistré ou tables indisponibles.</p>:<ul className="mt-4 space-y-3">{p.data.map(x=><li key={x.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold">{x.name}</h3><p className="mt-1 text-sm text-slate-600">{x.city}{x.neighborhood?" · "+x.neighborhood:""} · {x.partner_type}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{state[x.status]??x.status}</span></div><p className="mt-2 text-xs text-slate-500">Créé le {new Date(x.created_at).toLocaleDateString("fr-FR")}</p></li>)}</ul>}</section>
    <p className="text-xs leading-5 text-slate-500">Cette première vue est en lecture seule. La création, la vérification, la suspension et les modifications de drapeaux seront ajoutées avec des actions serveur auditées.</p>
  </div></main>;
}
