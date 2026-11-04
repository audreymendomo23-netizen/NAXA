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
    .select("id,pharmacie_id,actif")
    .eq("id", auth.user.id)
    .single();
  const { data: activeFunction, error: activeFunctionError } = await sb.rpc("naxa_business_function");
  const isPromoteur = !activeFunctionError && activeFunction === "promoteur";
  const isResponsable = !activeFunctionError && activeFunction === "responsable"
    && Boolean(profile?.pharmacie_id);
  if (!profile || (!isPromoteur && !isResponsable)) redirect("/pharmacie");
  if (profile.actif !== true) redirect(isPromoteur ? "/pharmacie/promoteur" : "/pharmacie");

  let pharmacyIds: string[] = [];
  let pharmacies: { id: string; nom: string; ville: string | null; quartier: string | null; actif: boolean; visible_recherche: boolean }[] = [];
  let linksError: any = null;
  let pharmaciesError: any = null;

  if (isResponsable) {
    pharmacyIds = [profile.pharmacie_id as string];
    const result = await sb.from("pharmacies")
      .select("id,nom,ville,quartier,actif,visible_recherche")
      .eq("id", pharmacyIds[0]).eq("actif", true).maybeSingle();
    pharmaciesError = result.error;
    if (result.data) pharmacies = [result.data];
  } else {
    const { data: links, error } = await sb.from("promoteur_pharmacies")
      .select("pharmacie_id").eq("promoteur_id", auth.user.id).eq("actif", true);
    linksError = error;
    if (!error && links?.length) {
      const linkedIds = [...new Set(links.map((link) => link.pharmacie_id))];
      const result = await sb.from("pharmacies")
        .select("id,nom,ville,quartier,actif,visible_recherche")
        .in("id", linkedIds).eq("actif", true);
      pharmaciesError = result.error;
      pharmacies = result.data ?? [];
      pharmacyIds = pharmacies.map((pharmacy) => pharmacy.id);
    }
  }
  if (linksError || pharmaciesError || !pharmacyIds.length) {
    redirect(isPromoteur ? "/pharmacie/promoteur" : "/pharmacie");
  }

  // Les droits sont vérifiés pharmacie par pharmacie : consultation d'équipe
  // et création sont deux capacités distinctes.
  const [viewPermissions, createPermissions] = await Promise.all([
    Promise.all(pharmacyIds.map((pharmacieId) => sb.rpc("naxa_can", {
      p_privilege: "VIEW_TEAM", p_pharmacie: pharmacieId, p_target: null,
    }))),
    Promise.all(pharmacyIds.map((pharmacieId) => sb.rpc("naxa_can", {
      p_privilege: "CREATE_CAISSE", p_pharmacie: pharmacieId, p_target: null,
    }))),
  ]);
  const canViewTeam = viewPermissions.some((permission) => !permission.error && permission.data === true);
  const creatablePharmacyIds = pharmacyIds.filter((_, index) =>
    !createPermissions[index]?.error && createPermissions[index]?.data === true
  );
  if (!canViewTeam && !creatablePharmacyIds.length) redirect(isPromoteur ? "/pharmacie/promoteur" : "/pharmacie");

  const { data: assignmentRows, error: assignmentError } = await sb.from("naxa_professional_assignments")
    .select("id,profile_id,pharmacie_id,statut,commence_at,expire_at,created_at")
    .eq("role_code", "caisse")
    .in("pharmacie_id", pharmacyIds)
    .order("created_at", { ascending: false });
  const targetIds = [...new Set((assignmentRows ?? []).map((a) => a.profile_id))];
  const { data: targetProfiles, error: targetProfilesError } = targetIds.length
    ? await sb.from("profiles").select("id,username,first_name,last_name,actif,created_at").in("id", targetIds)
    : { data: [] as { id: string; username: string | null; first_name: string | null; last_name: string | null; actif: boolean; created_at: string }[], error: null };
  const targetById = new Map((targetProfiles ?? []).map((p) => [p.id, p] as const));
  const seenAssignments = new Set<string>();
  const caisses = (assignmentRows ?? []).flatMap((assignment) => {
    const key = assignment.profile_id + ":" + assignment.pharmacie_id;
    if (seenAssignments.has(key)) return [];
    seenAssignments.add(key);
    const target = targetById.get(assignment.profile_id);
    if (!target) return [];
    const withinPeriod = new Date(assignment.commence_at).getTime() <= Date.now()
      && (assignment.expire_at === null || new Date(assignment.expire_at).getTime() > Date.now());
    return [{
      id: target.id,
      username: target.username,
      first_name: target.first_name,
      last_name: target.last_name,
      actif: target.actif === true && assignment.statut === "active" && withinPeriod,
      pharmacie_id: assignment.pharmacie_id,
      created_at: assignment.created_at,
    }];
  });
  const caissesError = assignmentError ?? targetProfilesError;

  const { data: architectureRows, error: architectureError } = await sb.from("pharmacie_architectures")
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
        <Link href={isPromoteur ? "/pharmacie/promoteur" : "/pharmacie"} className="font-bold underline">← {isPromoteur ? "Espace Promoteur" : "Espace Responsable"}</Link>
        <span className="font-semibold">Gestion de l'équipe</span>
        {isPromoteur && <Link href="/pharmacie/caisses/privileges" className="rounded-full border border-white px-3 py-2 text-sm font-semibold">Droits d’accès</Link>}
      </header>

      <section className="carte">
        <h1 className="text-xl font-extrabold">Mes Caisses</h1>
        <p className="mt-1 text-sm text-slate-600">Attribuez un accès professionnel à une personne qui possède déjà un compte utilisateur NAXA. Son compte Auth et ses éventuels autres postes sont conservés ; seul le poste Caisse est attribué ou révoqué.</p>
      </section>

      {searchParams.ok && <p role="status" className="carte">Opération terminée : {searchParams.ok === "creation" ? "Caisse créée et provisionnée." : searchParams.ok === "blocage" ? "Caisse bloquée." : "Caisse réactivée."}</p>}
      {searchParams.erreur && <p role="alert" className="carte text-red-700">{errors[searchParams.erreur] ?? "Impossible d'effectuer cette opération."}</p>}
      {(linksError || caissesError || architectureError) && <p role="alert" className="carte text-red-700">Impossible de charger le réseau, les comptes Caisse ou les quotas d’architecture. La liste et la création sont suspendues pour éviter d’afficher un réseau vide ou un quota erroné. Réessayez après vérification de la connexion.</p>}

      <section className="carte space-y-3">
        <h2 className="text-lg font-bold">Comptes existants</h2>
        {caissesError ? null : caisses?.length ? caisses.map((c) => {
          const ph = c.pharmacie_id ? pharmacyById.get(c.pharmacie_id) : null;
          return (
            <article key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
              <div>
                <p className="font-bold">{c.first_name} {c.last_name}</p>
                <p className="text-sm text-slate-600">@{c.username} · {ph?.nom ?? "Pharmacie non identifiée"} · {c.actif ? "Actif" : "Bloqué"}</p>
              </div>
              {c.actif ? (
                <form action={bloquerCaisse}><input type="hidden" name="caisse_id" value={c.id} /><input type="hidden" name="pharmacie_id" value={c.pharmacie_id ?? ""} /><button className="btn btn-clair">Suspendre le poste</button></form>
              ) : (
                <form action={reactiverCaisse}><input type="hidden" name="caisse_id" value={c.id} /><input type="hidden" name="pharmacie_id" value={c.pharmacie_id ?? ""} /><button className="btn btn-canari">Réactiver le poste</button></form>
              )}
            </article>
          );
        }) : <p className="text-sm text-slate-600">Aucun poste Caisse rattaché à votre périmètre pour le moment.</p>}
      </section>

      <section className="carte space-y-3">
        <h2 className="text-lg font-bold">Attribuer le poste Caisse</h2>
        {!creatablePharmacyIds.length && <p role="alert" className="text-sm text-amber-800">Votre rôle ne dispose pas du privilège de création de Caisse sur cette pharmacie. La consultation de l’équipe reste disponible si elle est autorisée.</p>}
        <form action={creerCaisse} className="space-y-3">
          <label className="block text-sm font-semibold">Pharmacie
            <select name="pharmacie_id" required disabled={!creatablePharmacyIds.length || Boolean(caissesError || architectureError)} className={champ} defaultValue="">
              <option value="" disabled>Choisir une pharmacie du réseau</option>
              {(pharmacies ?? []).filter((p) => creatablePharmacyIds.includes(p.id)).map((p) => {
                const a = archById.get(p.id);
                const max = a?.max_caisses;
                const active = countActive(p.id);
                const reached = max != null && active >= max;
                 const unavailable = !a;
                 const quotaLabel = unavailable ? "architecture indisponible" : String(active) + "/" + (max ?? "∞") + " Caisse(s) active(s)";
                return <option key={p.id} value={p.id} disabled={reached || unavailable || Boolean(caissesError || architectureError)}>{p.nom} — {p.ville ?? "Ville non renseignée"} · {quotaLabel}{reached ? " · quota atteint" : ""}</option>;
              })}
            </select>
          </label>
          <label className="block text-sm font-semibold">Nom d’utilisateur NAXA de la personne
            <input name="username" required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9._-]{2,29}" autoComplete="off" className={champ} placeholder="ex. mariam237" />
          </label>
          <p className="text-xs leading-5 text-slate-600">La personne doit avoir créé et validé son compte NAXA au préalable. Son nom d’utilisateur est unique : ne demandez ni son mot de passe ni son code OTP. NAXA vérifie le compte côté serveur avant l’attribution.</p>
          <button className="btn btn-vert w-full" disabled={!creatablePharmacyIds.length || Boolean(caissesError || architectureError)}>Attribuer le poste Caisse</button>
        </form>
      </section>
    </main>
  );
}
