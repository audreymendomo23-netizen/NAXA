import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const redirectResult = (request: Request, result: string) =>
  NextResponse.redirect(new URL("/pharmacie/comptable/clotures?result=" + encodeURIComponent(result), request.url), 303);

export async function POST(request: Request) {
  const sb = supabaseServer();
  const { data: auth, error: authError } = await sb.auth.getUser();
  if (authError || !auth.user) return redirectResult(request, "authentification_requise");

  const { data: profile, error: profileError } = await sb.from("profiles")
    .select("id,actif,pharmacie_id").eq("id", auth.user.id).single();
  if (profileError || !profile || profile.actif !== true || !profile.pharmacie_id) {
    return redirectResult(request, "acces_refuse");
  }
  const { data: allowed, error: permissionError } = await sb.rpc("naxa_can", {
    p_privilege: "MANAGE_ACCOUNTING", p_pharmacie: profile.pharmacie_id, p_target: null,
  });
  if (permissionError || allowed !== true) return redirectResult(request, "acces_refuse");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return redirectResult(request, "formulaire_invalide");
  }
  const action = String(form.get("action") ?? "");
  const periode = String(form.get("periode") ?? "");
  const admin = supabaseAdmin();

  if (action === "ouvrir") {
    const debut = String(form.get("date_debut") ?? "");
    const fin = String(form.get("date_fin") ?? "");
    const validIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
      && !Number.isNaN(new Date(value + "T00:00:00Z").getTime())
      && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;
    if (!validIsoDate(debut) || !validIsoDate(fin) || debut > fin) {
      return redirectResult(request, "dates_periode_invalides");
    }
    const { error } = await admin.rpc("compta_ouvrir_periode", {
      p_pharmacie: profile.pharmacie_id,
      p_date_debut: debut,
      p_date_fin: fin,
      p_acteur: auth.user.id,
    });
    if (error) {
      const overlap = /chevauche/i.test(error.message ?? "");
      return redirectResult(request, overlap ? "chevauchement_periode" : "ouverture_refusee");
    }
    return redirectResult(request, "periode_ouverte");
  }

  if (!/^[0-9a-f-]{36}$/i.test(periode)) return redirectResult(request, "periode_invalide");
  if (action === "controle") {
    const code = String(form.get("controle_code") ?? "");
    const statut = String(form.get("statut") ?? "");
    const reference = String(form.get("reference_preuve") ?? "").trim();
    const motif = String(form.get("motif") ?? "").trim();
    const codes = ["dotations", "paie", "tva", "stock", "rapprochements", "regularisations", "a_nouveaux"];
    if (!codes.includes(code) || !["a_controler", "valide", "non_applicable"].includes(statut)) {
      return redirectResult(request, "controle_invalide");
    }
    const { error } = await admin.rpc("compta_enregistrer_controle_cloture", {
      p_pharmacie: profile.pharmacie_id,
      p_periode: periode,
      p_controle_code: code,
      p_statut: statut,
      p_reference_preuve: reference || null,
      p_motif: motif || null,
      p_acteur: auth.user.id,
    });
    return redirectResult(request, error ? "enregistrement_refuse" : "controle_enregistre");
  }

  if (action === "cloturer") {
    const { error } = await admin.rpc("compta_cloturer_periode", {
      p_pharmacie: profile.pharmacie_id,
      p_periode: periode,
      p_acteur: auth.user.id,
    });
    return redirectResult(request, error ? "cloture_refusee" : "periode_cloturee");
  }

  return redirectResult(request, "action_inconnue");
}
