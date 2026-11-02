"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdminActive } from "@/lib/admin/require-admin-active";
import { genererFiche } from "@/lib/ia";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function exigerAdmin() {
  const { sb } = await requireAdminActive("/admin/produits");
  return sb;
}
const texte = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max) || null;

export async function enregistrerFiche(formData: FormData) {
  const sb = await exigerAdmin();
  const id = String(formData.get("id") ?? "");
  const retour = `/admin/produits?q=${encodeURIComponent(String(formData.get("q") ?? ""))}&statut=${encodeURIComponent(String(formData.get("statut") ?? "toutes"))}`;
  if (!UUID.test(id)) redirect(`${retour}&erreur=produit`);

  const validee = formData.get("validee") === "on";
  const synonymes = String(formData.get("synonymes") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const { data: updated, error } = await sb.from("produits").update({
    description: texte(formData, "description", 400), indications: texte(formData, "indications", 400),
    precautions: texte(formData, "precautions", 600), synonymes, fiche_validee: validee,
    source_fiche: validee ? "pharmacien" : "admin", fiche_maj: new Date().toISOString(),
  }).eq("id", id).select("id").maybeSingle();

  revalidatePath("/admin/produits");
  if (error || updated?.id !== id) redirect(`${retour}&erreur=enregistrement`);
  redirect(`${retour}&ok=1`);
}

export async function brouillonIA(formData: FormData) {
  const sb = await exigerAdmin();
  const id = String(formData.get("id") ?? "");
  const retour = `/admin/produits?q=${encodeURIComponent(String(formData.get("q") ?? ""))}&statut=${encodeURIComponent(String(formData.get("statut") ?? "toutes"))}`;
  if (!UUID.test(id)) redirect(`${retour}&erreur=produit`);

  const { data: p, error: productError } = await sb.from("produits").select("nom,dci,dosage,forme").eq("id", id).maybeSingle();
  if (productError || !p) redirect(`${retour}&erreur=produit`);

  let fiche: Awaited<ReturnType<typeof genererFiche>>;
  try {
    fiche = await genererFiche(p);
  } catch {
    redirect(`${retour}&erreur=ia`);
  }

  const { data: updated, error: updateError } = await sb.from("produits")
    .update({ ...fiche, source_fiche: "ia", fiche_validee: false, fiche_maj: new Date().toISOString() })
    .eq("id", id).select("id").maybeSingle();
  if (updateError || updated?.id !== id) redirect(`${retour}&erreur=enregistrement`);

  revalidatePath("/admin/produits");
  redirect(`${retour}&ok=ia`);
}
