import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Logo } from "@/components/Logo";
import { PhotoUpload } from "@/components/PhotoUpload";
import { brouillonIA, enregistrerFiche } from "./actions";
export default async function AdminProduits({ searchParams }: { searchParams: { q?: string; ok?: string; erreur?: string } }) {
  const sb = supabaseServer(); const { data: u } = await sb.auth.getUser();
  if (!u.user) redirect("/connexion?retour=/admin/produits");
  const { data: prof } = await sb.from("profiles").select("role").eq("id", u.user.id).single();
  if (prof?.role !== "admin") redirect("/");
  const q = (searchParams.q ?? "").trim();
  let req = sb.from("produits").select("id,nom,dci,dosage,forme,photo_url,description,indications,precautions,synonymes,source_fiche,fiche_validee").order("fiche_validee",{ascending:true}).order("nom").limit(30);
  if (q) req = req.ilike("nom_norm", `%${q.toLowerCase()}%`);
  const { data: produits } = await req; const champ = "champ !rounded-xl !py-2 mt-1"; const listeProduits=produits??[]; const colonnes=[{key:"a-completer",label:"À compléter",items:listeProduits.filter(p=>!p.fiche_validee&&!p.description)},{key:"a-relire",label:"À relire",items:listeProduits.filter(p=>!p.fiche_validee&&!!p.description)},{key:"validees",label:"Validées",items:listeProduits.filter(p=>!!p.fiche_validee)}];
  return <main className="mx-auto max-w-2xl space-y-4 px-4 pb-16">
    <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white"><Logo taille={32}/><Link href="/admin" className="text-sm font-semibold underline underline-offset-4">← Espace NAXA</Link></header>
    <h1 className="text-xl font-extrabold">Fiches produits</h1>
    <p className="text-sm text-slate-600">Photo, description et précautions. Le brouillon IA est toujours « en cours de relecture » tant que vous n'avez pas coché « relue ». Pas de dose, jamais.</p>
    {searchParams.ok && <p role="status" className="carte bg-naxa-green-100">Enregistré.</p>}
    {searchParams.erreur && <p role="alert" className="carte text-red-700">Échec : {searchParams.erreur}</p>}
    <form className="flex gap-2" role="search"><input name="q" defaultValue={q} className="champ" placeholder="Chercher un produit" aria-label="Chercher un produit"/><button className="btn btn-vert">Chercher</button></form>
    <div className="admin-kanban" aria-label="Fiches produits par état">{colonnes.map(colonne=><section key={colonne.key} className="admin-kanban-column"><header className="admin-kanban-column-header"><div><h2>{colonne.label}</h2><p>Fiches affichées dans cette étape</p></div><span>{colonne.items.length}</span></header><ul className="admin-kanban-cards">{colonne.items.map((p)=><li key={p.id} className="carte space-y-3">
      <div className="flex items-start justify-between gap-2"><div><h2 className="font-bold">{p.nom} {p.dosage}</h2><p className="text-sm text-slate-600">{[p.dci,p.forme].filter(Boolean).join(" · ")}</p></div>
      <span className={`rounded-full px-3 py-1 text-xs font-bold ${p.fiche_validee?"bg-naxa-green-100":"bg-naxa-canari"}`}>{p.fiche_validee?"Relue":p.description?"À relire":"Vide"}</span></div>
      <PhotoUpload produitId={p.id} photoUrl={p.photo_url}/>
      <form className="space-y-2"><input type="hidden" name="id" value={p.id}/><input type="hidden" name="q" value={q}/>
      <label className="block text-sm font-semibold">Description<textarea name="description" defaultValue={p.description??""} rows={2} maxLength={400} className={champ}/></label>
      <label className="block text-sm font-semibold">À quoi ça sert<textarea name="indications" defaultValue={p.indications??""} rows={2} maxLength={400} className={champ}/></label>
      <label className="block text-sm font-semibold">Précautions<textarea name="precautions" defaultValue={p.precautions??""} rows={3} maxLength={600} className={champ}/></label>
      <label className="block text-sm font-semibold">Synonymes pour la recherche (séparés par des virgules)<input name="synonymes" defaultValue={(p.synonymes??[]).join(", ")} className={champ}/></label>
      <label className="flex min-h-[48px] items-center gap-3 text-sm font-semibold"><input type="checkbox" name="validee" defaultChecked={p.fiche_validee} className="h-6 w-6"/> Relue par un pharmacien</label>
      <div className="flex gap-2"><button formAction={brouillonIA} className="btn btn-clair flex-1 text-sm">Brouillon IA</button><button formAction={enregistrerFiche} className="btn btn-vert flex-1 text-sm">Enregistrer</button></div>
      <p className="text-xs text-slate-500">« Brouillon IA » remplace les textes actuels. Cliquez ensuite sur Enregistrer après relecture.</p></form>
    </li>)}</ul></section>)}</div>{listeProduits.length===0&&<p className="carte">Aucun produit trouvé.</p>}
  </main>;
}