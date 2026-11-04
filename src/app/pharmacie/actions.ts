"use server";

import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import { isFinalizedNaxaProfile } from "@/lib/auth/finalized-profile";

async function exigerGestionEquipe() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion?retour=/pharmacie/caisses");
  const { data: p } = await sb
    .from("profiles")
    .select("id,pharmacie_id,actif")
    .eq("id", u.user.id)
    .single();
  const { data: activeFunction, error: activeFunctionError } = await sb.rpc("naxa_business_function");
  const promoteur = !activeFunctionError && activeFunction === "promoteur";
  const responsable = !activeFunctionError && activeFunction === "responsable"
    && Boolean(p?.pharmacie_id);
  if (!p || (!promoteur && !responsable)) redirect("/");
  if (p.actif !== true) redirect(promoteur ? "/pharmacie/promoteur" : "/pharmacie");
  return { userId: u.user.id, sb, profile: p, promoteur, responsable };
}

const value = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function creerCaisse(formData: FormData) {
  const { userId, sb, profile, promoteur, responsable } = await exigerGestionEquipe();
  const pharmacieId = value(formData, "pharmacie_id");
  const username = value(formData, "username").toLowerCase();

  if (!pharmacieId || !/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    redirect("/pharmacie/caisses?erreur=validation");
  }

  if (promoteur) {
    const { data: lien, error: lienError } = await sb
      .from("promoteur_pharmacies")
      .select("pharmacie_id")
      .eq("promoteur_id", userId)
      .eq("pharmacie_id", pharmacieId)
      .eq("actif", true)
      .maybeSingle();
    if (lienError || !lien) redirect("/pharmacie/caisses?erreur=perimetre");
  } else if (responsable && profile.pharmacie_id !== pharmacieId) {
    redirect("/pharmacie/caisses?erreur=perimetre");
  }
  const { data: pharmacy, error: pharmacyError } = await sb.from("pharmacies")
    .select("id,actif").eq("id", pharmacieId).maybeSingle();
  if (pharmacyError || !pharmacy?.actif) redirect("/pharmacie/caisses?erreur=perimetre");

  const { data: autorise, error: authError } = await sb.rpc("naxa_can", {
    p_privilege: "CREATE_CAISSE",
    p_pharmacie: pharmacieId,
    p_target: null,
  });
  if (authError || autorise !== true) redirect("/pharmacie/caisses?erreur=autorisation");

  const db = supabaseAdmin();
  const { data: matches, error: lookupError } = await db
    .from("profiles")
    .select("id,username,actif,first_name,last_name,phone,date_of_birth,age_verified,consent_accepted_at")
    .ilike("username", username)
    .limit(2);
  if (lookupError) redirect("/pharmacie/caisses?erreur=lookup");
  if (!matches || matches.length !== 1) redirect("/pharmacie/caisses?erreur=compte_introuvable");

  const target = matches[0];
  if (target.actif !== true || !target.first_name || !target.last_name
    || !target.phone || !target.date_of_birth || target.age_verified !== true || !target.consent_accepted_at) {
    redirect("/pharmacie/caisses?erreur=compte_non_eligible");
  }

  const { data: authData, error: authLookupError } = await db.auth.admin.getUserById(target.id);
  if (authLookupError || !authData.user
    || !isFinalizedNaxaProfile({ id: target.id, username: target.username ?? "" }, authData.user)) {
    redirect("/pharmacie/caisses?erreur=compte_non_eligible");
  }

  const { error: assignmentError } = await sb.rpc("naxa_grant_professional_assignment", {
    p_target: target.id,
    p_pharmacie: pharmacieId,
    p_fonction: "caisse",
    p_commence_at: new Date().toISOString(),
    p_expire_at: null,
    p_motif: "Attribution du poste Caisse depuis la gestion d’équipe NAXA.",
  });
  if (assignmentError) redirect("/pharmacie/caisses?erreur=provisionnement");

  redirect("/pharmacie/caisses?ok=creation");
}

async function changerStatutCaisse(formData: FormData, actif: boolean) {
  const { sb } = await exigerGestionEquipe();
  const caisseId = value(formData, "caisse_id");
  const pharmacieId = value(formData, "pharmacie_id");
  if (!caisseId || !pharmacieId) redirect("/pharmacie/caisses?erreur=cible");

  // La RPC révoque ou recrée l'affectation Caisse. Le compte Auth et ses autres
  // postes restent actifs ; seul le lien vers ce poste est suspendu/réactivé.
  const { error } = await sb.rpc("naxa_set_professional_assignment_status", {
    p_target: caisseId,
    p_pharmacie: pharmacieId,
    p_active: actif,
  });
  redirect(error
    ? "/pharmacie/caisses?erreur=autorisation"
    : actif
      ? "/pharmacie/caisses?ok=reactivation"
      : "/pharmacie/caisses?ok=blocage");
}

export async function bloquerCaisse(formData: FormData) {
  await changerStatutCaisse(formData, false);
}

export async function reactiverCaisse(formData: FormData) {
  await changerStatutCaisse(formData, true);
}
