import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

type Props={params:{id:string}};
export default async function PharmacieIndividuelle({params}:Props){
 const sb=supabaseServer();
 const{data:auth}=await sb.auth.getUser();
 if(!auth.user)redirect("/connexion?retour=/admin/pharmacies/"+params.id);
 const{data:profile}=await sb.from("profiles").select("role,actif").eq("id",auth.user.id).single();
 if(profile?.role!=="admin"||profile.actif!==true)redirect("/");
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(params.id))notFound();
 const db=supabaseAdmin();
 const [{data:pharmacy,error},{data:documents},{data:history}]=await Promise.all([
  db.from("pharmacies").select("id,nom,ville,quartier,adresse,actif,visible_recherche,created_at,stock_updated_at").eq("id",params.id).maybeSingle(),
  db.from("pharmacie_documents").select("id,type_document,nom_fichier,bucket_id,object_path,mime_type,taille_octets,statut_validation,note_validation,recu_le,valide_le,version").eq("pharmacie_id",params.id).order("recu_le",{ascending:false}),
  db.from("pharmacie_document_historique").select("document_id,action,ancien_statut,nouveau_statut,detail,cree_le").order("cree_le",{ascending:false}).limit(50)
 ]);
 if(error||!pharmacy)notFound();
 const docs=documents??[];
 const docsHistory=(history??[]).filter(h=>docs.some(d=>d.id===h.document_id));
 const status=pharmacy.actif&&pharmacy.visible_recherche?"Active et visible":pharmacy.actif?"Active, masquée":"Inactive";
 return <main className="mx-auto min-h-screen max-w-6xl space-y-5 px-3 py-5 sm:px-6">
  <Link href="/admin/promoteurs" className="inline-flex min-h-10 items-center font-semibold text-naxa-green-900 underline underline-offset-4">← Retour au registre des pharmacies</Link>
  <header className="rounded-3xl bg-naxa-green-900 p-5 text-white sm:p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-white/70">Espace administratif individuel</p><h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">{pharmacy.nom}</h1><p className="mt-2 text-sm text-white/80">{[pharmacy.quartier,pharmacy.ville].filter(Boolean).join(" · ")||"Localisation non renseignée"}</p><div className="mt-4 flex flex-wrap gap-2"><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{status}</span><span className="rounded-full bg-white/15 px-3 py-1 text-xs">Dossier isolé · accès administrateur</span></div></header>
  <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
   <article className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Identité et localisation</p><h2 className="mt-1 font-bold">{pharmacy.nom}</h2><p className="mt-1 break-words text-sm text-slate-600">{pharmacy.adresse||"Adresse non renseignée"}</p><p className="text-sm text-slate-600">{[pharmacy.quartier,pharmacy.ville].filter(Boolean).join(" · ")}</p><p className="mt-2 text-xs text-slate-500">Créée le {new Date(pharmacy.created_at).toLocaleDateString("fr-FR")}</p></article>
   <article className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Dossier documentaire</p><h2 className="mt-1 text-2xl font-black">{docs.length}</h2><p className="text-sm text-slate-600">Fichier(s) référencé(s)</p><p className="mt-2 text-sm">{docs.filter(d=>d.statut_validation==="valide").length} validé(s) · {docs.filter(d=>d.statut_validation==="en_attente").length} en attente · {docs.filter(d=>d.statut_validation==="rejete").length} rejeté(s)</p></article>
   <article className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">Visibilité Marketplace</p><h2 className="mt-1 font-bold">{pharmacy.visible_recherche?"Visible en recherche":"Masquée de la recherche"}</h2><p className="mt-1 text-sm text-slate-600">La visibilité n’est pas modifiée depuis cette page de consultation.</p></article>
  </section>
  <section className="space-y-3"><div><h2 className="text-xl font-extrabold">Fichiers documentaires</h2><p className="text-sm text-slate-600">Un fichier référencé n’est pas automatiquement authentifié. Les déclarations de pièces reçues restent distinctes de la présence d’un fichier.</p></div>
   {!docs.length&&<div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-600">Aucun fichier documentaire enregistré dans le nouveau registre. Les anciennes cases « pièces reçues » ne constituent pas des fichiers.</div>}
   <div className="grid gap-3">{docs.map(d=><article key={d.id} className="min-w-0 rounded-2xl border bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0"><h3 className="break-words font-bold">{d.nom_fichier}</h3><p className="mt-1 text-xs text-slate-500">{d.type_document} · version {d.version} · {d.mime_type||"Type inconnu"}</p><p className="mt-1 break-all text-xs text-slate-500">Objet stocké : {d.bucket_id}/{d.object_path}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{d.statut_validation}</span></div><p className="mt-2 text-sm text-slate-600">Reçu le {new Date(d.recu_le).toLocaleString("fr-FR")}{d.valide_le?" · Décision le "+new Date(d.valide_le).toLocaleString("fr-FR"):""}</p>{d.note_validation&&<p className="mt-2 break-words text-sm">Note : {d.note_validation}</p>}</article>)}</div>
  </section>
  <section className="rounded-2xl border bg-white p-4"><h2 className="text-xl font-extrabold">Historique documentaire</h2>{!docsHistory.length?<p className="mt-2 text-sm text-slate-600">Aucun événement d’historique disponible pour ce dossier.</p>:<ol className="mt-3 space-y-3">{docsHistory.map((h,i)=><li key={h.document_id+"-"+h.cree_le+"-"+i} className="border-l-2 border-naxa-green-900 pl-3"><p className="font-semibold">{h.action} · {h.ancien_statut||"—"} → {h.nouveau_statut||"—"}</p><p className="text-xs text-slate-500">{new Date(h.cree_le).toLocaleString("fr-FR")}</p>{h.detail&&<p className="break-words text-sm">{h.detail}</p>}</li>)}</ol>}</section>
 </main>;
}
