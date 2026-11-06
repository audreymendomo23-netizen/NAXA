"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";

type Pharmacy={id:string;nom:string};
type CourierAssignment={
  assignment_id:string;
  profile_id:string;
  pharmacie_id:string;
  fonction:string;
  statut:string;
  nature_affectation:string;
  motif:string;
  commence_at:string;
  expire_at:string|null;
  accorde_at:string;
  revoque_at:string|null;
  motif_revocation:string|null;
  profile_active:boolean;
  first_name:string|null;
  last_name:string|null;
  username:string|null;
};

const date=(value:string|null)=>value?new Date(value).toLocaleString("fr-FR",{dateStyle:"medium",timeStyle:"short"}):"—";

export function LivreursAssignmentsManager({pharmacies}:{pharmacies:Pharmacy[]}){
  const [rows,setRows]=useState<CourierAssignment[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [revokeId,setRevokeId]=useState<string|null>(null);
  const [reason,setReason]=useState("");
  const pharmacyIds=useMemo(()=>pharmacies.map(p=>p.id),[pharmacies]);
  const pharmacyNames=useMemo(()=>new Map(pharmacies.map(p=>[p.id,p.nom])),[pharmacies]);

  const load=useCallback(async()=>{
    if(!pharmacyIds.length){setRows([]);setLoading(false);return;}
    const {data,error:rpcError}=await supabaseBrowser().rpc("naxa_livreurs_management_list",{
      p_pharmacies:pharmacyIds,
    });
    if(rpcError){
      setError("Impossible de charger les livreurs de ce périmètre. Vérifiez le réseau, le poste actif et les droits de gestion d’équipe.");
      setRows([]);
    }else{
      setError("");
      setRows(Array.isArray(data)?data as CourierAssignment[]:[]);
    }
    setLoading(false);
  },[pharmacyIds]);

  useEffect(()=>{void load();},[load]);

  async function revoke(row:CourierAssignment){
    if(busy||reason.trim().length<5)return;
    setBusy(row.assignment_id);setError("");setSuccess("");
    const {error:rpcError}=await supabaseBrowser().rpc("naxa_revoke_professional_assignment",{
      p_assignment:row.assignment_id,
      p_motif:reason.trim(),
    });
    if(rpcError){
      setError("Révocation refusée. Vérifiez que la mission du livreur est clôturée et que votre affectation de gestion est encore valide.");
    }else{
      setSuccess("Affectation Livreur révoquée. Les autres pharmacies et affectations distinctes restent inchangées.");
      setRevokeId(null);setReason("");
      await load();
    }
    setBusy(null);
  }

  const activeCount=new Set(rows.filter(row=>{
    const now=Date.now();
    return row.statut==="active"&&row.profile_active&&new Date(row.commence_at).getTime()<=now
      &&(!row.expire_at||new Date(row.expire_at).getTime()>now);
  }).map(row=>row.profile_id)).size;

  return <section className="rounded-2xl border border-emerald-950/10 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-extrabold text-slate-900">Équipe de livraison</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Tous les Livreurs affectés aux pharmacies de votre périmètre, y compris ceux dont l’affectation a été accordée par un autre niveau autorisé.</p>
      </div>
      <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
        <p className="text-xs font-semibold text-emerald-900">Livreurs actifs</p>
        <p className="text-2xl font-black text-emerald-950">{activeCount}</p>
      </div>
    </div>

    {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">{error}</p>}
    {success&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{success}</p>}
    {loading?<p className="mt-4 text-sm text-slate-600">Chargement des affectations Livreur…</p>
      :rows.length===0?<p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucun Livreur affecté dans ce périmètre. Utilisez le formulaire d’invitation ou attribuez le poste à un compte NAXA existant.</p>
      :<div className="mt-4 space-y-3">
        {rows.map(row=>{
          const now=Date.now();
          const activeNow=row.statut==="active"&&row.profile_active
            &&new Date(row.commence_at).getTime()<=now
            &&(!row.expire_at||new Date(row.expire_at).getTime()>now);
          const expired=Boolean(row.expire_at&&new Date(row.expire_at).getTime()<=now);
          const name=[row.first_name,row.last_name].filter(Boolean).join(" ")||"Nom non renseigné";
          const status=row.statut==="revoked"?"Révoquée":expired?"Expirée":!row.profile_active?"Compte suspendu":activeNow?"Active":"À venir";
          return <article key={row.assignment_id} className="rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-slate-900">{name}</h3>
                <p className="mt-1 text-sm text-slate-600">@{row.username??"identifiant non renseigné"}</p>
                <p className="mt-1 text-xs text-slate-500">{pharmacyNames.get(row.pharmacie_id)??"Pharmacie du réseau"}</p>
              </div>
              <span className={activeNow?"rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-950":"rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"}>{status}</span>
            </div>
            <div className="mt-3 grid gap-2 border-t pt-3 text-xs text-slate-600 sm:grid-cols-2">
              <p>Affecté le : <strong>{date(row.accorde_at)}</strong></p>
              <p>Début : <strong>{date(row.commence_at)}</strong></p>
              <p>Fin prévue : <strong>{date(row.expire_at)}</strong></p>
              <p>Type : <strong>{row.nature_affectation==="urgence"?"Urgence · temporaire":"Ordinaire · permanente"}</strong></p>
            </div>
            {row.statut==="revoked"&&row.motif_revocation&&<p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">Motif de révocation : {row.motif_revocation}</p>}
            {row.statut==="active"&&<div className="mt-3 border-t pt-3">
              {revokeId===row.assignment_id?
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Motif de révocation (5 à 500 caractères)
                    <textarea value={reason} onChange={event=>setReason(event.target.value)} minLength={5} maxLength={500} rows={2} className="mt-1 w-full rounded-lg border p-3" placeholder="Ex. Fin de collaboration avec la pharmacie"/>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={Boolean(busy)||reason.trim().length<5} onClick={()=>void revoke(row)} className="min-h-10 rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy===row.assignment_id?"Révocation…":"Confirmer la révocation"}</button>
                    <button type="button" disabled={Boolean(busy)} onClick={()=>{setRevokeId(null);setReason("");}} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold">Annuler</button>
                  </div>
                </div>
                :<button type="button" onClick={()=>{setRevokeId(row.assignment_id);setReason("");}} className="min-h-10 rounded-lg border border-red-200 px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-50">Révoquer cette affectation</button>}
            </div>}
          </article>;
        })}
      </div>}
  </section>;
}
