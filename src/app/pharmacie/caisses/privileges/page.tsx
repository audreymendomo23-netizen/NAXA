import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { attribuerPrivilegeCaisse, retirerPrivilegeCaisse } from "./actions";

type SearchParams = { ok?: string; erreur?: string };

export default async function PrivilegesCaissesPage({ searchParams }: { searchParams: SearchParams }) {
  const sb = supabaseServer();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) redirect("/connexion?retour=/pharmacie/caisses/privileges");

  const { data: profile } = await sb.from("profiles")
    .select("id,actif,pharmacie_id")
    .eq("id", auth.user.id)
    .single();
  const { data: activeFunction, error: activeFunctionError } = await sb.rpc("naxa_business_function");
  if (profile?.actif !== true || activeFunctionError) redirect("/pharmacie");
  const isPromoteur = activeFunction === "promoteur";
  const isResponsable = activeFunction === "responsable" && Boolean(profile.pharmacie_id);
  if (!isPromoteur && !isResponsable) redirect("/pharmacie");

  let ids: string[];
  if (isResponsable) {
    const { data: canView, error } = await sb.rpc("naxa_can", {
      p_privilege: "VIEW_PRIVILEGES", p_pharmacie: profile.pharmacie_id, p_target: null,
    });
    if (error || canView !== true) redirect("/pharmacie");
    ids = [profile.pharmacie_id as string];
  } else {
    const { data: links, error: linksError } = await sb.from("promoteur_pharmacies")
      .select("pharmacie_id").eq("promoteur_id", auth.user.id).eq("actif", true);
    if (linksError || !links?.length) redirect("/pharmacie/promoteur");
    ids = [...new Set(links.map((link) => link.pharmacie_id))];
  }
  const [{ data: pharmacies, error: pharmaciesError }, { data: cashierAssignments, error: assignmentError }, { data: privileges, error: privilegesError }] = await Promise.all([
    sb.from("pharmacies").select("id,nom,actif,visible_recherche").in("id", ids),
    sb.from("naxa_professional_assignments").select("id,profile_id,pharmacie_id,commence_at,expire_at,created_at")
      .eq("role_code", "caisse").eq("statut", "active").in("pharmacie_id", ids),
    sb.from("naxa_privileges").select("code,libelle,famille,niveau_min,niveau_max,delegable,governance,governance_only,active")
      .eq("active", true).eq("delegable", true).eq("governance", false),
  ]);

  const operationalPharmacies = (pharmacies ?? []).filter((p) => p.actif === true && p.visible_recherche === true);
  const operationalIds = new Set(operationalPharmacies.map((p) => p.id));
  const targetIds = [...new Set((cashierAssignments ?? []).map((a) => a.profile_id))];
  const { data: targetProfiles, error: caissesError } = targetIds.length
    ? await sb.from("profiles").select("id,username,first_name,last_name,actif").in("id", targetIds).eq("actif", true)
    : { data: [] as { id: string; username: string | null; first_name: string | null; last_name: string | null; actif: boolean }[], error: null };
  const targetById = new Map((targetProfiles ?? []).map((p) => [p.id, p] as const));
  const { data: pharmacyArchitectures, error: pharmacyArchitectureError } = await sb.from("pharmacie_architectures")
    .select("pharmacie_id,architecture_code").in("pharmacie_id", ids).eq("active", true);
  const architectureByPharmacy = new Map((pharmacyArchitectures ?? []).map((a) => [a.pharmacie_id, a.architecture_code] as const));
  const team = (cashierAssignments ?? []).flatMap((assignment) => {
    if (!operationalIds.has(assignment.pharmacie_id)
      || new Date(assignment.commence_at).getTime() > Date.now()
      || (assignment.expire_at && new Date(assignment.expire_at).getTime() <= Date.now())) return [];
    const target = targetById.get(assignment.profile_id);
    if (!target) return [];
    return [{
      ...target,
      id: target.id,
      pharmacie_id: assignment.pharmacie_id,
      architecture_code: architectureByPharmacy.get(assignment.pharmacie_id) ?? null,
    }];
  });
  const teamIds = team.map((c) => c.id);
  const [assignPermissions, revokePermissions, architectureRows, assignedRows] = await Promise.all([
    Promise.all(team.map(async (c) => {
      const result = await sb.rpc("naxa_can", { p_privilege: "ASSIGN_PRIVILEGE", p_pharmacie: c.pharmacie_id, p_target: c.id });
      return [c.id, !result.error && result.data === true] as const;
    })),
    Promise.all(team.map(async (c) => {
      const result = await sb.rpc("naxa_can", { p_privilege: "REVOKE_PRIVILEGE", p_pharmacie: c.pharmacie_id, p_target: c.id });
      return [c.id, !result.error && result.data === true] as const;
    })),
    sb.from("naxa_architecture_privileges").select("architecture_code,role_key,privilege_code")
      .eq("role_key", "caisse"),
    teamIds.length
      ? sb.from("naxa_profile_privileges").select("profile_id,privilege_code,pharmacie_id,scope_type,active,revoked_at,granted_by")
          .in("profile_id", teamIds).eq("scope_type", "POSTE_CAISSE")
      : Promise.resolve({ data: [], error: null }),
  ]);

  const permissionByTarget = new Map(assignPermissions);
  const revokePermissionByTarget = new Map(revokePermissions);
  const allowedByArchitecture = new Map<string, Set<string>>();
  for (const row of architectureRows.data ?? []) {
    if (!allowedByArchitecture.has(row.architecture_code)) allowedByArchitecture.set(row.architecture_code, new Set());
    allowedByArchitecture.get(row.architecture_code)?.add(row.privilege_code);
  }
  const catalog = (privileges ?? []).filter((p) => p.niveau_min <= 3 && p.niveau_max >= 3 && p.governance_only !== true);
  const pharmacyById = new Map(operationalPharmacies.map((p) => [p.id, p] as const));
  const privilegeByCode = new Map(catalog.map((p) => [p.code, p] as const));
  const assigned = assignedRows.data ?? [];
  const loadError = pharmaciesError || assignmentError || caissesError || pharmacyArchitectureError || privilegesError || architectureRows.error || assignedRows.error;
  const errorText: Record<string, string> = {
    validation: "La cible, la pharmacie ou le privilège demandé est invalide.",
    autorisation: "Action refusée : vérifiez le contrat, le périmètre et les privilèges de délégation.",
    indisponible: "Le catalogue ou les affectations de privilèges ne peuvent pas être chargés.",
    cible: "Cette Caisse n'est pas une Caisse active de votre réseau.",
  };

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 pb-16">
      <header className="-mx-4 flex flex-wrap items-center justify-between gap-3 bg-naxa-green-900 px-4 py-3 text-white">
        <Link href="/pharmacie/caisses" className="font-bold underline">← Mes Caisses</Link>
        <span className="font-semibold">Droits d'accès</span>
      </header>
      <section className="carte">
        <h1 className="text-xl font-extrabold">Privilèges des Caisses</h1>
        <p className="mt-1 text-sm text-slate-600">Les droits sont attribués individuellement, dans le périmètre de la pharmacie et selon l'architecture NAXA. Les privilèges de gouvernance et ceux hors niveau Caisse ne sont jamais proposés.</p>
      </section>
      {searchParams.ok && <p role="status" className="carte">{searchParams.ok === "attribution" ? "Privilège attribué." : "Privilège retiré."}</p>}
      {searchParams.erreur && <p role="alert" className="carte text-red-700">{errorText[searchParams.erreur] ?? "Action impossible."}</p>}
      {loadError && <p role="alert" className="carte text-red-700">Le catalogue ou le périmètre est indisponible. Par sécurité, aucune attribution n'est proposée.</p>}
      {!loadError && team.length === 0 && <p className="carte text-sm text-slate-600">Aucune Caisse active n'est rattachée à une pharmacie opérationnelle du réseau.</p>}
      {!loadError && team.map((c) => {
        const pharmacy = c.pharmacie_id ? pharmacyById.get(c.pharmacie_id) : null;
        const allowed = allowedByArchitecture.get(c.architecture_code ?? "") ?? new Set<string>();
        const options = catalog.filter((p) => allowed.has(p.code));
        const current = assigned.filter((row) => row.profile_id === c.id && row.pharmacie_id === c.pharmacie_id && row.active && !row.revoked_at);
        return (
          <section key={c.id} className="carte space-y-3">
            <div>
              <h2 className="font-extrabold">{c.first_name} {c.last_name} · @{c.username}</h2>
              <p className="text-sm text-slate-600">{pharmacy?.nom ?? "Pharmacie"} · {current.length} privilège(s) de poste attribué(s)</p>
            </div>
            {!permissionByTarget.get(c.id) && <p className="text-sm text-amber-800">Votre rôle ou votre contrat ne permet pas de déléguer des privilèges à cette Caisse.</p>}
            {permissionByTarget.get(c.id) && (
              <form action={attribuerPrivilegeCaisse} className="flex flex-col gap-2 sm:flex-row">
                <input type="hidden" name="caisse_id" value={c.id} />
                <input type="hidden" name="pharmacie_id" value={c.pharmacie_id ?? ""} />
                <label className="flex-1 text-sm font-semibold">Privilège
                  <select name="privilege_code" required defaultValue="" className="champ mt-1">
                    <option value="" disabled>Choisir un droit autorisé</option>
                    {options.map((p) => <option key={p.code} value={p.code}>{p.libelle} · {p.code}</option>)}
                  </select>
                </label>
                <button className="btn btn-vert self-end">Attribuer</button>
              </form>
            )}
            {current.length > 0 && <ul className="space-y-2">
              {current.map((row) => {
                const p = privilegeByCode.get(row.privilege_code);
                return (
                  <li key={row.privilege_code} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                    <span className="text-sm">{p?.libelle ?? row.privilege_code}</span>
                    {revokePermissionByTarget.get(c.id) && <form action={retirerPrivilegeCaisse}>
                      <input type="hidden" name="caisse_id" value={c.id} />
                      <input type="hidden" name="pharmacie_id" value={c.pharmacie_id ?? ""} />
                      <input type="hidden" name="privilege_code" value={row.privilege_code} />
                      <button className="btn btn-clair">Retirer</button>
                    </form>}
                  </li>
                );
              })}
            </ul>}
          </section>
        );
      })}
      <p className="text-xs leading-5 text-slate-500">La base de données revérifie chaque attribution et révocation. L'interface ne peut pas étendre l'architecture, le niveau hiérarchique, le réseau ou la validité commerciale.</p>
    </main>
  );
}
