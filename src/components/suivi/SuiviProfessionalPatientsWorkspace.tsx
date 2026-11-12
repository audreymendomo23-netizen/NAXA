"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SuiviProfessionalWorkspaceShell } from "@/components/suivi/SuiviProfessionalWorkspaceShell";
import { SuiviHistoryChart } from "@/components/suivi/SuiviHistoryChart";
import { SuiviClinicalCasePanel } from "@/components/suivi/SuiviClinicalCasePanel";
import { supabaseBrowser } from "@/lib/supabase/client";

type Share = { id: string; owner_user_id: string; measurement_type: string; granted_at: string; active: boolean; revoked_at: string | null; allow_history:boolean; allow_realtime:boolean; allow_alerts:boolean; realtime_from_at:string|null };
type Measurement = { id: string; user_id: string; measurement_type: string; value_numeric: number | null; value_text: string | null; unit: string | null; measured_at: string; source: string; note: string | null };
type SharedAlert = { id: string; user_id: string; measurement_id: string; measurement_type: string; observed_value: number; alert_kind: "below_user_range" | "above_user_range"; created_at: string; read_at: string | null };
type SharedDevice = { id:string; user_id:string; device_key:string; device_name:string; device_model:string|null; device_brand:string|null; connection_state:string; auto_reconnect:boolean; last_measurement_at:string|null; protocol:string|null; active:boolean; firmware_version:string|null; metadata:Record<string,unknown>|null };
type ViewTab = "patients" | "mesures" | "alertes" | "partages";
type ReportPeriod = "day" | "month" | "year" | "custom";
type TrendPoint = { id: string; measured_at: string; value_numeric: number; unit: string | null };
const labels: Record<string, string> = {
  tension_systolique: "Tension systolique", tension_diastolique: "Tension diastolique",
  frequence_cardiaque: "Fréquence cardiaque", temperature: "Température",
  saturation_oxygene: "Saturation en oxygène", glycemie: "Glycémie", poids: "Poids",
  taille: "Taille", imc: "IMC", frequence_respiratoire: "Fréquence respiratoire",
  cholesterol_total: "Cholestérol total", sommeil_heures: "Sommeil", pas_jour: "Pas",
  activite_minutes: "Activité", hydratation_ml: "Hydratation", douleur_score: "Douleur (auto-déclarée)",
  humeur_score: "Humeur (auto-déclarée)", cycle_jour: "Cycle", medicament_pris: "Prise de traitement déclarée",
  symptome_note: "Note de symptôme", debit_expiratoire: "Débit expiratoire", ecg_note: "Note ECG",
  masse_grasse: "Masse grasse", masse_musculaire: "Masse musculaire", masse_osseuse: "Masse osseuse",
  cetonemie: "Cétonémie", acide_urique: "Acide urique", cholesterol_hdl: "Cholestérol HDL",
  cholesterol_ldl: "Cholestérol LDL", capacite_vitale: "Capacité vitale",
};
const dateLabel = (value: string) => new Date(value).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
const patientLabel = (id: string) => `Patient ${id.slice(0, 8).toUpperCase()}`;

export function SuiviProfessionalPatientsWorkspace() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [recipientId, setRecipientId] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [shares, setShares] = useState<Share[]>([]);
  const [clinicalCasePatientIds,setClinicalCasePatientIds]=useState<string[]>([]);
  const [activeClinicalCasePatientIds,setActiveClinicalCasePatientIds]=useState<string[]>([]);
  const [carePatientIds,setCarePatientIds]=useState<string[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [sharedDevices,setSharedDevices]=useState<SharedDevice[]>([]);
  const [alerts, setAlerts] = useState<SharedAlert[]>([]);
  const [alertError, setAlertError] = useState("");
  const [tab, setTab] = useState<ViewTab>("patients");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [trendType, setTrendType] = useState("");
  const [reportPeriod,setReportPeriod]=useState<ReportPeriod>("month");
  const [customFrom,setCustomFrom]=useState("");
  const [customTo,setCustomTo]=useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("tous");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadSharedData = useCallback(async (userId: string) => {
    setBusy(true);
    setError("");
    const { data, error: shareError } = await sb.from("suivi_shares")
      .select("id,owner_user_id,measurement_type,granted_at,active,revoked_at,allow_history,allow_realtime,allow_alerts,realtime_from_at")
      .eq("recipient_user_id", userId).eq("active", true).is("revoked_at", null)
      .order("granted_at", { ascending: false }).limit(500);
    if (shareError) {
      setShares([]); setMeasurements([]); setSharedDevices([]); setAlerts([]);setClinicalCasePatientIds([]);setActiveClinicalCasePatientIds([]);setCarePatientIds([]);setLastUpdated(new Date().toISOString());
      setError("Les partages ne sont pas accessibles. Vérifiez les migrations du suivi, le statut du professionnel et le consentement du patient.");
      setBusy(false); return;
    }
    const activeShares = (data ?? []) as Share[];
    setShares(activeShares);
    const {data:caseStates,error:caseStateError}=await sb.rpc("suivi_list_professional_case_states");
    if(caseStateError){
      setMeasurements([]);setSharedDevices([]);setAlerts([]);setClinicalCasePatientIds([]);setActiveClinicalCasePatientIds([]);setCarePatientIds([]);
      setError("Les liens de suivi clinique ne sont pas accessibles. Vérifiez la migration de séparation des droits.");
      setBusy(false);return;
    }
    const stateRows=(caseStates??[]) as {patient_user_id:string;case_status:string|null;clinical_notes_access:boolean}[];
    const careIds=[...new Set(stateRows.map(row=>row.patient_user_id))];
    setCarePatientIds(careIds);
    const owners=[...new Set([...activeShares.map(item=>item.owner_user_id),...careIds])];
    const types=[...new Set(activeShares.map(item=>item.measurement_type))];
    const existingCaseOwners=[...new Set(stateRows.filter(row=>row.case_status!==null).map(row=>row.patient_user_id))];
    const activeCaseOwners=[...new Set(stateRows.filter(row=>row.case_status==="active").map(row=>row.patient_user_id))];
    setClinicalCasePatientIds(existingCaseOwners);
    setActiveClinicalCasePatientIds(activeCaseOwners);
    if(!owners.length){
      setMeasurements([]);setSharedDevices([]);setAlerts([]);setClinicalCasePatientIds([]);setActiveClinicalCasePatientIds([]);setCarePatientIds([]);setAlertError("");setLastUpdated(new Date().toISOString());
      setNotice("Aucun patient ne partage actuellement de mesure ou de dossier clinique avec ce compte.");
      setBusy(false);return;
    }
    if(!types.length){
      setMeasurements([]);setSharedDevices([]);setAlerts([]);setAlertError("");setLastUpdated(new Date().toISOString());
      setNotice("Aucun type de mesure actif. Les dossiers cliniques autorisés restent consultables.");
      setBusy(false);return;
    }
    const { data: rows, error: measurementError } = await sb.from("suivi_measurements")
      .select("id,user_id,measurement_type,value_numeric,value_text,unit,measured_at,source,note")
      .in("user_id", owners).in("measurement_type", types)
      .order("measured_at", { ascending: false }).limit(2000);
    if (measurementError) {
      setMeasurements([]);
      setError("Les partages sont visibles mais les mesures restent bloquées par les droits serveur. Vérifiez les droits RLS et le consentement actif.");
      setBusy(false); return;
    }
    const {data:deviceRows,error:deviceError}=await sb.from("suivi_user_devices")
      .select("id,user_id,device_key,device_name,device_model,device_brand,connection_state,auto_reconnect,last_measurement_at,protocol,active,firmware_version,metadata")
      .in("user_id",owners).eq("active",true).order("created_at",{ascending:true});
    setSharedDevices(deviceError?[]:(deviceRows??[]) as SharedDevice[]);
    const allowed = new Set(activeShares.map(item => `${item.owner_user_id}:${item.measurement_type}`));
    setMeasurements(((rows ?? []) as Measurement[]).filter(row => allowed.has(`${row.user_id}:${row.measurement_type}`)));
    const {data:alertRows,error:alertQueryError}=await sb.from("suivi_alerts").select("id,user_id,measurement_id,measurement_type,observed_value,alert_kind,created_at,read_at").in("user_id",owners).in("measurement_type",types).order("created_at",{ascending:false}).limit(200);
    if(alertQueryError){setAlerts([]);setAlertError("Les alertes partagées ne sont pas accessibles avec les autorisations serveur actuelles.");}
    else{setAlerts(((alertRows??[]) as SharedAlert[]).filter(alert=>allowed.has(`${alert.user_id}:${alert.measurement_type}`)));setAlertError("");}
    setNotice("Données limitées aux autorisations en cours : historique, mesures futures et alertes selon les droits explicites du patient.");
    setLastUpdated(new Date().toISOString());
    setBusy(false);
  }, [sb]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth.user) { setError("Connexion requise."); setLoading(false); return; }
    const { data: professional, error: professionalError } = await sb.from("suivi_professionals")
      .select("professional_role,verified,verification_status,verification_expires_at,display_name")
      .eq("user_id", auth.user.id).maybeSingle();
    const expired=!!professional?.verification_expires_at && new Date(professional.verification_expires_at).getTime()<=Date.now();
    if(professionalError||!professional||professional.verified!==true||professional.verification_status!=="verified"||expired) {
      setError("Accès refusé : votre accréditation professionnelle n'est pas validée ou n'est plus valide par NAXA.");setLoading(false);return;
    }
    if(professional.professional_role==="pharmacien") {
      const {data:profile,error:profileError}=await sb.from("profiles")
        .select("actif,fonction_interne,pharmacie_id").eq("id",auth.user.id).maybeSingle();
      if(profileError||!profile||profile.actif!==true||profile.fonction_interne!=="pharmacien"||!profile.pharmacie_id) {
        setError("Accès pharmacien indisponible : compte ou rattachement pharmacie inactif.");setLoading(false);return;
      }
      const {data:pharmacy,error:pharmacyError}=await sb.from("pharmacies").select("id,actif").eq("id",profile.pharmacie_id).maybeSingle();
      if(pharmacyError||!pharmacy||pharmacy.actif!==true) {
        setError("La pharmacie est inactive ; l'accès au suivi patient est bloqué.");setLoading(false);return;
      }
    }
    setRecipientId(auth.user.id);
    await loadSharedData(auth.user.id);
    setLoading(false);
  }, [sb, loadSharedData]);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!recipientId) return;
    const channel=sb.channel("professionnel-suivi-partages")
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_measurements"},()=>{void loadSharedData(recipientId);})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_alerts"},()=>{void loadSharedData(recipientId);})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_shares"},()=>{void loadSharedData(recipientId);})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_care_links"},()=>{void loadSharedData(recipientId);})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_patient_cases"},()=>{void loadSharedData(recipientId);})
      .on("postgres_changes",{event:"*",schema:"public",table:"suivi_user_devices"},()=>{void loadSharedData(recipientId);})
      .subscribe();
    const poll=window.setInterval(()=>{void loadSharedData(recipientId);},30000);
    return ()=>{window.clearInterval(poll);void sb.removeChannel(channel);};
  },[sb,recipientId,loadSharedData]);
  const owners = [...new Set([...shares.map(item => item.owner_user_id),...carePatientIds])];
  const types = [...new Set(shares.map(item => item.measurement_type))].sort();
  const selectedPatient = selectedPatientId && owners.includes(selectedPatientId) ? selectedPatientId : null;
  const periodNow=new Date();
  let periodStart:Date|null=null;
  let periodEnd:Date|null=null;
  if(reportPeriod==="day"){
    periodStart=new Date(periodNow);periodStart.setHours(0,0,0,0);
    periodEnd=new Date(periodNow);periodEnd.setHours(23,59,59,999);
  }else if(reportPeriod==="month"){
    periodStart=new Date(periodNow.getFullYear(),periodNow.getMonth(),1,0,0,0,0);
    periodEnd=new Date(periodNow.getFullYear(),periodNow.getMonth()+1,0,23,59,59,999);
  }else if(reportPeriod==="year"){
    periodStart=new Date(periodNow.getFullYear(),0,1,0,0,0,0);
    periodEnd=new Date(periodNow.getFullYear(),11,31,23,59,59,999);
  }else{
    if(customFrom)periodStart=new Date(customFrom+"T00:00:00");
    if(customTo)periodEnd=new Date(customTo+"T23:59:59.999");
  }
  const inReportPeriod=(value:string)=>{
    const date=new Date(value);
    return (!periodStart||date>=periodStart)&&(!periodEnd||date<=periodEnd);
  };
  const patientHasInitialDiagnosis=!!selectedPatient&&clinicalCasePatientIds.includes(selectedPatient);
  const patientCaseIsActive=!!selectedPatient&&activeClinicalCasePatientIds.includes(selectedPatient);
  const caseReadyMeasurements=measurements.filter(row=>activeClinicalCasePatientIds.includes(row.user_id));
  const caseReadyAlerts=alerts.filter(alert=>activeClinicalCasePatientIds.includes(alert.user_id));
  const patientDevices=selectedPatient&&patientCaseIsActive?sharedDevices.filter(device=>device.user_id===selectedPatient):[];
  const patientPeriodMeasurements=selectedPatient&&patientCaseIsActive
    ? caseReadyMeasurements.filter(row=>row.user_id===selectedPatient&&inReportPeriod(row.measured_at))
    : [];
  const filteredAlerts=caseReadyAlerts.filter(alert=>{
    const q=search.trim().toLowerCase();
    const patientMatch=!q||patientLabel(alert.user_id).toLowerCase().includes(q)||alert.user_id.toLowerCase().includes(q);
    return patientMatch&&(typeFilter==="tous"||alert.measurement_type===typeFilter);
  });
  const filteredMeasurements = caseReadyMeasurements.filter(row => {
    const query = search.trim().toLowerCase();
    const patientMatch = !query || patientLabel(row.user_id).toLowerCase().includes(query) || row.user_id.toLowerCase().includes(query);
    const typeMatch = typeFilter === "tous" || row.measurement_type === typeFilter;
    const periodMatch=!selectedPatient||row.user_id!==selectedPatient||inReportPeriod(row.measured_at);
    return patientMatch && typeMatch && periodMatch;
  });
  const trendTypes = selectedPatient
    ? [...new Set(patientPeriodMeasurements.filter(row => row.value_numeric !== null).map(row => row.measurement_type))].sort()
    : [];
  const activeTrendType = trendTypes.includes(trendType) ? trendType : (trendTypes[0] ?? "");
  const trendPoints: TrendPoint[] = selectedPatient && activeTrendType
    ? patientPeriodMeasurements
        .filter((row): row is Measurement & { value_numeric: number } => row.measurement_type === activeTrendType && row.value_numeric !== null)
        .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
        .slice(-20)
    : [];
  const trendValues = trendPoints.map(point => point.value_numeric);
  const trendMin = trendValues.length ? Math.min(...trendValues) : 0;
  const trendMax = trendValues.length ? Math.max(...trendValues) : 0;
  const trendRange = trendMax - trendMin || 1;
  const trendCoordinates = trendPoints.map((point, index) => ({
    x: trendPoints.length <= 1 ? 300 : 24 + (index * 552) / (trendPoints.length - 1),
    y: 142 - ((point.value_numeric - trendMin) / trendRange) * 112,
  }));
  const trendPolyline = trendCoordinates.map(point => `${point.x},${point.y}`).join(" ");
  const measurementsByPatient = owners.map(owner => ({
    owner,
    shareCount: shares.filter(item => item.owner_user_id === owner).length,
    latest: measurements.filter(item => item.user_id === owner).sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0] ?? null,
  })).filter(row => !search.trim() || patientLabel(row.owner).toLowerCase().includes(search.trim().toLowerCase()) || row.owner.toLowerCase().includes(search.trim().toLowerCase()));

  return <SuiviProfessionalWorkspaceShell>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#123D68] px-4 py-4 text-white">
      <div><a href="/suivi/professionnel" className="text-sm text-blue-100 hover:text-white">← Espace professionnel NAXA</a><h1 className="mt-1 text-2xl font-black">Suivi des patients</h1><p className="mt-1 text-sm text-emerald-100">Mesures partagées, consentement et traçabilité des accès.</p></div>
      <div className="flex flex-col items-end gap-1"><button type="button" onClick={() => void refresh()} disabled={loading || busy} className="min-h-10 rounded-xl border border-white/30 px-4 py-2 text-sm font-bold disabled:opacity-50">Actualiser</button><span className="text-xs text-emerald-100">{lastUpdated ? `Mis à jour ${new Date(lastUpdated).toLocaleTimeString("fr-FR")}` : "Mise à jour en attente"}</span></div>
    </header>
    <section className="carte space-y-3"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Patients partageant des mesures</p><p className="text-2xl font-black">{owners.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Types partagés</p><p className="text-2xl font-black">{types.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Mesures visibles</p><p className="text-2xl font-black">{caseReadyMeasurements.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Alertes partagées après diagnostic</p><p className="text-2xl font-black">{caseReadyAlerts.length}</p></div></div>
      <p className="text-sm text-slate-600">Les identités sont masquées par défaut. NAXA affiche uniquement les données autorisées. Le professionnel reste responsable de ses appréciations cliniques.</p>
    </section>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-blue-900">{notice}</p>}
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Accès ou chargement limité</b><p className="mt-1">{error}</p></div>}
    <section className="carte space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Onglets du suivi patient">
        {([{id:"patients",label:"Patients partagés"},{id:"mesures",label:"Mesures"},{id:"alertes",label:"Alertes"},{id:"partages",label:"Partages et accès"}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} onClick={()=>setTab(item.id)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold ${tab===item.id ? "bg-[#0B3D26] text-white" : "bg-slate-100 text-slate-700"}`}>{item.label}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]"><label className="block text-sm font-semibold">Rechercher un patient partagé<input className="champ mt-1 w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Identifiant anonymisé"/></label>{(tab==="mesures"||tab==="alertes") && <label className="block text-sm font-semibold">Type de mesure<select className="champ mt-1 w-full" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="tous">Tous les types partagés</option>{types.map(type=><option key={type} value={type}>{labels[type] ?? type}</option>)}</select></label>}</div>
      {loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm">Chargement des partages autorisés…</p> : <>
        {tab==="patients" && (measurementsByPatient.length ? <div className="space-y-3">{measurementsByPatient.map(patient=><article key={patient.owner} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-extrabold">{patientLabel(patient.owner)}</h2><p className="text-sm text-slate-600">{patient.shareCount} type(s) partagé(s)</p></div><button type="button" className="btn btn-clair" onClick={()=>{setSelectedPatientId(patient.owner);setSearch(patientLabel(patient.owner));setTypeFilter("tous");setTab("mesures");}}>Ouvrir le dossier</button></div>{clinicalCasePatientIds.includes(patient.owner)?patient.latest?<p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">Dernière mesure reçue : <b>{labels[patient.latest.measurement_type] ?? patient.latest.measurement_type}</b> · {dateLabel(patient.latest.measured_at)}</p>:<p className="mt-3 text-sm text-slate-500">Dossier initial actif ; aucune mesure n'est disponible pour les types partagés.</p>:<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Dossier initial requis : les mesures et alertes restent masquées jusqu'à l'enregistrement du diagnostic professionnel et l'autorisation clinique du patient.</p>}</article>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucun patient correspondant ou aucun partage actif.</p>)}
        {tab==="mesures" && <>
          {selectedPatient && <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-extrabold text-emerald-950">Dossier partagé · {patientLabel(selectedPatient)}</h2><p className="text-sm text-emerald-900">Évolution des valeurs numériques partagées, triées par date. Les graphiques décrivent les données reçues et ne constituent pas une interprétation médicale.</p></div><button type="button" className="btn btn-clair" onClick={() => setSelectedPatientId(null)}>Fermer le dossier</button></div>
            <SuiviClinicalCasePanel patientId={selectedPatient} professionalId={recipientId}/>
            {patientCaseIsActive?<>
            <section className="rounded-xl border border-emerald-100 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">Appareils associés autorisés</b><span className="text-xs text-slate-500">{patientDevices.length} appareil(s) actif(s)</span></div>{patientDevices.length?<ul className="mt-2 grid gap-2 sm:grid-cols-2">{patientDevices.map(device=><li key={device.id} className="rounded-lg border bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{device.device_brand?device.device_brand+" · ":""}{device.device_model||device.device_name}</b><span className="text-xs font-semibold">{device.connection_state==="connected"?"Connecté":device.connection_state==="error"?"Erreur":device.connection_state==="unsupported"?"Non compatible":"Déconnecté"}</span></div><p className="mt-1 text-xs text-slate-600">Reconnexion auto : {device.auto_reconnect?"activée":"désactivée"} · Dernière mesure : {device.last_measurement_at?dateLabel(device.last_measurement_at):"aucune"}</p><p className="mt-1 break-words text-xs text-slate-500">{device.protocol||"Protocole non renseigné"}</p><p className="mt-1 text-xs text-slate-500">{device.firmware_version?"Firmware : "+device.firmware_version+" · ":""}{typeof device.metadata?.battery_level==="number"?"Batterie : "+device.metadata.battery_level+"%":"Niveau de batterie non communiqué"}</p></li>)}</ul>:<p className="mt-2 text-sm text-slate-500">Aucun appareil n'est visible avec les droits de partage actuellement accordés.</p>}</section>
            <div className="grid gap-3 rounded-xl border border-emerald-100 bg-white p-3 sm:grid-cols-2"><label className="text-sm font-semibold">Période à consulter<select className="champ mt-1 w-full" value={reportPeriod} onChange={event=>setReportPeriod(event.target.value as ReportPeriod)}><option value="day">Jour en cours</option><option value="month">Mois en cours</option><option value="year">Année en cours</option><option value="custom">Période personnalisée</option></select></label>{reportPeriod==="custom"&&<div className="grid grid-cols-2 gap-2"><label className="text-sm font-semibold">Du<input type="date" className="champ mt-1 w-full" value={customFrom} onChange={event=>setCustomFrom(event.target.value)}/></label><label className="text-sm font-semibold">Au<input type="date" className="champ mt-1 w-full" value={customTo} onChange={event=>setCustomTo(event.target.value)}/></label></div>}<p className="text-xs text-slate-500 sm:col-span-2">Graphiques et mesures du dossier limités à la période choisie. Le filtre utilise le fuseau horaire du navigateur.</p></div><SuiviHistoryChart measurements={patientPeriodMeasurements} title={"Historique de "+patientLabel(selectedPatient)}/>{trendTypes.length > 0 ? <>
              <label className="block text-sm font-semibold">Mesure à visualiser<select className="champ mt-1 w-full sm:max-w-sm" value={activeTrendType} onChange={event => setTrendType(event.target.value)}>{trendTypes.map(type => <option key={type} value={type}>{labels[type] ?? type}</option>)}</select></label>
              {trendPoints.length > 1 ? <div className="rounded-xl border border-emerald-100 bg-white p-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm"><span>Minimum observé : <b>{trendMin}</b></span><span>Maximum observé : <b>{trendMax}</b></span><span>{trendPoints.length} dernières valeurs</span></div>
                <svg viewBox="0 0 600 180" role="img" aria-label={`Évolution des ${labels[activeTrendType] ?? activeTrendType} pour ${patientLabel(selectedPatient)}`} className="mt-3 h-44 w-full">
                  <line x1="24" y1="142" x2="576" y2="142" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="24" y1="30" x2="576" y2="30" stroke="#e2e8f0" strokeWidth="1" />
                  <polyline points={trendPolyline} fill="none" stroke="#0F6B3F" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
                  {trendCoordinates.map((point, index) => <circle key={trendPoints[index].id} cx={point.x} cy={point.y} r="4" fill="#0F6B3F"><title>{`${trendPoints[index].value_numeric} ${trendPoints[index].unit ?? ""} — ${dateLabel(trendPoints[index].measured_at)}`}</title></circle>)}
                </svg>
                <div className="flex justify-between gap-2 text-xs text-slate-500"><span>{dateLabel(trendPoints[0].measured_at)}</span><span>{dateLabel(trendPoints[trendPoints.length - 1].measured_at)}</span></div>
              </div> : <p className="rounded-lg bg-white p-3 text-sm text-slate-700">Il faut au moins deux mesures numériques partagées pour tracer une évolution. Une seule valeur ne permet pas de conclure à une tendance.</p>}
            </> : <p className="rounded-lg bg-white p-3 text-sm text-slate-700">Aucune mesure numérique partagée n’est disponible pour tracer une courbe. Les mesures textuelles restent consultables dans la liste.</p>}
            </>:{patientHasInitialDiagnosis?<section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Suivi suspendu ou clôturé</b><p className="mt-1">Le dossier clinique existe. Les mesures, appareils et alertes sont masqués tant que le suivi n'est pas actif. Consultez son état dans le panneau du dossier clinique.</p></section>:<section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Diagnostic initial requis avant le suivi</b><p className="mt-1">Le patient doit autoriser l'accès à son dossier clinique ; vous pourrez ensuite saisir le diagnostic initial pour ouvrir le suivi.</p></section>}}
          </section>}
          {filteredMeasurements.length ? <div className="space-y-3">{filteredMeasurements.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{labels[row.measurement_type] ?? row.measurement_type}</b><p className="text-sm text-slate-600">{patientLabel(row.user_id)} · {dateLabel(row.measured_at)}</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">{row.value_numeric !== null ? `${row.value_numeric}${row.unit ? " " + row.unit : ""}` : row.value_text || "Valeur non renseignée"}</span></div>{row.note && <p className="mt-3 text-sm text-slate-600">Note partagée : {row.note}</p>}<p className="mt-2 text-xs text-slate-500">Source enregistrée : {row.source}</p><button type="button" className="mt-3 text-sm font-bold underline" onClick={() => {setSelectedPatientId(row.user_id);setTrendType(row.measurement_type);}}>Afficher l’évolution de ce patient</button></article>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucune mesure ne correspond aux filtres. Les mesures restent visibles seulement tant que le partage et le consentement sont actifs.</p>}
        </>}
        {tab==="alertes" && <div className="space-y-3"><p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Ces alertes signalent uniquement un écart par rapport à une plage choisie par le patient. Elles ne constituent ni un diagnostic ni un seuil médical défini par NAXA.</p>{alertError&&<p role="status" className="rounded-lg border border-amber-200 p-3 text-sm">{alertError}</p>}{filteredAlerts.length ? filteredAlerts.map(alert=><article key={alert.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{alert.alert_kind==="below_user_range"?"Sous la plage choisie par le patient":"Au-dessus de la plage choisie par le patient"}</b><p className="text-sm text-slate-600">{patientLabel(alert.user_id)} · {labels[alert.measurement_type]??alert.measurement_type}</p><p className="text-xs text-slate-500">{dateLabel(alert.created_at)}</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">{alert.observed_value}</span></div><p className="mt-2 text-xs text-slate-500">Alerte non traitée par le pharmacien : la modification du statut de lecture reste réservée au compte patient.</p></article>) : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucune alerte partagée ne correspond aux filtres.</p>}</div>}
        {tab==="partages" && (shares.length ? <div className="space-y-2">{shares.map(share=><article key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><b>{patientLabel(share.owner_user_id)}</b><p className="text-sm text-slate-600">{labels[share.measurement_type] ?? share.measurement_type}</p><p className="text-xs text-slate-500">Partage accordé le {dateLabel(share.granted_at)}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">Actif</span></article>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucun partage actif. Le patient conserve le contrôle de son consentement et peut révoquer le partage depuis son compte.</p>)}
      </>}
    </section>
    <p className="px-1 text-xs text-slate-500">Le module reste soumis à la vérification professionnelle et à l’autorisation expérimentale existante du suivi connecté. Les données se rafraîchissent via Realtime lorsque disponible et par vérification périodique toutes les 30 secondes. Les alertes affichées restent soumises aux autorisations actives du patient. Le suivi des prescriptions patient exige encore un consentement distinct et un raccordement dédié.</p>
  </SuiviProfessionalWorkspaceShell>;
}
