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
  if (!/^[0-9a-f-]{36}$/i.test(periode)) return redirectResult(request, "periode_invalide");

  const admin = supabaseAdmin();
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
