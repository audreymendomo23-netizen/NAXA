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

  // Un lien actif ne suffit pas : une pharmacie suspendue ou masquée ne doit
  // ni exposer ses Caisses ni permettre d'en créer/réactiver.
  const linkedIds = [...new Set(links.map((link) => link.pharmacie_id))];
  const { data: linkedPharmacies, error: pharmaciesError } = await sb.from("pharmacies")
    .select("id,nom,ville,quartier,actif,visible_recherche")
    .in("id", linkedIds);
  if (pharmaciesError) redirect("/pharmacie/promoteur");
  const pharmacies = (linkedPharmacies ?? []).filter((pharmacy) => pharmacy.actif === true && pharmacy.visible_recherche === true);
  const pharmacyIds = pharmacies.map((pharmacy) => pharmacy.id);
  if (!pharmacyIds.length) redirect("/pharmacie/promoteur");

  // Le moteur commercial et les privilèges doivent autoriser au moins une
  // pharmacie du périmètre réellement opérationnel.
  const permissions = await Promise.all(pharmacyIds.map((pharmacieId) => sb.rpc("naxa_can", {
    p_privilege: "MANAGE_CAISSES",
    p_pharmacie: pharmacieId,
    p_target: null,
  })));
  if (!permissions.some((permission) => !permission.error && permission.data === true)) {
    redirect("/pharmacie/promoteur");
  }

  const { data: caisses, error: caissesError } = await sb.from("profiles")
    .select("id,username,first_name,last_name,actif,pharmacie_id,created_at")
    .eq("parent_profile_id", auth.user.id)
    .eq("role", "caisse")
    .in("pharmacie_id", pharmacyIds)
    .order("created_at", { ascending: true });

  const { data: architectureRows } = await sb.from("pharmacie_architectures")
    .select("pharmacie_id,architecture_code,max_caisses")
    .in("pharmacie_id", pharmacyIds)
    .eq("active", true);
  const pharmacyById = new Map((pharmacies ?? []).map((p) => [p.id, p] as const));
  const archById = new Map((architectureRows ?? []).map((a) => [a.pharmacie_id, a] as const));
  const countActive = (id: string) => (caisses ?? []).filter((c) => c.pharmacie_id === id && c.actif).length;
  const champ = "champ mt-1";

  const errors: Record<string, string> = {
    validation: "Saisissez un nom d’utilisateur NAXA valide et choisissez une pharmacie de votre réseau.",
    perimetre: "Cette pharmacie ne fait pas partie de votre réseau actif.",
    autorisation: "Action refusée par le moteur d'autorisation ou quota indisponible.",
    creation: "Le compte professionnel n'a pas pu être attribué.",
    profil: "Le profil utilisateur n'a pas pu être préparé pour l'attribution professionnelle.",
    provisionnement: "La pharmacie, son architecture ou son quota refuse cette attribution. Le profil utilisateur initial a été restauré si nécessaire.",
    cible: "Compte Caisse manquant.",
    lookup: "Impossible de rechercher ce nom d’utilisateur. Réessayez.",
    compte_introuvable: "Aucun compte NAXA unique ne correspond à ce nom d’utilisateur.",
    compte_non_eligible: "Ce compte doit être un compte utilisateur NAXA actif, complet et vérifié avant son attribution professionnelle.",
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-16">
      <header className="-mx-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white">
        <Link href="/pharmacie/promoteur" className="font-bold underline">← Espace Promoteur</Link>
        <span className="font-semibold">Gestion de l'équipe</span>
        <Link href="/pharmacie/caisses/privileges" className="rounded-full border border-white px-3 py-2 text-sm font-semibold">Droits d'accès</Link>
      </header>

      <section className="carte">
        <h1 className="text-xl font-extrabold">Mes Caisses</h1>
        <p className="mt-1 text-sm text-slate-600">Attribuez un accès professionnel à une personne qui possède déjà un compte utilisateur NAXA. Son identité et ses données client sont conservées ; les droits pharmacie restent révocables.</p>
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
        <h2 className="text-lg font-bold">Attribuer un accès Caissière</h2>
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
          <label className="block text-sm font-semibold">Nom d’utilisateur NAXA de la personne
            <input name="username" required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9._-]{2,29}" autoComplete="off" className={champ} placeholder="ex. mariam237" />
          </label>
          <p className="text-xs leading-5 text-slate-600">La personne doit avoir créé et validé son compte NAXA au préalable. Son nom d’utilisateur est unique : ne demandez ni son mot de passe ni son code OTP. NAXA vérifie le compte côté serveur avant l’attribution.</p>
          <button className="btn btn-vert w-full" disabled={!pharmacyIds.length}>Attribuer l’accès Caissière</button>
        </form>
      </section>
    </main>
  );
}
