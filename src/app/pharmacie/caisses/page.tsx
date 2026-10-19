import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { bloquerCaisse, creerCaisse, reactiverCaisse } from "../actions";

type Props = { searchParams: { ok?: string; erreur?: string } };

export default async function CaissesPage({ searchParams }: Props) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/caisses");

  const { data: profile } = await sb
    .from("profiles")
    .select("id,role,actif")
    .eq("id", auth.user.id)
    .single();
  if (profile?.role !== "promoteur") redirect("/pharmacie");
  if (profile.actif !== true) redirect("/pharmacie/promoteur");

  const { data: links, error: linksError } = await sb.from("promoteur_pharmacies")
    .select("pharmacie_id")
    .eq("promoteur_id", auth.user.id)
    .eq("actif", true);

  if (linksError || !links?.length) redirect("/pharmacie/promoteur");
  // Le contrôle commercial et le privilège de création sont évalués côté serveur
  // sur chaque pharmacie active avant d'exposer les comptes Caisse.
  const permissions = await Promise.all(links.map((link) => sb.rpc("naxa_can", {
    p_privilege: "CREATE_CAISSE",
    p_pharmacie: link.pharmacie_id,
    p_target: null,
  })));
  if (!permissions.some((permission) => !permission.error && permission.data === true)) {
    redirect("/pharmacie/promoteur");
  }

  const { data: caisses, error: caissesError } = await sb.from("profiles")
    .select("id,username,first_name,last_name,actif,pharmacie_id,created_at")
    .eq("parent_profile_id", auth.user.id)
    .eq("role", "caisse")
    .order("created_at", { ascending: true });

  const pharmacyIds = [...new Set(links.map((x) => x.pharmacie_id))];
  const [{ data: pharmacies }, { data: architectureRows }] = await Promise.all([
    pharmacyIds.length
      ? sb.from("pharmacies").select("id,nom,ville,quartier").in("id", pharmacyIds)
      : Promise.resolve({ data: [] as { id: string; nom: string; ville: string | null; quartier: string | null }[] }),
    pharmacyIds.length
      ? sb.from("pharmacie_architectures").select("pharmacie_id,architecture_code,max_caisses").in("pharmacie_id", pharmacyIds).eq("active", true)
      : Promise.resolve({ data: [] as { pharmacie_id: string; architecture_code: string; max_caisses: number | null }[] }),
  ]);
  const pharmacyById = new Map((pharmacies ?? []).map((p) => [p.id, p] as const));
  const archById = new Map((architectureRows ?? []).map((a) => [a.pharmacie_id, a] as const));
  const countActive = (id: string) => (caisses ?? []).filter((c) => c.pharmacie_id === id && c.actif).length;
  const champ = "champ mt-1";

  const errors: Record<string, string> = {
    validation: "Vérifiez les champs : identifiant, e-mail, téléphone, date de naissance et mot de passe de 12 caractères minimum.",
    perimetre: "Cette pharmacie ne fait pas partie de votre réseau actif.",
    autorisation: "Action refusée par le moteur d'autorisation ou quota indisponible.",
    creation: "Le compte n'a pas pu être créé. Vérifiez que l'e-mail et l'identifiant sont disponibles.",
    profil: "Le profil Caisse n'a pas pu être préparé. Aucun compte enfant n'a été conservé.",
    provisionnement: "La pharmacie, son architecture ou son quota refuse cette Caisse. Le compte provisoire a été supprimé.",
    cible: "Compte Caisse manquant.",
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-16">
      <header className="-mx-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white">
        <Link href="/pharmacie/promoteur" className="font-bold underline">← Espace Promoteur</Link>
        <span className="font-semibold">Gestion de l'équipe</span>
      </header>

      <section className="carte">
        <h1 className="text-xl font-extrabold">Mes Caisses</h1>
        <p className="mt-1 text-sm text-slate-600">Les Caisses sont rattachées à une seule pharmacie. Leurs droits, leur quota et leur activation sont contrôlés côté serveur.</p>
      </section>

      {searchParams.ok && <p role="status" className="carte">Opération terminée : {searchParams.ok === "creation" ? "Caisse créée et provisionnée." : searchParams.ok === "blocage" ? "Caisse bloquée." : "Caisse réactivée."}</p>}
      {searchParams.erreur && <p role="alert" className="carte text-red-700">{errors[searchParams.erreur] ?? "Impossible d'effectuer cette opération."}</p>}
      {(linksError || caissesError) && <p role="alert" className="carte text-red-700">Impossible de charger le réseau ou les comptes Caisse. Réessayez après vérification de la connexion.</p>}

      <section className="carte space-y-3">
        <h2 className="text-lg font-bold">Comptes existants</h2>
        {caisses?.length ? caisses.map((c) => {
          const ph = c.pharmacie_id ? pharmacyById.get(c.pharmacie_id) : null;
          return (
            <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-bold">{c.first_name} {c.last_name}</p>
                <p className="text-sm text-slate-600">@{c.username} · {ph?.nom ?? "Pharmacie non identifiée"} · {c.actif ? "Actif" : "Bloqué"}</p>
              </div>
              {c.actif ? (
                <form action={bloquerCaisse}><input type="hidden" name="caisse_id" value={c.id} /><button className="btn btn-clair">Bloquer</button></form>
              ) : (
                <form action={reactiverCaisse}><input type="hidden" name="caisse_id" value={c.id} /><button className="btn btn-canari">Réactiver</button></form>
              )}
            </article>
          );
        }) : <p className="text-sm text-slate-600">Aucune Caisse rattachée à votre compte pour le moment.</p>}
      </section>

      <section className="carte space-y-3">
        <h2 className="text-lg font-bold">Créer une Caisse</h2>
        {!pharmacyIds.length && <p role="alert" className="text-sm text-amber-800">Aucune pharmacie active n'est liée à votre réseau. La création est désactivée jusqu'à ce que NAXA établisse le lien Promoteur/pharmacie.</p>}
        <form action={creerCaisse} className="space-y-3">
          <label className="block text-sm font-semibold">Pharmacie
            <select name="pharmacie_id" required disabled={!pharmacyIds.length} className={champ} defaultValue="">
              <option value="" disabled>Choisir une pharmacie du réseau</option>
              {(pharmacies ?? []).map((p) => {
                const a = archById.get(p.id);
                const max = a?.max_caisses;
                const active = countActive(p.id);
                const reached = max != null && active >= max;
                return <option key={p.id} value={p.id} disabled={reached}>{p.nom} — {p.ville ?? "Ville non renseignée"} · {active}/{max ?? "∞"} Caisse(s) active(s){reached ? " · quota atteint" : ""}</option>;
              })}
            </select>
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Prénom<input name="first_name" required autoComplete="given-name" className={champ} /></label>
            <label className="text-sm font-semibold">Nom<input name="last_name" required autoComplete="family-name" className={champ} /></label>
          </div>
          <label className="block text-sm font-semibold">Nom d'utilisateur<input name="username" required pattern="[a-z0-9][a-z0-9._-]{2,29}" autoComplete="username" className={champ} /></label>
          <label className="block text-sm font-semibold">E-mail<input name="email" type="email" required autoComplete="email" className={champ} /></label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">Téléphone<input name="phone" required inputMode="tel" autoComplete="tel" placeholder="+237 6XXXXXXXX" className={champ} /></label>
            <label className="text-sm font-semibold">Code pays<input name="phone_country" required defaultValue="CM" pattern="[A-Za-z]{2}" className={champ} /></label>
          </div>
          <label className="block text-sm font-semibold">Date de naissance<input name="date_of_birth" type="date" required autoComplete="bday" className={champ} /></label>
          <label className="block text-sm font-semibold">Mot de passe provisoire<input name="motdepasse" type="password" minLength={12} required autoComplete="new-password" className={champ} /></label>
          <p className="text-xs text-slate-500">Communiquez ce mot de passe provisoire au nouveau membre de façon sûre, puis faites-le remplacer. Il n'est jamais affiché après la création.</p>
          <button className="btn btn-vert w-full" disabled={!pharmacyIds.length}>Créer et provisionner la Caisse</button>
        </form>
      </section>
    </main>
  );
}
