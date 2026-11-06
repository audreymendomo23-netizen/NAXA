import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { InvitationLivreurForm } from "@/components/pharmacie/InvitationLivreurForm";
import { LivreursAssignmentsManager } from "@/components/pharmacie/LivreursAssignmentsManager";
import { accorderAffectationProfessionnelle, revoquerAffectationProfessionnelle, attribuerDroitCreditMarketplace, retirerDroitCreditMarketplace } from "./actions";

type Assignment = {
  id:string;
  profile_id:string;
  pharmacie_id:string;
  fonction:string;
  statut:string;
  nature_affectation:"ordinaire"|"urgence";
  motif:string;
  commence_at:string;
  expire_at:string|null;
  accorde_at:string;
  revoque_at:string|null;
  motif_revocation:string|null;
};
type ResponsableProfile={id:string;first_name:string|null;last_name:string|null;username:string|null};
type CreditPrivilege={profile_id:string;pharmacie_id:string;active:boolean;revoked_at:string|null};

const labels:Record<string,string>={
  caisse:"Caissier / Caissière",
  gestionnaire_stock:"Gestionnaire de stock",
  magasinier:"Magasinier",
  pharmacien:"Pharmacien",
  responsable:"Responsable",
  comptable:"Comptable",
  livreur:"Livreur",
};
const date=(v:string)=>new Date(v).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});

export default async function AffectationsPage({
  searchParams,
}:{
  searchParams:{ok?:string;erreur?:string};
}){
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/pharmacie/affectations");

  const [{data:profile},{data:businessFunction}]=await Promise.all([
    sb.from("profiles").select("role,actif,pharmacie_id").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
  ]);
  const isPromoteur=profile?.role==="promoteur"&&profile.actif===true&&businessFunction==="promoteur";
  const isPharmacie=profile?.role==="pharmacie"&&profile.actif===true&&businessFunction==="pharmacie"&&Boolean(profile.pharmacie_id);
  if(!isPromoteur&&!isPharmacie)redirect("/pharmacie");

  const {data:links,error:linksError}=isPromoteur
    ?await sb.from("promoteur_pharmacies").select("pharmacie_id").eq("promoteur_id",auth.user.id).eq("actif",true)
    :{data:profile?.pharmacie_id?[{pharmacie_id:profile.pharmacie_id}]:[],error:null};
  const ids=[...new Set((links??[]).map(x=>x.pharmacie_id))];

  const [{data:pharmacies},{data:rows,error:assignmentsError}]=await Promise.all([
    ids.length
      ?sb.from("pharmacies").select("id,nom,actif").in("id",ids).eq("actif",true).order("nom")
      :Promise.resolve({data:[] as {id:string;nom:string;actif:boolean}[]}),
    sb.from("naxa_professional_assignments")
      .select("id,profile_id,pharmacie_id,fonction,statut,nature_affectation,motif,commence_at,expire_at,accorde_at,revoque_at,motif_revocation")
      .eq("accorde_par",auth.user.id).order("accorde_at",{ascending:false}).limit(200),
  ]);
  const assignments=(rows??[]) as Assignment[];
  const pharmacyName=new Map((pharmacies??[]).map(p=>[p.id,p.nom]));
  const activeResponsableAssignments=assignments.filter(a=>
    a.fonction==="responsable"&&a.statut==="active"
    &&new Date(a.commence_at).getTime()<=Date.now()
    &&(a.expire_at===null||new Date(a.expire_at).getTime()>Date.now())
  );
  const responsableIds=[...new Set(activeResponsableAssignments.map(a=>a.profile_id))];
  const responsablePharmacyIds=[...new Set(activeResponsableAssignments.map(a=>a.pharmacie_id))];
  const [{data:responsables,error:responsablesError},{data:creditPrivilegeRows,error:creditPrivilegeError}]=await Promise.all([
    responsableIds.length
      ?sb.from("profiles").select("id,first_name,last_name,username").in("id",responsableIds)
      :Promise.resolve({data:[] as ResponsableProfile[],error:null}),
    responsableIds.length&&responsablePharmacyIds.length
      ?sb.from("naxa_profile_privileges").select("profile_id,pharmacie_id,active,revoked_at")
        .eq("privilege_code","APPROVE_MARKETPLACE_CREDIT")
        .eq("scope_type","PHARMACIE").in("profile_id",responsableIds)
        .in("pharmacie_id",responsablePharmacyIds)
      :Promise.resolve({data:[] as CreditPrivilege[],error:null}),
  ]);
  const responsableById=new Map((responsables??[]).map(p=>[p.id,p]));
  const creditPrivilegeByKey=new Map((creditPrivilegeRows??[]).map(p=>[
    p.profile_id+":"+p.pharmacie_id,p.active&&p.revoked_at===null
  ]));
  const errorMessages:Record<string,string>={
    validation:"Vérifiez le nom d’utilisateur, la pharmacie, la fonction, le type de période et le motif.",
    recherche:"La recherche du compte a échoué. Réessayez.",
    cible:"Aucun compte actif unique ne correspond à ce nom d’utilisateur.",
    autorisation:"Attribution refusée par les contrôles serveur : vérifiez le périmètre, le privilège et la période.",
    revocation:"Révocation refusée. Vérifiez le motif et vos droits sur cette affectation.",
    droit_credit:"Délégation refusée. Vérifiez que le Responsable est actif, affecté à cette pharmacie et que votre droit de délégation est valide.",
    creation_livreur_validation:"Vérifiez l’adresse e-mail, le compte, l’âge minimum de 18 ans et les informations obligatoires.",
    creation_livreur_doublon:"Un compte ou une invitation existe déjà pour cette adresse e-mail.",
    creation_livreur_invitation:"La création de l’invitation a échoué. Aucun nouveau compte n’a été créé.",
    creation_livreur_profil:"Le profil NAXA n’a pas pu être finalisé. L’affectation reste désactivée.",
    creation_livreur_affectation:"Le compte est créé mais son affectation n’a pas été activée. Contactez le Promoteur ou l’Administrateur.",
    creation_livreur_invite:"L’invitation Livreur a été créée.",

  };
  const now=Date.now();

  return <main className="min-h-screen bg-[#F4F8F5] px-4 py-5 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Équipe</p>
          <h1 className="text-2xl font-black">Affectations professionnelles</h1>
          <p className="mt-1 text-sm text-emerald-50">Une identité peut recevoir plusieurs fonctions ; chaque affectation reste limitée à sa pharmacie.</p>
        </div>
        <Link href={isPromoteur?"/pharmacie/promoteur":"/pharmacie"} className="underline">{isPromoteur?"← Espace Promoteur":"← Espace Pharmacie"}</Link>
      </header>

      {searchParams.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-emerald-900">{
        searchParams.ok==="accordee"?"Affectation accordée.":
        searchParams.ok==="droit_credit"?"Droit d’approbation Marketplace délégué au Responsable.":
        searchParams.ok==="droit_credit_retire"?"Droit d’approbation Marketplace retiré.":
        searchParams.ok==="livreur_invite"?"Invitation Livreur créée et affectation enregistrée.":
        "Affectation révoquée."
      }</p>}
      {searchParams.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">{errorMessages[searchParams.erreur]??"Opération impossible."}</p>}
      {(linksError||assignmentsError)&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-red-900">Lecture incomplète. Aucune opération ne doit être considérée comme validée.</p>}

      <InvitationLivreurForm
        pharmacies={(pharmacies??[]).map(p=>({id:p.id,nom:p.nom}))}
        locked={isPharmacie}
      />

      <LivreursAssignmentsManager
        pharmacies={(pharmacies??[]).map(p=>({id:p.id,nom:p.nom}))}
      />

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">Accorder une fonction</h2>
        <p className="my-2 text-sm text-slate-600">
          Une affectation ordinaire reste active jusqu’à révocation explicite. Une affectation urgente expire automatiquement à la date choisie. Aucun délai par défaut n’est inventé.
        </p>
        <form action={accorderAffectationProfessionnelle} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Pharmacie
            <select name="pharmacie_id" required className="mt-1 w-full rounded-lg border p-3" defaultValue="">
              <option value="" disabled>Choisir</option>
              {(pharmacies??[]).map(p=><option key={p.id} value={p.id}>{p.nom}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Nom d’utilisateur NAXA
            <input name="username" required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9._-]{2,29}" autoComplete="off" className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <label className="text-sm font-semibold">Fonction supplémentaire
            <select name="fonction" required className="mt-1 w-full rounded-lg border p-3" defaultValue="">
              <option value="" disabled>Choisir</option>
              {Object.entries(labels).filter(([v])=>isPromoteur||v==="livreur").map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Type d’affectation
            <select name="nature_affectation" required className="mt-1 w-full rounded-lg border p-3" defaultValue="ordinaire">
              <option value="ordinaire">Ordinaire · permanente</option>
              <option value="urgence">Urgence · temporaire avec expiration</option>
            </select>
          </label>
          <label className="text-sm font-semibold">Début
            <input name="commence_at" type="datetime-local" required className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <label className="text-sm font-semibold">Expiration (obligatoire uniquement en urgence)
            <input name="expire_at" type="datetime-local" className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Motif (5 à 500 caractères)
            <textarea name="motif" required minLength={5} maxLength={500} className="mt-1 w-full rounded-lg border p-3" rows={3} placeholder="Ex. Remplacement temporaire pendant l’absence d’un collègue"/>
          </label>
          <button className="rounded-xl bg-[#0B3D26] px-4 py-3 font-bold text-white sm:col-span-2">Accorder l’affectation</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">Droit d’approbation des crédits Marketplace</h2>
        <p className="mt-2 text-sm text-slate-600">
          Le Promoteur délègue ce droit individuellement, pharmacie par pharmacie. Un Responsable affecté ne peut approuver un crédit que dans les pharmacies où ce droit est actif. La révocation de l’affectation professionnelle retire également son droit secondaire lorsqu’il ne dispose plus d’une autre affectation active dans cette pharmacie.
        </p>
        {responsablesError||creditPrivilegeError
          ?<p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">Impossible de vérifier les droits des Responsables. Aucune délégation n’est proposée.</p>
          :activeResponsableAssignments.length===0
            ?<p className="mt-3 text-sm text-slate-600">Aucun Responsable n’est actuellement affecté à vos pharmacies.</p>
            :<div className="mt-4 space-y-3">
              {activeResponsableAssignments.map(a=>{
                const person=responsableById.get(a.profile_id);
                const granted=creditPrivilegeByKey.get(a.profile_id+":"+a.pharmacie_id)===true;
                return <article key={a.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-bold">{person?.first_name??""} {person?.last_name??""}{person?.username?" · @"+person.username:""}</p>
                      <p className="text-sm text-slate-600">{pharmacyName.get(a.pharmacie_id)??"Pharmacie"}</p>
                    </div>
                    <span className={granted?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900":"rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>
                      {granted?"Approbation autorisée":"Sans droit d’approbation"}
                    </span>
                  </div>
                  {granted
                    ?<form action={retirerDroitCreditMarketplace} className="mt-3">
                      <input type="hidden" name="responsable_id" value={a.profile_id}/>
                      <input type="hidden" name="pharmacie_id" value={a.pharmacie_id}/>
                      <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-800">Retirer le droit d’approbation</button>
                    </form>
                    :<form action={attribuerDroitCreditMarketplace} className="mt-3">
                      <input type="hidden" name="responsable_id" value={a.profile_id}/>
                      <input type="hidden" name="pharmacie_id" value={a.pharmacie_id}/>
                      <button className="rounded-lg bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white">Autoriser l’approbation des crédits</button>
                    </form>}
                </article>;
              })}
            </div>}
      </section>

      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">Affectations accordées par vous</h2>
        {!assignments.length
          ?<p className="mt-3 text-sm text-slate-600">Aucune affectation enregistrée.</p>
          :<div className="mt-3 space-y-3">
            {assignments.map(a=>{
              const started=new Date(a.commence_at).getTime()<=now;
              const notExpired=a.expire_at===null||new Date(a.expire_at).getTime()>now;
              const active=a.statut==="active"&&started&&notExpired;
              const pending=a.statut==="active"&&!started;
              const expired=a.statut==="active"&&started&&!notExpired;
              return <article key={a.id} className="rounded-xl border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold">{labels[a.fonction]??a.fonction} · {pharmacyName.get(a.pharmacie_id)??"Pharmacie"}</h3>
                    <p className="text-xs text-slate-500">Compte ID : {a.profile_id}</p>
                    <p className="mt-1 text-sm">{a.motif}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      Du {date(a.commence_at)} · {a.nature_affectation==="ordinaire"||a.expire_at===null
                        ?"Sans expiration, jusqu’à révocation"
                        :"Expire le "+date(a.expire_at)}
                    </p>
                  </div>
                  <span className={active?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900":"rounded-full bg-slate-100 px-3 py-1 text-xs font-bold"}>
                    {a.statut==="revoked"?"Révoquée":pending?"À venir":expired?"Expirée":active?"Active":"Inactive"}
                  </span>
                </div>
                {a.statut==="active"&&(active||pending)&&<form action={revoquerAffectationProfessionnelle} className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="affectation_id" value={a.id}/>
                  <input name="motif_revocation" required minLength={5} maxLength={500} className="min-w-0 flex-1 rounded-lg border p-3 text-sm" placeholder="Motif de révocation"/>
                  <button className="rounded-lg border border-red-300 px-4 py-2 text-sm font-bold text-red-800">Révoquer</button>
                </form>}
              </article>;
            })}
          </div>}
      </section>
    </div>
  </main>;
}
