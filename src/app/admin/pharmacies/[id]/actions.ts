"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

const TYPES = new Set(["existence_legale","registre_commerce","niu","attestation_non_redevance","plan_localisation","cni_promoteur","autre"]);
const MIME = new Set(["application/pdf","image/jpeg","image/png","image/webp"]);

async function requireAdmin() {
  const sb = supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) throw new Error("Authentification requise.");
  const { data: profile } = await sb.from("profiles").select("role,actif").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" || profile.actif !== true) throw new Error("Accès administrateur requis.");
  return user;
}

export async function deposerDocumentPharmacie(formData: FormData) {
  const user = await requireAdmin();
  const pharmacieId = String(formData.get("pharmacie_id") ?? "");
  const type = String(formData.get("type_document") ?? "");
  const file = formData.get("fichier");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(pharmacieId) || !TYPES.has(type) || !(file instanceof File) || file.size < 1 || file.size > 10 * 1024 * 1024 || !MIME.has(file.type)) {
    redirect("/admin/pharmacies/" + pharmacieId + "?erreur=document");
  }
  const db = supabaseAdmin();
  const { data: pharmacy } = await db.from("pharmacies").select("id").eq("id", pharmacieId).maybeSingle();
  if (!pharmacy) redirect("/admin/pharmacies/" + pharmacieId + "?erreur=pharmacie");
  const ext = ({ "application/pdf":"pdf", "image/jpeg":"jpg", "image/png":"png", "image/webp":"webp" } as Record<string,string>)[file.type];
  const objectPath = pharmacieId + "/" + crypto.randomUUID() + "." + ext;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: uploadError } = await db.storage.from("pharmacie-documents").upload(objectPath, bytes, { contentType:file.type, upsert:false });
  if (uploadError) redirect("/admin/pharmacies/" + pharmacieId + "?erreur=stockage");
  const { error: insertError } = await db.from("pharmacie_documents").insert({
    pharmacie_id:pharmacieId, type_document:type, nom_fichier:file.name.slice(0,255),
    bucket_id:"pharmacie-documents", object_path:objectPath, mime_type:file.type,
    taille_octets:file.size, recu_par:user.id
  });
  if (insertError) {
    await db.storage.from("pharmacie-documents").remove([objectPath]);
    redirect("/admin/pharmacies/" + pharmacieId + "?erreur=registre");
  }
  revalidatePath("/admin/pharmacies/" + pharmacieId);
  redirect("/admin/pharmacies/" + pharmacieId + "?ok=document");
}

export async function statuerDocumentPharmacie(formData: FormData) {
  const user = await requireAdmin();
  const pharmacieId = String(formData.get("pharmacie_id") ?? "");
  const documentId = String(formData.get("document_id") ?? "");
  const statut = String(formData.get("statut") ?? "");
  const motif = String(formData.get("motif") ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(pharmacieId) || !/^[0-9a-f-]{36}$/i.test(documentId) || !["valide","rejete"].includes(statut) || (statut === "rejete" && motif.length < 5)) {
    redirect("/admin/pharmacies/" + pharmacieId + "?erreur=decision");
  }
  const db = supabaseAdmin();
  const { data: doc } = await db.from("pharmacie_documents").select("id,pharmacie_id,statut_validation").eq("id", documentId).eq("pharmacie_id", pharmacieId).maybeSingle();
  if (!doc) redirect("/admin/pharmacies/" + pharmacieId + "?erreur=document-introuvable");
  if (doc.statut_validation !== "en_attente") redirect("/admin/pharmacies/" + pharmacieId + "?erreur=deja-traite");
  const { data: decision, error } = await db.from("pharmacie_documents").update({
    statut_validation:statut, note_validation:motif || null, valide_par:user.id, valide_le:new Date().toISOString()
  }).eq("id", documentId).eq("pharmacie_id", pharmacieId).eq("statut_validation", "en_attente").select("id").maybeSingle();
  if (error || !decision) redirect("/admin/pharmacies/" + pharmacieId + "?erreur=deja-traite");
  revalidatePath("/admin/pharmacies/" + pharmacieId);
  redirect("/admin/pharmacies/" + pharmacieId + "?ok=decision");
}
