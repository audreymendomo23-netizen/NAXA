"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseServer, supabaseAdmin } from "@/lib/supabase/server";

const CANAUX = new Set(["orange_money", "mtn_momo", "virement", "depot_bancaire", "especes", "autre"]);

export async function soumettrePaiementPromoteur(formData: FormData) {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect("/connexion");
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "promoteur") redirect("/pharmacie/promoteur");

  const montant = Number(formData.get("montant"));
  const canal = String(formData.get("canal") ?? "");
  const canalAutre = String(formData.get("canal_autre") ?? "").trim();
  const comptePayeur = String(formData.get("compte_payeur") ?? "").trim();
  const reference = String(formData.get("reference") ?? "").trim();
  const payeLeRaw = String(formData.get("paye_le") ?? "").trim();
  const preuve = formData.get("preuve");

  if (!Number.isSafeInteger(montant) || montant <= 0 || !CANAUX.has(canal)) redirect("/promoteur/paiements?erreur=champs");
  if (canal === "autre" && (canalAutre.length < 2 || canalAutre.length > 80)) redirect("/promoteur/paiements?erreur=canal");
  if (comptePayeur.length < 3 || comptePayeur.length > 120) redirect("/promoteur/paiements?erreur=compte");
  if (!payeLeRaw) redirect("/promoteur/paiements?erreur=date");
  const payeLeDate = new Date(payeLeRaw + ":00+01:00");
  if (!Number.isFinite(payeLeDate.getTime()) || payeLeDate.getTime() > Date.now() + 5 * 60_000) redirect("/promoteur/paiements?erreur=date");
  if (!(preuve instanceof File) || preuve.size <= 0 || preuve.size > 25 * 1024 * 1024) redirect("/promoteur/paiements?erreur=preuve");

  const extensions: Record<string, string> = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
  };
  const extension = extensions[preuve.type];
  if (!extension) redirect("/promoteur/paiements?erreur=format");

  const db = supabaseAdmin();
  const proofPath = user.id + "/" + crypto.randomUUID() + "." + extension;
  const { error: uploadError } = await db.storage.from("preuves-reglements-promoteurs").upload(proofPath, preuve, {
    contentType: preuve.type,
    upsert: false,
  });
  if (uploadError) redirect("/promoteur/paiements?erreur=upload");

  const { error } = await db.rpc("promoteur_soumettre_reglement", {
    p_promoteur: user.id,
    p_montant: montant,
    p_canal: canal,
    p_canal_autre: canalAutre || null,
    p_compte_payeur: comptePayeur,
    p_reference: reference || null,
    p_paye_le: payeLeDate.toISOString(),
    p_preuve_path: proofPath,
  });
  if (error) {
    await db.storage.from("preuves-reglements-promoteurs").remove([proofPath]);
    const message = error.message.toLowerCase();
    const code = message.includes("attente") ? "deja_attente" : message.includes("montant") ? "montant" : "soumission";
    redirect("/promoteur/paiements?erreur=" + code);
  }

  revalidatePath("/promoteur/paiements");
  revalidatePath("/admin/pilotage/reglements");
  revalidatePath("/notifications");
  redirect("/promoteur/paiements?ok=soumis");
}
