import Link from "next/link";
import {redirect} from "next/navigation";
import {supabaseServer} from "@/lib/supabase/server";
import {GestionnaireStockSidebar} from "@/components/pharmacie/GestionnaireStockSidebar";
import {mettreCommandeEnPreparationStock,marquerCommandePretePourLivraison,publierCommandePourLivreurs} from "../actions";

type Item={
  quantite:number;
  prix_unitaire:number;
  produits:{nom:string;dosage:string|null}|null;
};
type Order={
  id:string;pharmacie_id:string;commande_statut:string;preparation_statut:string|null;
  preparation_demarre_le:string|null;prete_au_retrait_le:string|null;total:number;created_at:string;
  ville_livraison:string|null;quartier_livraison:string|null;adresse_livraison:string|null;
  repere_livraison:string|null;telephone_livraison:string|null;frais_livraison:number;
  reservation_items:Item[]|null;
};

const fcfa=(value:number)=>Number(value??0).toLocaleString("fr-FR")+" FCFA";
const shortId=(id:string)=>id.replace(/-/g,"").slice(0,8).toUpperCase();

export const dynamic="force-dynamic";

export default async function CommandesALivrerPage({
  searchParams,
}:{searchParams:{ok?:string;erreur?:string}}){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/gestionnaire-stock/commandes");

  const [{data:profile,error:profileError},{data:role,error:roleError},{data:pharmacyId,error:pharmacyError}]=await Promise.all([
    sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_pharmacy"),
  ]);
  if(profileError||roleError||pharmacyError||profile?.actif!==true
    ||!["gestionnaire_stock","magasinier","admin"].includes(String(role))
    ||typeof pharmacyId!=="string"){
    redirect("/");
  }

  const [{data:pharmacy,error:pharmacyReadError},{data:rows,error:ordersError}]=await Promise.all([
    sb.from("pharmacies").select("nom,actif,archivee_le").eq("id",pharmacyId).maybeSingle(),
    sb.from("reservations")
      .select("id,pharmacie_id,commande_statut,preparation_statut,preparation_demarre_le,prete_au_retrait_le,total,created_at,ville_livraison,quartier_livraison,adresse_livraison,repere_livraison,telephone_livraison,frais_livraison,reservation_items(quantite,prix_unitaire,produits(nom,dosage))")
      .eq("pharmacie_id",pharmacyId).eq("mode","commande")
      .eq("commande_statut","preparation").order("created_at",{ascending:true}).limit(100),
  ]);
  if(pharmacyReadError||!pharmacy?.actif||pharmacy.archivee_le)redirect("/");
  const orders=(rows??[]) as unknown as Order[];

  return <main className="min-h-screen bg-[#F4F8F5] px-4 pb-12 text-slate-900">
    <div className="mx-auto max-w-6xl space-y-5 pt-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Stock & logistique</p>
          <h1 className="mt-1 text-2xl font-black">Commandes à livrer</h1>
          <p className="mt-1 text-sm text-emerald-100">{pharmacy.nom}</p>
        </div>
        <Link href="/pharmacie/commandes" className="text-sm font-bold underline">Voir les commandes pharmacie</Link>
      </header>

      <div className="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
        <GestionnaireStockSidebar active="/pharmacie/gestionnaire-stock/commandes"/>
        <div className="min-w-0 space-y-4">
          {searchParams.ok==="en_preparation"&&<p role="status" className="rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-950">Démarrage de la préparation enregistré.</p>}
          {searchParams.ok==="prete"&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">La préparation physique est confirmée. Vous pouvez maintenant publier la mission pour les livreurs.</p>}
          {searchParams.ok==="publiee"&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">La mission est publiée dans la file Livreur. Les livreurs affectés à cette pharmacie peuvent maintenant la prendre.</p>}
          {searchParams.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{searchParams.erreur==="publication"?"Publication refusée : le stock doit avoir confirmé « Prête pour livraison » et votre poste Stock doit être actif.":searchParams.erreur==="preparation"?"Transition refusée : vérifiez l’état de préparation, la commande et votre affectation Stock.":"Données de commande invalides."}</p>}
          <section className="grid gap-3 sm:grid-cols-3">
            <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Prêtes pour livraison</p><p className="mt-1 text-3xl font-black">{orders.length}</p></article>
            <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Pharmacie concernée</p><p className="mt-1 text-base font-extrabold">{pharmacy.nom}</p></article>
            <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Règle de publication</p><p className="mt-1 text-sm font-semibold">Stock valide la préparation, le Livreur prend la mission.</p></article>
          </section>
          {ordersError
            ?<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-900">Impossible de charger la file de préparation. Aucune commande ne doit être considérée comme publiée.</p>
            :orders.length===0
              ?<section className="rounded-2xl border bg-white p-6"><h2 className="font-extrabold">Aucune commande prête à livrer</h2><p className="mt-2 text-sm text-slate-600">Les commandes apparaissent ici après acceptation par la pharmacie et passage en préparation. Elles ne deviennent visibles aux livreurs qu’après publication par Stock.</p><Link href="/pharmacie/commandes" className="mt-4 inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-bold">Consulter les commandes</Link></section>
              :<div className="space-y-3">{orders.map(order=><article key={order.id} className="rounded-2xl border bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Contrôle Stock · préparation physique</p><h2 className="mt-1 text-lg font-black">Commande #{shortId(order.id)}</h2><p className="text-xs text-slate-500">Reçue le {new Date(order.created_at).toLocaleString("fr-FR")}</p></div>
                  <span className={order.preparation_statut==="prete_au_retrait"?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-950":order.preparation_statut==="en_preparation"?"rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950":"rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-800"}>{order.preparation_statut==="prete_au_retrait"?"Prête pour livraison":order.preparation_statut==="en_preparation"?"Préparation en cours":"À apprêter"}</span>
                </div>
                <ul className="mt-4 space-y-2 border-t pt-3 text-sm">
                  {(order.reservation_items??[]).map((item,index)=><li key={index} className="flex justify-between gap-3"><span>{item.quantite} × {item.produits?.nom??"Produit"}{item.produits?.dosage?" · "+item.produits.dosage:""}</span><strong>{fcfa(item.prix_unitaire*item.quantite)}</strong></li>)}
                </ul>
                <p className="mt-3 font-black">Total commande : {fcfa(order.total)}</p>
                <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                  <p className="font-bold">Zone de livraison</p>
                  <p className="mt-1">{[order.adresse_livraison,order.repere_livraison,order.quartier_livraison,order.ville_livraison].filter(Boolean).join(", ")||"Adresse non renseignée"}</p>
                  <p className="mt-1 text-xs text-slate-500">Le numéro client n’est pas affiché dans la file Stock ; il sera remis au livreur après acceptation.</p>
                </div>
                {(!order.preparation_statut||order.preparation_statut==="non_commencee")&&<form action={mettreCommandeEnPreparationStock} className="mt-4">
                  <input type="hidden" name="reservation_id" value={order.id}/>
                  <button type="submit" className="min-h-11 w-full rounded-xl border border-emerald-900/20 px-4 py-3 text-sm font-bold text-emerald-950">Démarrer la préparation physique</button>
                </form>}
                {order.preparation_statut==="en_preparation"&&<form action={marquerCommandePretePourLivraison} className="mt-4">
                  <input type="hidden" name="reservation_id" value={order.id}/>
                  <button type="submit" className="min-h-11 w-full rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white">Confirmer « Prête pour livraison »</button>
                </form>}
                {order.preparation_statut==="prete_au_retrait"&&<form action={publierCommandePourLivreurs} className="mt-4">
                  <input type="hidden" name="reservation_id" value={order.id}/>
                  <button type="submit" className="min-h-11 w-full rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white">Publier la mission dans la file Livreur</button>
                </form>}
                <p className="mt-3 text-xs text-slate-500">Préparation commencée : {order.preparation_demarre_le?new Date(order.preparation_demarre_le).toLocaleString("fr-FR"):"Non démarrée"} · Prête : {order.prete_au_retrait_le?new Date(order.prete_au_retrait_le).toLocaleString("fr-FR"):"Non confirmée"}</p>
              </article>)}</div>}
        </div>
      </div>
    </div>
  </main>;
}
