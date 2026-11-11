import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";
import {
  accorderAffectationParapharmacie,
  revoquerAffectationParapharmacie,
  attribuerPrivilegeParapharmacie,
  retirerPrivilegeParapharmacie,
} from "./actions";

const roleLabels:Record<string,string>={
  caisse:"Caisse",
  responsable:"Responsable",
  comptable:"Comptable",
  pharmacien:"Pharmacien",
  gestionnaire_stock:"Gestionnaire de stock",
  magasinier:"Magasinier",
  livreur:"Livreur",
};
const dateLabel=(value:string)=>new Date(value).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"});
const localNow=()=>new Date(Date.now()+60*60*1000).toISOString().slice(0,16);

export default async function AffectationsParapharmacie({
  searchParams,
}:{searchParams:{ok?:string;erreur?:string}}) {
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/partenaire/affectations");

  const [{data:partnerId,error:partnerError},{data:role,error:roleError}]=await Promise.all([
    sb.rpc("naxa_active_role_partner"),
    sb.rpc("naxa_business_function"),
  ]);
  if(partnerError||roleError||typeof partnerId!=="string"
    ||(role!=="promoteur"&&role!=="responsable")) {
    redirect("/partenaire/catalogue?erreur=selection_espace");
  }
  const [{data:canViewTeam,error:teamError},{data:canSuspendCashier,error:suspendCashierError}]=await Promise.all([
    sb.rpc("naxa_can_partner",{p_privilege:"VIEW_TEAM",p_partner_id:partnerId}),
    sb.rpc("naxa_can_partner",{p_privilege:"SUSPEND_CAISSE",p_partner_id:partnerId}),
  ]);
  if(teamError||canViewTeam!==true)redirect("/partenaire/catalogue?erreur=autorisation");
  const responsableCanRevokeCashier=role==="responsable"&&!suspendCashierError&&canSuspendCashier===true;

  const [{data:partner,error:partnerLoadError},{data:architecture,error:architectureError},{data:rows,error:assignmentsError}]=await Promise.all([
    sb.from("partners").select("id,name,status").eq("id",partnerId).eq("partner_type","parapharmacie").maybeSingle(),
    sb.from("naxa_partner_architectures").select("architecture_code,max_responsables,max_caisses,active").eq("partner_id",partnerId).maybeSingle(),
    sb.from("naxa_partner_professional_assignments")
      .select("id,profile_id,role_code,statut,nature_affectation,motif,commence_at,expire_at,accorde_at,revoque_at,motif_revocation")
      .eq("partner_id",partnerId).order("accorde_at",{ascending:false}).limit(200),
  ]);
  if(partnerLoadError||architectureError||!partner||partner.status!=="active"
    ||!architecture?.active)redirect("/partenaire/catalogue?erreur=partenaire_inactif");

  const profileIds=[...new Set((rows??[]).map((row:any)=>row.profile_id))];
  const admin=supabaseAdmin();
  const [{data:profiles},{data:matrix},{data:grants}]=await Promise.all([
    profileIds.length
      ?admin.from("profiles").select("id,username,first_name,last_name,phone").in("id",profileIds)
      :Promise.resolve({data:[] as any[]}),
    sb.from("naxa_architecture_privileges").select("role_key,privilege_code")
      .eq("architecture_code",architecture.architecture_code)
      .in("role_key",[...new Set((rows??[]).map((row:any)=>row.role_code))]),
    profileIds.length
      ?admin.from("naxa_profile_privileges").select("profile_id,privilege_code,active,revoked_at")
        .eq("partner_id",partnerId).eq("scope_type","PARTENAIRE").in("profile_id",profileIds)
      :Promise.resolve({data:[] as any[]}),
  ]);
  const profileById=new Map((profiles??[]).map((p:any)=>[p.id,p]));
  const grantsByKey=new Set((grants??[])
    .filter((g:any)=>g.active&&g.revoked_at===null)
    .map((g:any)=>g.profile_id+":"+g.privilege_code));
  const matrixCodes=[...new Set((matrix??[]).map((m:any)=>m.privilege_code))];
  const {data:privileges}=matrixCodes.length
    ?await sb.from("naxa_privileges").select("code,libelle,delegable,governance_only,active")
      .in("code",matrixCodes).eq("delegable",true).eq("governance_only",false).eq("active",true)
    :{data:[] as any[]};
  const privilegeByCode=new Map((privileges??[]).map((p:any)=>[p.code,p]));
  const activeCount=(rows??[]).filter((a:any)=>a.statut==="active"
    &&new Date(a.commence_at).getTime()<=Date.now()
    &&(!a.expire_at||new Date(a.expire_at).getTime()>Date.now())).length;
  const isPromoteur=role==="promoteur";
  const allowedRoles=isPromoteur
    ?["caisse","gestionnaire_stock","magasinier","pharmacien","responsable","comptable"]
    :["caisse"];
  const errors:Record<string,string>={
    validation:"Nom d’utilisateur, rôle, dates ou motif invalides.",
    recherche:"La recherche du compte a échoué.",
    cible:"Le compte doit être unique, actif, complet, majeur et confirmé.",
    autorisation:"Attribution refusée par les contrôles serveur (domaine, architecture, quota ou privilège).",
    revocation:"Révocation refusée. Vérifie le motif et tes droits.",
    privilege:"Délégation refusée : le privilège n’est pas délégable dans cette architecture ou ce rôle.",
  };
  const success:Record<string,string>={
    accordee:"Affectation professionnelle enregistrée.",
    revoquee:"Affectation révoquée.",
    privilege:"Privilège délégué.",
    privilege_retire:"Privilège retiré.",
  };

  return <main className="min-h-screen bg-[#F4F8F5] px-4 py-5 text-slate-900">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · ERP Parapharmacie</p>
          <h1 className="text-2xl font-black">Équipe et droits professionnels</h1>
          <p className="mt-1 text-sm text-emerald-50">{partner.name} · Architecture {architecture.architecture_code}</p>
        </div>
        <nav className="flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/partenaire/catalogue" className="underline">Catalogue et stocks</Link>
          <Link href="/partenaire/reservations" className="underline">Réservations</Link>
        </nav>
      </header>

      {searchParams.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{success[searchParams.ok]??"Opération effectuée."}</p>}
      {searchParams.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{errors[searchParams.erreur]??"Opération impossible."}</p>}
      {(assignmentsError||!profiles)&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Lecture de l’équipe incomplète. Les données non chargées ne sont pas considérées comme validées.</p>}

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Affecter un profil professionnel existant</h2>
        <p className="my-2 text-sm leading-6 text-slate-600">Un même compte Parapharmacie peut recevoir plusieurs fonctions, mais un seul poste est actif à la fois. Une affectation ordinaire reste active jusqu’à révocation ; une date de fin crée une affectation temporaire d’urgence. Les comptes Pharmacie et Parapharmacie ne sont jamais réutilisables entre les deux domaines.</p>
        <form action={accorderAffectationParapharmacie} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="partner_id" value={partnerId}/>
          <label className="text-sm font-semibold">Nom d’utilisateur NAXA
            <input name="username" required minLength={3} maxLength={30} pattern="[a-z0-9][a-z0-9._-]{2,29}" autoComplete="off" className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <label className="text-sm font-semibold">Fonction
            <select name="fonction" required defaultValue="" className="mt-1 w-full rounded-lg border bg-white p-3">
              <option value="" disabled>Choisir</option>
              {allowedRoles.map((code)=><option key={code} value={code}
                disabled={code==="responsable"&&!["PARENTS_AINES_CADETS","HYBRIDE"].includes(architecture.architecture_code)}>
                {roleLabels[code]}
              </option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Début de l’affectation
            <input name="commence_at" type="datetime-local" required defaultValue={localNow()} className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <label className="text-sm font-semibold">Fin (facultative, urgence)
            <input name="expire_at" type="datetime-local" className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <label className="text-sm font-semibold sm:col-span-2">Motif
            <textarea name="motif" minLength={5} maxLength={500} required rows={3} className="mt-1 w-full rounded-lg border p-3"/>
          </label>
          <button className="min-h-11 rounded-xl bg-[#064B2A] px-4 py-3 font-bold text-white sm:col-span-2">Enregistrer l’affectation</button>
        </form>
        <p className="mt-3 text-xs leading-5 text-slate-500">Livreur : le poste est conservé dans le référentiel commun, mais l’affectation est suspendue ici tant que le circuit Parapharmacie dédié (livraison, missions et suivi) n’est pas disponible.</p>
        {!isPromoteur&&<p className="mt-2 text-xs font-semibold text-amber-800">Le Responsable peut uniquement affecter une Caisse, sous réserve du plafond et des privilèges définis par le Promoteur.</p>}
        <p className="mt-2 text-xs text-slate-500">Plafond de Responsables : {architecture.max_responsables} · Plafond de Caisses : {architecture.max_caisses??"non défini"} · Affectations actives : {activeCount}</p>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold">Affectations de l’établissement</h2>
        <div className="mt-4 space-y-3">
          {(rows??[]).length===0&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun membre n’a encore été affecté à cette Parapharmacie.</p>}
          {(rows??[]).map((assignment:any)=>{
            const profile=profileById.get(assignment.profile_id);
            const allowed=(matrix??[]).filter((entry:any)=>entry.role_key===assignment.role_code)
              .map((entry:any)=>privilegeByCode.get(entry.privilege_code)).filter(Boolean);
            const memberGrants=allowed.filter((privilege:any)=>grantsByKey.has(assignment.profile_id+":"+privilege.code));
            const active=assignment.statut==="active"
              &&new Date(assignment.commence_at).getTime()<=Date.now()
              &&(!assignment.expire_at||new Date(assignment.expire_at).getTime()>Date.now());
            return <article key={assignment.id} className="rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold">{profile?.first_name||""} {profile?.last_name||""} {profile?.username?"@"+profile.username:""}</h3>
                  <p className="mt-1 text-sm text-slate-600">{roleLabels[assignment.role_code]??assignment.role_code} · {assignment.nature_affectation==="urgence"?"Temporaire / urgence":"Ordinaire"} · {active?"Active":assignment.statut==="revoked"?"Révoquée":"Inactive"}</p>
                  <p className="mt-1 text-xs text-slate-500">Début : {dateLabel(assignment.commence_at)} · Fin : {assignment.expire_at?dateLabel(assignment.expire_at):"sans échéance"} · Motif : {assignment.motif}</p>
                  {assignment.revoque_at&&<p className="mt-1 text-xs text-slate-500">Révoquée le {dateLabel(assignment.revoque_at)} · {assignment.motif_revocation}</p>}
                </div>
                {(isPromoteur||(responsableCanRevokeCashier&&assignment.role_code==="caisse"))&&active&&<form action={revoquerAffectationParapharmacie} className="flex max-w-sm flex-col gap-2">
                  <input type="hidden" name="partner_id" value={partnerId}/>
                  <input type="hidden" name="affectation_id" value={assignment.id}/>
                  <input name="motif_revocation" required minLength={5} maxLength={500} placeholder="Motif de révocation" className="rounded-lg border p-2 text-sm"/>
                  <button className="min-h-10 rounded-lg border border-red-300 px-3 text-sm font-bold text-red-800">Révoquer cette fonction</button>
                </form>}
              </div>
              {isPromoteur&&active&&allowed.length>0&&<div className="mt-4 rounded-lg bg-slate-50 p-3">
                <p className="text-sm font-bold">Privilèges délégables pour ce rôle</p>
                {memberGrants.length>0&&<div className="mt-2 flex flex-wrap gap-2">{memberGrants.map((privilege:any)=><form key={privilege.code} action={retirerPrivilegeParapharmacie}>
                  <input type="hidden" name="partner_id" value={partnerId}/><input type="hidden" name="profile_id" value={assignment.profile_id}/><input type="hidden" name="privilege_code" value={privilege.code}/>
                  <button className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300" title="Retirer ce privilège">{privilege.libelle} ×</button>
                </form>)}</div>}
                <form action={attribuerPrivilegeParapharmacie} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="partner_id" value={partnerId}/><input type="hidden" name="profile_id" value={assignment.profile_id}/>
                  <select name="privilege_code" required defaultValue="" className="min-h-10 min-w-52 flex-1 rounded-lg border bg-white px-3 text-sm">
                    <option value="" disabled>Ajouter un privilège</option>
                    {allowed.filter((p:any)=>!grantsByKey.has(assignment.profile_id+":"+p.code)).map((p:any)=><option key={p.code} value={p.code}>{p.libelle}</option>)}
                  </select>
                  <button className="min-h-10 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white">Déléguer</button>
                </form>
              </div>}
            </article>;
          })}
        </div>
      </section>
    </div>
  </main>;
}
