import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { bloquerCaisse, creerCaisse, reactiverCaisse } from "../actions";

export default async function CaissesPage({searchParams}:{searchParams:{ok?:string;erreur?:string}}){
  const sb=supabaseServer();
  const {data:u}=await sb.auth.getUser();
  if(!u.user)redirect("/connexion?retour=/pharmacie/caisses");
  const {data:p}=await sb.from("profiles").select("role,pharmacie_id,actif").eq("id",u.user.id).single();
  if(p?.role!=="promoteur"||!p.pharmacie_id||p.actif===false)redirect("/pharmacie");
  const {data:ph}=await sb.from("pharmacies").select("nom").eq("id",p.pharmacie_id).single();
  const {data:caisses}=await sb.from("profiles").select("id,username,first_name,last_name,actif").eq("parent_profile_id",u.user.id).eq("role","caisse").order("created_at",{ascending:true});
  const champ="champ mt-1";
  return <main className="mx-auto max-w-2xl space-y-5 px-4 pb-16">
    <header className="-mx-4 flex items-center justify-between bg-naxa-green-900 px-4 py-3 text-white"><Link href="/pharmacie" className="font-bold underline">← Pharmacie</Link><span className="font-semibold">{ph?.nom??"Pharmacie"}</span></header>
    <section className="carte"><h1 className="text-xl font-extrabold">Mes caisses</h1><p className="mt-1 text-sm">Les caisses sont des comptes enfants de votre pharmacie. Elles utilisent le même stock, les mêmes réservations et la même identité côté client.</p></section>
    {searchParams.ok&&<p role="status" className="carte">Modification enregistrée.</p>}
    {searchParams.erreur&&<p role="alert" className="carte text-red-700">Impossible d'effectuer cette opération.</p>}
    <section className="carte space-y-3"><h2 className="text-lg font-bold">Comptes existants</h2>{caisses?.length?caisses.map(c=><div key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-3"><div><p className="font-bold">{c.first_name} {c.last_name}</p><p className="text-sm">@{c.username} · {c.actif?"Actif":"Bloqué"}</p></div>{c.actif?<form action={bloquerCaisse}><input type="hidden" name="caisse_id" value={c.id}/><button className="btn btn-clair">Bloquer</button></form>:<form action={reactiverCaisse}><input type="hidden" name="caisse_id" value={c.id}/><button className="btn btn-canari">Réactiver</button></form>}</div>):<p className="text-sm">Aucune caisse n'est encore créée.</p>}</section>
    <form action={creerCaisse} className="carte space-y-3"><h2 className="text-lg font-bold">Créer une caisse</h2><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Prénom<input name="first_name" required className={champ}/></label><label className="text-sm font-semibold">Nom<input name="last_name" required className={champ}/></label></div><label className="text-sm font-semibold">Nom d'utilisateur<input name="username" required pattern="[a-z0-9][a-z0-9._-]{2,29}" className={champ}/></label><label className="text-sm font-semibold">E-mail<input name="email" type="email" required className={champ}/></label><div className="grid grid-cols-2 gap-3"><label className="text-sm font-semibold">Téléphone<input name="phone" required placeholder="+237XXXXXXXXX" className={champ}/></label><label className="text-sm font-semibold">Pays<input name="phone_country" required defaultValue="CM" className={champ}/></label></div><label className="text-sm font-semibold">Date de naissance<input name="date_of_birth" type="date" required className={champ}/></label><label className="text-sm font-semibold">Mot de passe provisoire<input name="motdepasse" type="text" minLength={8} required className={champ}/></label><button className="btn btn-vert w-full">Créer le compte caisse</button></form>
  </main>;
}
