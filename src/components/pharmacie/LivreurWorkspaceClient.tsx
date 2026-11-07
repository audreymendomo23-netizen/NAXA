"use client";

import Link from "next/link";
import {useCallback,useEffect,useMemo,useState} from "react";
import {supabaseBrowser} from "@/lib/supabase/client";
import {EspaceNaxaSwitcher} from "@/components/EspaceNaxaSwitcher";
import {DeliveryClientSignaturePad} from "@/components/DeliveryClientSignaturePad";
import {DeliveryMissionChat} from "@/components/DeliveryMissionChat";

type Item={quantite:number;nom:string;dosage:string|null};
type Mission={
  id:string;reservation_id:string;statut:string;created_at:string;ready_at:string;
  accepted_at:string|null;picked_up_at:string|null;arrived_at:string|null;delivered_at:string|null;
  failed_at?:string|null;failure_code:string|null;failure_note:string|null;commande_statut:string|null;
  paiement_mode:string|null;paiement_statut:string;montant_a_encaisser:number;frais_livraison:number;
  cash_payment_status:string|null;cash_received:number|null;
  client_confirme_at?:string|null;livreur_confirme_at?:string|null;signature_client?:boolean;
  livraison_depart_at?:string|null;livraison_echeance_at?:string|null;duree_livraison_estimee_min?:number|null;
  total:number;ville:string|null;quartier:string|null;
  adresse:string|null;repere:string|null;telephone:string|null;items:Item[];
};
type Stats={
  period_days:number;total:number;available:number;in_progress:number;delivered:number;failed:number;
  acceptance_rate:number;avg_accept_minutes:number|null;avg_delivery_minutes:number|null;
};
type Profile={first_name:string|null;last_name:string|null;username:string|null;phone:string|null;age_verified:boolean;actif:boolean};

const statusLabels:Record<string,string>={
  available:"À prendre",accepted:"Acceptée · retrait en attente",picked_up:"En cours de livraison",
  arrived:"Arrivée · validation Client attendue",delivered:"Livrée",failed:"Incident signalé",cancelled:"Annulée",
};
const issueLabels:Record<string,string>={client_absent:"Client absent",client_injoignable:"Client injoignable",adresse_introuvable:"Adresse introuvable",incident_route:"Incident sur le trajet",commande_endommagee:"Colis endommagé",autre:"Autre difficulté"};
const money=(value:number)=>Number(value??0).toLocaleString("fr-FR")+" FCFA";
const date=(value:string|null)=>value?new Date(value).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"}):"—";

export function LivreurWorkspaceClient({pharmacyName}:{pharmacyName:string}){
  const [missions,setMissions]=useState<Mission[]>([]);
  const [stats,setStats]=useState<Stats|null>(null);
  const [profile,setProfile]=useState<Profile|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [busy,setBusy]=useState<string|null>(null);
  const [automaticTracking,setAutomaticTracking]=useState(false);
  const [cashReceived,setCashReceived]=useState<Record<string,string>>({});

  const load=useCallback(async()=>{
    const sb=supabaseBrowser();
    const [{data:missionData,error:missionError},{data:statsData,error:statsError},{data:auth}]=await Promise.all([
      sb.rpc("naxa_delivery_my_missions",{p_include_history:true}),
      sb.rpc("naxa_delivery_my_performance",{p_days:30}),
      sb.auth.getUser(),
    ]);
    if(missionError||statsError){
      setError(missionError?.message||statsError?.message||"Impossible de charger vos données de livraison.");
      setLoading(false);
      return;
    }
    setMissions(Array.isArray(missionData)?missionData as Mission[]:[]);
    setStats((statsData??null) as Stats|null);
    if(auth.user){
      const {data}=await sb.from("profiles")
        .select("first_name,last_name,username,phone,age_verified,actif")
        .eq("id",auth.user.id).maybeSingle();
      setProfile((data??null) as Profile|null);
    }
    setError("");
    setLoading(false);
  },[]);

  useEffect(()=>{
    void load();
    const timer=window.setInterval(()=>void load(),15000);
    return()=>window.clearInterval(timer);
  },[load]);

  const available=useMemo(()=>missions.filter(m=>m.statut==="available"),[missions]);
  const active=useMemo(()=>missions.filter(m=>["accepted","picked_up","arrived"].includes(m.statut)),[missions]);
  const history=useMemo(()=>missions.filter(m=>["delivered","failed","cancelled"].includes(m.statut)),[missions]);
  const pickedUpMissionId=useMemo(()=>missions.find(m=>m.statut==="picked_up")?.id??null,[missions]);

  useEffect(()=>{
    if(!automaticTracking||!pickedUpMissionId)return;
    if(!navigator.geolocation){setError("La géolocalisation n’est pas disponible sur cet appareil.");setAutomaticTracking(false);return;}
    let alive=true;
    let lastSentAt=0;
    const watchId=navigator.geolocation.watchPosition(async position=>{
      const now=Date.now();
      if(now-lastSentAt<15000)return;
      lastSentAt=now;
      const {error:rpcError}=await supabaseBrowser().rpc("naxa_delivery_add_location",{
        p_mission:pickedUpMissionId,
        p_latitude:position.coords.latitude,
        p_longitude:position.coords.longitude,
        p_accuracy_m:position.coords.accuracy,
      });
      if(alive&&rpcError)setError("La position automatique n’a pas pu être partagée. Vérifiez votre connexion.");
    },()=>{
      if(alive)setError("Accès GPS refusé. Activez la localisation ou partagez une position manuellement.");
    },{enableHighAccuracy:true,maximumAge:10000,timeout:20000});
    return()=>{alive=false;navigator.geolocation.clearWatch(watchId);};
  },[automaticTracking,pickedUpMissionId]);

  async function callAction(id:string,fn:string,args:Record<string,unknown>={}){
    if(busy)return;
    setBusy(id);setError("");
    const {error:rpcError}=await supabaseBrowser().rpc(fn,{p_mission:id,...args});
    if(rpcError)setError(rpcError.message||"Action refusée. Vérifiez que votre affectation Livreur est encore active.");
    else await load();
    setBusy(null);
  }

  function withPosition(id:string,fn:string){
    if(!navigator.geolocation){
      setError("La géolocalisation n’est pas disponible sur cet appareil.");
      return;
    }
    setBusy(id);setError("");
    navigator.geolocation.getCurrentPosition(async position=>{
      const args:Record<string,unknown>={
        p_mission:id,p_latitude:position.coords.latitude,p_longitude:position.coords.longitude,
      };
      if(fn==="naxa_delivery_pickup"||fn==="naxa_delivery_add_location")args.p_accuracy_m=position.coords.accuracy;
      const {error:rpcError}=await supabaseBrowser().rpc(fn,args);
      if(rpcError)setError(rpcError.message||"La position n’a pas pu être partagée.");
      else await load();
      setBusy(null);
    },()=>{
      setError("Autorisez la localisation pour partager votre position avec le Client.");
      setBusy(null);
    },{enableHighAccuracy:true,timeout:12000,maximumAge:15000});
  }

  function exportCsv(){
    const rows=missions.filter(m=>m.statut!=="available");
    const values=[
      ["Commande","Statut","Ville","Quartier","Montant FCFA","Préparée le","Acceptée le","Retirée le","Arrivée le","Livrée le","Incident"],
      ...rows.map(m=>[
        m.reservation_id.slice(0,8).toUpperCase(),statusLabels[m.statut]??m.statut,
        m.ville??"",m.quartier??"",String(m.total??0),m.ready_at??"",m.accepted_at??"",
        m.picked_up_at??"",m.arrived_at??"",m.delivered_at??"",m.failure_code?issueLabels[m.failure_code]??m.failure_code:"",
      ]),
    ];
    const csv="\uFEFF"+values.map(row=>row.map(value=>'"'+String(value).replace(/"/g,'""')+'"').join(";")).join("\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const anchor=document.createElement("a");
    anchor.href=url;anchor.download="naxa-rapport-livreur.csv";anchor.click();
    URL.revokeObjectURL(url);
  }

  async function logout(){
    await supabaseBrowser().auth.signOut();
    window.location.assign("/connexion");
  }

  return <main className="min-h-dvh bg-[#F4F8F5] px-4 pb-16 pt-5 text-slate-900">
    <div className="mx-auto max-w-6xl space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] p-5 text-white">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-100">NAXA · Poste professionnel</p>
          <h1 className="mt-1 text-2xl font-black">Tableau de bord Livreur</h1>
          <p className="mt-1 text-sm text-emerald-100">{pharmacyName}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>void load()} className="min-h-10 rounded-xl border border-white/30 px-3 text-sm font-bold">Actualiser</button>
          <EspaceNaxaSwitcher current="livreur" />
          <button type="button" onClick={()=>void logout()} className="min-h-10 rounded-xl bg-white px-3 text-sm font-bold text-emerald-950">Déconnexion</button>
        </div>
      </header>

      <nav aria-label="Modules Livreur" className="flex flex-wrap gap-2 rounded-2xl border bg-white p-3 text-sm font-bold">
        <a href="#missions" className="rounded-xl bg-emerald-50 px-3 py-2 text-emerald-950">Missions</a>
        <a href="#performances" className="rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Performances</a>
        <a href="#rapports" className="rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Rapports</a>
        <Link href="/pharmacie/livreur/profil" className="rounded-xl px-3 py-2 text-slate-700 hover:bg-slate-50">Mon profil</Link>
      </nav>

      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{error}</p>}
      {loading?<section className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Chargement des missions…</section>:<>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Missions disponibles</p><p className="mt-1 text-3xl font-black">{available.length}</p></article>
          <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Mes livraisons en cours</p><p className="mt-1 text-3xl font-black">{active.length}</p></article>
          <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Livrées · 30 jours</p><p className="mt-1 text-3xl font-black">{stats?.delivered??0}</p></article>
          <article className="rounded-2xl border bg-white p-4"><p className="text-sm text-slate-500">Incidents · 30 jours</p><p className="mt-1 text-3xl font-black">{stats?.failed??0}</p></article>
        </section>

        <section id="missions" className="scroll-mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div><h2 className="text-xl font-black">File des missions</h2><p className="mt-1 text-sm text-slate-600">Dès que Stock confirme une demande, la mission est proposée aux livreurs. Le retrait reste bloqué jusqu’au paiement autorisé et à la préparation physique.</p></div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-600">{available.length} disponible(s)</span>
          </div>
          {available.length===0?<p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Aucune nouvelle mission prête dans cette pharmacie.</p>:
            <div className="grid gap-3 lg:grid-cols-2">{available.map(m=><article key={m.id} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Nouvelle mission</p><h3 className="mt-1 text-lg font-black">Commande #{m.reservation_id.slice(0,8).toUpperCase()}</h3></div><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-950">À prendre</span></div>
              <p className="mt-3 text-sm text-slate-600">{[m.quartier,m.ville].filter(Boolean).join(" · ")||"Zone de livraison non précisée"}</p>
              <p className="mt-2 text-lg font-black">{money(m.total)}</p>
              <p className="mt-1 text-xs text-slate-500">Demande confirmée par Stock : {date(m.ready_at)} · L’adresse et le téléphone seront visibles après acceptation.</p>
              <button type="button" disabled={busy===m.id||Boolean(busy)} onClick={()=>void callAction(m.id,"naxa_delivery_accept")} className="mt-4 min-h-11 w-full rounded-xl bg-[#0B3D26] px-4 py-3 text-sm font-bold text-white disabled:opacity-50">{busy===m.id?"Acceptation…":"Accepter cette livraison"}</button>
            </article>)}</div>}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-black">Mes livraisons en cours</h2>
          {active.length===0?<p className="rounded-2xl border bg-white p-5 text-sm text-slate-600">Vous n’avez pas de livraison en cours.</p>:
            <div className="grid gap-3 lg:grid-cols-2">{active.map(m=><article key={m.id} className="rounded-2xl border bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Mission active</p><h3 className="mt-1 text-lg font-black">Commande #{m.reservation_id.slice(0,8).toUpperCase()}</h3></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-950">{statusLabels[m.statut]??m.statut}</span></div>
              <p className="mt-2 text-sm text-slate-600">{[m.adresse,m.repere,m.quartier,m.ville].filter(Boolean).join(", ")||"Adresse non renseignée"}</p>
              <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-emerald-900">Contacter le Client</p>
                {m.telephone
                  ? <a href={"tel:"+m.telephone} className="mt-2 inline-flex min-h-10 items-center rounded-lg bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white">Appeler le Client · {m.telephone}</a>
                  : <p className="mt-2 text-xs text-amber-900">Numéro non renseigné. Utilisez la messagerie NAXA.</p>}
                <DeliveryMissionChat reservationId={m.reservation_id} viewer="livreur"/>
              </div>
              <ul className="mt-3 space-y-1 border-t pt-3 text-sm">{(m.items??[]).map((item,i)=><li key={i}>{item.quantite} × {item.nom}{item.dosage?" · "+item.dosage:""}</li>)}</ul>
              <p className="mt-3 font-extrabold">Articles : {money(m.total)}</p>{m.statut==="arrived"&&m.paiement_mode==="especes_livraison"&&<p className="mt-1 text-sm font-bold">À encaisser avec la livraison : {money(m.montant_a_encaisser)}</p>}
              <div className="mt-4 flex flex-wrap gap-2">
                {m.statut==="accepted"&&<button type="button" disabled={Boolean(busy)} onClick={()=>withPosition(m.id,"naxa_delivery_pickup")} className="min-h-11 rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmer le retrait</button>}
                {m.statut==="picked_up"&&<button type="button" disabled={Boolean(busy)} onClick={()=>void callAction(m.id,"naxa_delivery_arrived")} className="min-h-11 rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Signaler mon arrivée</button>}{m.statut==="picked_up"&&<button type="button" aria-pressed={automaticTracking} onClick={()=>setAutomaticTracking(value=>!value)} className={automaticTracking?"min-h-11 rounded-xl bg-emerald-100 px-4 py-2 text-sm font-bold text-emerald-950":"min-h-11 rounded-xl border border-emerald-900/20 px-4 py-2 text-sm font-bold text-emerald-950"}>{automaticTracking?"Arrêter le suivi GPS":"Activer le suivi GPS automatique"}</button>}
                {["accepted","picked_up","arrived"].includes(m.statut)&&<button type="button" disabled={Boolean(busy)} onClick={()=>withPosition(m.id,"naxa_delivery_add_location")} className="min-h-11 rounded-xl border border-emerald-900/20 px-4 py-2 text-sm font-bold text-emerald-950 disabled:opacity-50">Partager ma position</button>}
                {m.statut==="arrived"&&<div className="w-full space-y-3"><div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-950"><p className="font-bold">Validation en deux parties</p><p className="mt-1">Client : {m.client_confirme_at?"confirmé":"en attente"} · Livreur : {m.livreur_confirme_at?"confirmé":"en attente"}</p>{m.signature_client&&<p className="mt-1">Signature recueillie sur ce téléphone.</p>}</div>{m.paiement_mode==="especes_livraison"&&m.paiement_statut!=="effectue"&&<div className="rounded-xl border border-amber-200 p-3"><p className="text-sm font-bold">Paiement en espèces à la remise</p>{m.cash_payment_status==="cash_declared"?<p role="status" className="mt-2 text-sm text-emerald-800">Espèces déclarées : {money(m.cash_received??0)}. La Caisse de la pharmacie doit rapprocher et valider l’encaissement.</p>:<><label className="mt-2 block text-sm font-semibold">Espèces reçues du Client (FCFA)<input type="number" min={m.montant_a_encaisser} step="1" inputMode="numeric" className="champ mt-1" value={cashReceived[m.id]??String(m.montant_a_encaisser)} onChange={event=>setCashReceived(current=>({...current,[m.id]:event.target.value}))}/></label><button type="button" disabled={Boolean(busy)} onClick={()=>{const amount=Number(cashReceived[m.id]??m.montant_a_encaisser);if(!Number.isSafeInteger(amount)||amount<m.montant_a_encaisser){setError("Le montant reçu doit couvrir le total à encaisser.");return;}void callAction(m.id,"naxa_delivery_courier_declare_cash",{p_cash_received:amount});}} className="mt-3 min-h-10 w-full rounded-lg bg-amber-700 px-3 py-2 text-sm font-bold text-white">Déclarer les espèces reçues</button></>}</div>}{!m.livreur_confirme_at&&<button type="button" disabled={Boolean(busy)} onClick={()=>void callAction(m.id,"naxa_delivery_confirm_handover")} className="min-h-11 w-full rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Confirmer que j’ai remis la commande</button>}{m.livreur_confirme_at&&!m.client_confirme_at&&<p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">Votre confirmation est enregistrée. La commande attend la confirmation du Client ou sa signature sur ce téléphone.</p>}<DeliveryClientSignaturePad missionId={m.id} onDone={()=>void load()}/></div>}
              </div>
              {["accepted","picked_up","arrived"].includes(m.statut)&&<div className="mt-4 border-t pt-3">
                <p className="text-xs font-bold uppercase text-slate-500">Signaler une difficulté</p>
                <div className="mt-2 flex flex-wrap gap-2">{(["client_absent","adresse_introuvable","incident_route"] as const).map(code=><button key={code} type="button" disabled={Boolean(busy)} onClick={()=>void callAction(m.id,"naxa_delivery_report_issue",{p_code:code,p_note:null})} className="rounded-lg border px-3 py-2 text-xs font-semibold disabled:opacity-50">{issueLabels[code]}</button>)}</div>
              </div>}
              {m.statut==="picked_up"&&<p className="mt-2 text-xs text-slate-500">Le suivi GPS automatique fonctionne uniquement pendant que cet écran reste ouvert et que la localisation est autorisée. Il s’arrête lorsque vous le désactivez ou signalez votre arrivée.</p>}{m.livraison_echeance_at&&["picked_up","arrived"].includes(m.statut)&&<p className="mt-2 text-sm font-bold text-emerald-900">Délai estimé : {date(m.livraison_echeance_at)}</p>}<p className="mt-3 text-xs text-slate-500">Acceptée : {date(m.accepted_at)} · Retirée : {date(m.picked_up_at)} · Arrivée : {date(m.arrived_at)}</p>
            </article>)}</div>}
        </section>

        <section id="performances" className="scroll-mt-4 rounded-2xl border bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black">Performances personnelles</h2><p className="mt-1 text-sm text-slate-600">Indicateurs calculés sur les missions auxquelles vos pharmacies vous donnent accès.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">30 jours</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Taux d’offres acceptées</p><p className="mt-1 text-2xl font-black">{stats?.acceptance_rate??0}%</p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Prise moyenne</p><p className="mt-1 text-2xl font-black">{stats?.avg_accept_minutes??"—"} <span className="text-xs">min</span></p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Durée moyenne</p><p className="mt-1 text-2xl font-black">{stats?.avg_delivery_minutes??"—"} <span className="text-xs">min</span></p></div>
            <div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Missions comptabilisées</p><p className="mt-1 text-2xl font-black">{stats?.total??0}</p></div>
          </div>
        </section>

        <section id="rapports" className="scroll-mt-4 rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-black">Historique & rapports</h2>
          <p className="mt-1 text-sm text-slate-600">Exportez vos missions, jalons et incidents en CSV pour vos contrôles personnels.</p>
          <div className="mt-3 flex flex-wrap items-center gap-3"><span className="text-sm font-semibold">{history.length} mission(s) historisée(s) chargée(s)</span><button type="button" onClick={exportCsv} className="min-h-11 rounded-xl bg-[#0B3D26] px-4 py-2 text-sm font-bold text-white">Exporter mon rapport CSV</button></div>
          {history.slice(0,5).map(m=><div key={m.id} className="mt-3 flex flex-wrap justify-between gap-2 border-t pt-3 text-sm"><span>#{m.reservation_id.slice(0,8).toUpperCase()} · {statusLabels[m.statut]??m.statut}</span><span className="text-slate-500">{date(m.delivered_at??m.failed_at??m.created_at)}</span></div>)}
        </section>

        <section id="compte" className="scroll-mt-4 rounded-2xl border bg-white p-5">
          <h2 className="text-xl font-black">Mon compte Livreur</h2>
          {profile?<div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <p><span className="text-slate-500">Nom :</span> <strong>{[profile.first_name,profile.last_name].filter(Boolean).join(" ")||"—"}</strong></p>
            <p><span className="text-slate-500">Identifiant :</span> <strong>@{profile.username??"—"}</strong></p>
            <p><span className="text-slate-500">Téléphone :</span> <strong>{profile.phone??"—"}</strong></p>
            <p><span className="text-slate-500">Profil majeur vérifié :</span> <strong>{profile.age_verified?"Oui":"À vérifier"}</strong></p>
          </div>:<p className="mt-2 text-sm text-slate-600">Profil indisponible.</p>}
          <Link href="/pharmacie/livreur/profil" className="mt-4 inline-flex min-h-11 items-center rounded-xl border px-4 py-2 text-sm font-bold text-emerald-950">Ouvrir mon profil Livreur</Link>
        </section>
      </>}
    </div>
  </main>;
}
