"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { genererFiche } from "@/lib/ia";

async function exigerAdmin() {
  const sb = supabaseServer();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion?retour=/admin/produits");
  const { data: p } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
  if (p?.role !== "admin") redirect("/");
  return sb;
}
const texte = (f: FormData, k: string, max: number) => String(f.get(k) ?? "").trim().slice(0, max) || null;
export async function enregistrerFiche(formData: FormData) {
  const sb = await exigerAdmin();
  const id = String(formData.get("id"));
  const validee = formData.get("validee") === "on";
  const synonymes = String(formData.get("synonymes") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const { error } = await sb.from("produits").update({
    description: texte(formData, "description", 400), indications: texte(formData, "indications", 400),
    precautions: texte(formData, "precautions", 600), synonymes, fiche_validee: validee,
    source_fiche: validee ? "pharmacien" : "admin", fiche_maj: new Date().toISOString(),
  }).eq("id", id);
  revalidatePath("/admin/produits");
  redirect(`/admin/produits?q=${encodeURIComponent(String(formData.get("q") ?? ""))}${error ? "&erreur=enregistrement" : "&ok=1"}`);
}
export async function brouillonIA(formData: FormData) {
  const sb = await exigerAdmin();
  const id = String(formData.get("id"));
  const retour = `/admin/produits?q=${encodeURIComponent(String(formData.get("q") ?? ""))}`;
  const { data: p } = await sb.from("produits").select("nom,dci,dosage,forme").eq("id", id).single();
  if (!p) redirect(`${retour}&erreur=produit`);
  try {
    const fiche = await genererFiche(p);
    await sb.from("produits").update({ ...fiche, source_fiche: "ia", fiche_validee: false, fiche_maj: new Date().toISOString() }).eq("id", id);
  } catch (e) { redirect(`${retour}&erreur=${encodeURIComponent(e instanceof Error ? e.message : "ia")}`); }
  revalidatePath("/admin/produits");
  redirect(`${retour}&ok=ia`);
}