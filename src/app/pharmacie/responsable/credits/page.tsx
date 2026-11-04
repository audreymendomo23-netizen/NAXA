import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import {
  approuverDemandeCreditMarketplace,
  refuserDemandeCreditMarketplace,
} from "../../promoteur/credits/actions";

type CreditRequest = {
  id:string;
  pharmacie_id:string;
  client_id:string;
  montant:number;
  statut:string;
  created_at:string;
  telephone_demande:string|null;
  date_remboursement:string|null;
  justificatif_path:string|null;
  panier_items:{produit_id:string;quantite:number}[]|null;
  reservation_id:string|null;
};

const fcfa=(v:number)=>Number(v||0).toLocaleString("fr-FR")+" FCFA";
const ref=(v:string)=>v.replace(/-/g,"").slice(0,8).toUpperCase();

export default async function ResponsableCreditsMarketplacePage({
  searchParams,
}:{
  searchParams:{ok?:string;erreur?:string};
}) {
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/responsable/credits");

  const {data:profile}=await sb.from("profiles")
    .select("role,fonction_interne,niveau_interne,pharmacie_id,actif")
    .eq("id",auth.user.id).maybeSingle();
  if(!profile||profile.actif!==true||profile.role!=="pharmacie"
    ||profile.fonction_interne!=="responsable"||profile.niveau_interne!==2)redirect("/pharmacie");

  const {data:assignments,error:assignmentError}=await sb.from("naxa_professional_assignments")
    .select("pharmacie_id,commence_at,expire_at")
    .eq("profile_id",auth.user.id)
    .eq("fonction","responsable")
    .eq("statut","active");
  const now=Date.now();
  const pharmacyIds=[...new Set([
    ...(profile.pharmacie_id?[profile.pharmacie_id]:[]),
    ...(assignments??[])
      .filter(a=>new Date(a.commence_at).getTime()<=now
        &&(a.expire_at===null||new Date(a.expire_at).getTime()>now))
      .map(a=>a.pharmacie_id),
  ])];

  if(assignmentError||!pharmacyIds.length){
    return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <header className="rounded-2xl bg-[#0B3D26] p-5 text-white">
        <h1 className="text-2xl font-black">Demandes de crédit Marketplace</h1>
        <p className="mt-2 text-sm">Aucune affectation Responsable active ne permet actuellement de consulter ces demandes.</p>
      </header>
      <Link href="/pharmacie/pilotage" className="text-sm font-bold underline">← Retour au pilotage</Link>
    </main>;
  }

  const [{data:pharmacies,error:pharmacyError},{data,error}] = await Promise.all([
    sb.from("pharmacies").select("id,nom").in("id",pharmacyIds),
    sb.from("client_credit_requests")
      .select("id,pharmacie_id,client_id,montant,statut,created_at,telephone_demande,date_remboursement,justificatif_path,panier_items,reservation_id")
      .eq("origine","marketplace").in("pharmacie_id",pharmacyIds)
      .order("created_at",{ascending:false}).limit(100),
  ]);
  const requests=(data??[]) as CreditRequest[];
  const productIds=[...new Set(requests.flatMap(r=>(r.panier_items??[]).map(i=>i.produit_id)))];
  const {data:products}=productIds.length
    ?await sb.from("produits").select("id,nom,dosage").in("id",productIds)
    :{data:[] as {id:string;nom:string;dosage:string|null}[]};
  const names=new Map((products??[]).map(p=>[p.id,p.nom+(p.dosage?" "+p.dosage:"")]));
  const pharmacyNames=new Map((pharmacies??[]).map(p=>[p.id,p.nom]));
  const decisionChecks=await Promise.all(pharmacyIds.map(async pharmacieId=>{
    const result=await sb.rpc("naxa_can_approve_marketplace_credit",{p_pharmacie:pharmacieId});
    return [pharmacieId,!result.error&&result.data===true] as const;
  }));
  const canApproveByPharmacy=new Map(decisionChecks);

  return <main className="mx-auto max-w-5xl space-y-4 px-4 py-6">
    <header className="rounded-2xl bg-[#0B3D26] p-5 text-white">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Espace Responsable</p>
      <h1 className="mt-2 text-2xl font-black">Demandes de crédit Marketplace</h1>
      <p className="mt-2 text-sm">Vous ne voyez que les pharmacies qui vous sont explicitement affectées. L’approbation débite immédiatement le stock physique et les lots FEFO.</p>
    </header>
    <nav className="flex flex-wrap gap-3 text-sm font-semibold">
      <Link href="/pharmacie/pilotage" className="underline">← Pilotage Responsable</Link>
      <Link href="/pharmacie/gestionnaire-stock/reservations" className="underline">Commandes à préparer</Link>
    </nav>
    {searchParams.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm">{searchParams.ok==="approuvee"?"Crédit approuvé, stock débité et commande transmise à la préparation.":"Demande refusée ; aucun stock n’a été débité."}</p>}
    {searchParams.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm">Décision non enregistrée. Vérifiez votre affectation, le privilège délégué, le statut et le stock.</p>}
    {(error||pharmacyError)&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm">Les demandes ou les pharmacies affectées n’ont pas pu être chargées. Aucune décision n’a été prise.</p>}
    {!error&&!requests.length&&<p className="rounded-xl border bg-white p-4">Aucune demande Marketplace enregistrée pour vos pharmacies affectées.</p>}
    {requests.map(r=><article key={r.id} className="space-y-3 rounded-2xl border bg-white p-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-black">Demande #{ref(r.id)}</h2>
          <p className="text-sm">{pharmacyNames.get(r.pharmacie_id)??"Pharmacie affectée"}</p>
          <p className="text-sm">Client #{ref(r.client_id)} · {r.telephone_demande??"Téléphone absent"}</p>
          <p className="text-sm">Échéance : {r.date_remboursement??"Non renseignée"}</p>
          <p className="text-xs text-slate-500">Soumise le {new Date(r.created_at).toLocaleString("fr-FR")}</p>
        </div>
        <div className="text-right"><p className="text-xl font-black">{fcfa(r.montant)}</p><p className="text-sm font-bold">{r.statut}</p></div>
      </div>
      <div className="rounded-xl bg-slate-50 p-3">
        <p className="text-sm font-bold">Médicaments demandés</p>
        <ul className="mt-2 space-y-1 text-sm">{(r.panier_items??[]).map(i=><li key={i.produit_id}>{i.quantite} × {names.get(i.produit_id)??"Produit"}</li>)}</ul>
      </div>
      <p className="text-sm">{r.justificatif_path
        ?<a className="font-bold underline" href={"/api/pharmacie/promoteur/credits/"+r.id+"/justificatif"}>Télécharger le justificatif sécurisé</a>
        :"Aucun justificatif référencé."}</p>
      {r.reservation_id&&<p className="text-sm">Commande de préparation : {ref(r.reservation_id)} · stock débité à l’approbation.</p>}
      {r.statut==="en_attente"&&canApproveByPharmacy.get(r.pharmacie_id)===true
        ?<div className="flex flex-wrap gap-3 border-t pt-3">
          <form action={approuverDemandeCreditMarketplace}><input type="hidden" name="demande_id" value={r.id}/><button className="rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white" type="submit">Approuver et débiter le stock</button></form>
          <form action={refuserDemandeCreditMarketplace}><input type="hidden" name="demande_id" value={r.id}/><button className="rounded-xl border border-red-300 px-4 py-3 font-bold text-red-800" type="submit">Refuser</button></form>
        </div>
        :r.statut==="en_attente"
          ?<p className="border-t pt-3 text-sm text-slate-600">Vous pouvez consulter cette demande, mais le droit d’approbation n’est pas actif pour cette pharmacie. Le Promoteur doit vous déléguer le privilège correspondant.</p>
          :null}
    </article>)}
  </main>;
}
