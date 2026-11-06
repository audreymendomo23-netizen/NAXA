import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const sb = supabaseServer();
  const { error } = await sb.auth.signOut();
  if (error) redirect("/pharmacie/comptable/profil?erreur=deconnexion");
  redirect("/connexion");
}

export default async function ProfilComptablePage({ searchParams }: { searchParams?: Promise<{ erreur?: string }> }) {
  const filters = await searchParams;
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/comptable/profil");
  const { data: profile, error } = await sb.from("profiles")
    .select("id,role,fonction_interne,actif,pharmacie_id,first_name,last_name,username,created_at")
    .eq("id", auth.user.id).single();
  if (error || !profile || profile.actif !== true || !profile.pharmacie_id) redirect("/pharmacie");
  const { data: allowed, error: permissionError } = await sb.rpc("compta_scope_autorise", { p_pharmacie: profile.pharmacie_id });
  if (permissionError || allowed !== true) redirect("/pharmacie");
  const { data: pharmacy } = await sb.from("pharmacies").select("nom").eq("id", profile.pharmacie_id).maybeSingle();
  const label = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.username || auth.user.email || "Compte Comptable";

  return <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 pb-16">
    <header className="rounded-2xl bg-naxa-green-900 p-5 text-white"><p className="text-xs font-semibold uppercase tracking-wide text-emerald-100">NAXA · Comptable</p><h1 className="mt-1 text-2xl font-extrabold">Profil & session</h1><p className="mt-1 text-sm text-emerald-100">Consultation du compte et fermeture sécurisée de session.</p></header>
    {filters?.erreur === "deconnexion" ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">La déconnexion n’a pas pu être confirmée. Réessayez.</p> : null}
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">Compte</h2><dl className="mt-4 grid gap-4 sm:grid-cols-2"><div><dt className="text-xs uppercase text-slate-500">Identité</dt><dd className="mt-1 font-semibold">{label}</dd></div><div><dt className="text-xs uppercase text-slate-500">E-mail de connexion</dt><dd className="mt-1 break-all">{auth.user.email ?? "Non disponible"}</dd></div><div><dt className="text-xs uppercase text-slate-500">Fonction interne</dt><dd className="mt-1">{profile.fonction_interne ?? "Comptable (fonction non renseignée)"}</dd></div><div><dt className="text-xs uppercase text-slate-500">Rôle technique</dt><dd className="mt-1">{String(profile.role)}</dd></div><div><dt className="text-xs uppercase text-slate-500">Pharmacie rattachée</dt><dd className="mt-1">{pharmacy?.nom ?? "Pharmacie associée"}</dd></div><div><dt className="text-xs uppercase text-slate-500">État du compte</dt><dd className="mt-1">Actif</dd></div><div><dt className="text-xs uppercase text-slate-500">Identifiant</dt><dd className="mt-1 font-mono text-xs">{profile.id}</dd></div></dl><p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Le rôle, la pharmacie et les privilèges ne peuvent pas être modifiés depuis ce poste. Le changement de mot de passe reste géré par le mécanisme sécurisé d’authentification NAXA.</p></section>
    <section className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="font-bold">Déconnexion</h2><p className="mt-1 text-sm text-slate-600">Cette action demande à Supabase de terminer la session, puis redirige vers la connexion.</p><form action={signOut} className="mt-4"><button type="submit" className="min-h-11 rounded-xl bg-red-700 px-5 font-semibold text-white">Se déconnecter</button></form></section>
    <Link href="/pharmacie/comptable" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 px-4 font-semibold">Retour au tableau de bord</Link>
  </main>;
}
