import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { deciderCumulProfessionnel } from "./actions";

const statusLabel:Record<string,string>={
  pending:"En attente",approved:"Toutes les autorisations réunies",rejected:"Refusée",
  cancelled:"Annulée",completed:"Traitée",invalidated:"Invalidée",
};
const directionLabel:Record<string,string>={
  PHARMACIE_VERS_SPD:"Pharmacie → Soins & Prestations à domicile",
  SPD_VERS_PHARMACIE:"Soins & Prestations à domicile → Pharmacie",
};

export default async function CumulNaxaPage({searchParams}:{
  searchParams:Promise<{ok?:string;erreur?:string}>
}){
  const filters=await searchParams;
  const sb=supabaseServer();
  const {data:auth}=await sb.auth.getUser();
  if(!auth.user)redirect("/connexion?retour=/naxa/cumuls");
  const [{data:profile},{data:activeRole},{data:activePartner},{data:requests,error:requestError},{data:approvals,error:approvalError}]=await Promise.all([
    sb.from("profiles").select("actif").eq("id",auth.user.id).maybeSingle(),
    sb.rpc("naxa_business_function"),
    sb.rpc("naxa_active_role_partner"),
    sb.from("naxa_cumulative_activity_requests")
      .select("id,target_profile_id,requested_by,direction,destination_pharmacy_id,destination_role_code,reason,target_display_name,status,created_at,updated_at,completed_at")
      .order("created_at",{ascending:false}).limit(100),
    sb.from("naxa_cumulative_activity_approvals")
      .select("id,request_id,approver_id,organization_type,organization_id,organization_label,is_admin_required,status,decided_at,decision_reason,created_at")
      .order("created_at",{ascending:false}).limit(200),
  ]);
  if(!profile||profile.actif!==true)redirect("/");
  const isAdmin=activeRole==="admin";
  const canDecide=(approval:any)=> {
    if(isAdmin) return approval.is_admin_required===true;
    if(approval.is_admin_required||approval.approver_id!==auth.user.id) return false;
    if(approval.organization_type==="pharmacie") return activeRole==="promoteur";
    if(approval.organization_type==="spd") return activeRole==="prestations"&&activePartner===approval.organization_id;
    return false;
  };
  const requestRows=requests??[];
  const approvalRows=approvals??[];
  const approvalsByRequest=new Map<string,typeof approvalRows>();
  for(const approval of approvalRows){
    const list=approvalsByRequest.get(approval.request_id)??[];
    list.push(approval);
    approvalsByRequest.set(approval.request_id,list);
  }
  const errors:Record<string,string>={
    validation:"Vérifie la décision et indique un motif d’au moins 5 caractères pour un refus.",
    autorisation:"Décision refusée : tu n’es plus l’autorité active de cette organisation ou tu n’es pas habilité.",
  };
  const success:Record<string,string>={
    demande_envoyee:"Demande créée. Aucune activité professionnelle n’est activée avant les accords requis.",
    approuve:"Accord enregistré. Le dossier poursuit son parcours lorsque toutes les validations sont réunies.",
    refuse:"Refus enregistré. Le cumul est bloqué.",
    annule:"La demande a été annulée car une autorité a été révoquée ou une organisation est devenue inactive.",
    decision:"Décision enregistrée.",
  };
  return <main className="min-h-screen bg-[#F4F8F5] px-4 py-5 text-slate-900">
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-4 text-white">
        <div><p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Identité et espaces</p><h1 className="text-2xl font-black">Demandes de cumul professionnel</h1>
          <p className="mt-1 text-sm text-emerald-50">Les accords sont organisationnels. Ils ne remplacent jamais les habilitations ni les exigences réglementaires.</p></div>
        <nav className="flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/pharmacie/affectations" className="underline">Équipe Pharmacie</Link>
          <Link href="/partenaire/prestations" className="underline">Espace SPD</Link>
          <Link href="/" className="underline">Accueil</Link>
        </nav>
      </header>
      {filters.ok&&<p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{success[filters.ok]??"Opération enregistrée."}</p>}
      {filters.erreur&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-900">{errors[filters.erreur]??"L’opération n’a pas abouti."}</p>}
      {(requestError||approvalError)&&<p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950">Lecture partielle des demandes. Les données manquantes ne sont pas considérées comme approuvées.</p>}
      {!requestRows.length&&!requestError&&!approvalError&&<p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Aucune demande de cumul accessible pour ce compte.</p>}
      {requestRows.map((request:any)=>{
        const requestApprovals=approvalsByRequest.get(request.id)??[];
        return <section key={request.id} className="space-y-3 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-xs font-extrabold uppercase tracking-wider text-emerald-800">{directionLabel[request.direction]??request.direction}</p>
              <h2 className="mt-1 text-lg font-extrabold">{request.target_display_name}</h2>
              <p className="mt-1 text-sm text-slate-600">{request.reason}</p>
              {request.destination_role_code&&<p className="mt-1 text-sm">Poste demandé : <strong>{request.destination_role_code}</strong></p>}
              <p className="mt-1 text-xs text-slate-500">Créée le {new Date(request.created_at).toLocaleString("fr-FR",{timeZone:"Africa/Douala"})}</p>
            </div>
            <span className="rounded-full border px-3 py-1 text-xs font-bold">{statusLabel[request.status]??request.status}</span>
          </div>
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-extrabold">Autorisations requises</h3>
            {!requestApprovals.length&&<p className="text-sm text-slate-500">Aucune autorisation visible ou aucune organisation source.</p>}
            {requestApprovals.map((approval:any)=><article key={approval.id} className="rounded-xl border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="font-bold">{approval.organization_label} · {approval.organization_type==="pharmacie"?"Pharmacie":"SPD"}</p>
                  <p className="text-xs text-slate-500">{approval.is_admin_required?"Arbitrage Admin requis":"Décision du responsable de l’organisation"}</p>
                  {approval.decision_reason&&<p className="mt-1 text-xs text-slate-600">Motif : {approval.decision_reason}</p>}
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{statusLabel[approval.status]??approval.status}</span>
              </div>
              {approval.status==="pending"&&canDecide(approval)&&<form action={deciderCumulProfessionnel} className="mt-3 space-y-2">
                <input type="hidden" name="approval_id" value={approval.id}/>
                <label className="block text-xs font-semibold">Motif (obligatoire en cas de refus)
                  <textarea name="decision_reason" maxLength={500} rows={2} className="mt-1 w-full rounded-lg border p-2 text-sm"/>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button name="decision" value="approve" className="min-h-10 rounded-lg bg-emerald-800 px-4 text-sm font-bold text-white">Accepter</button>
                  <button name="decision" value="reject" className="min-h-10 rounded-lg border border-red-300 px-4 text-sm font-bold text-red-800">Refuser</button>
                </div>
              </form>}
            </article>)}
          </div>
        </section>;
      })}
    </div>
  </main>;
}
