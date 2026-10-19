"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

type Family = "constantes" | "metabolisme" | "activite" | "sommeil" | "bien_etre" | "traitements";
type TrackType = { key: string; label: string; unit: string; family: Family; numeric: boolean };
const families: { key: Family; label: string; description: string }[] = [
  { key: "constantes", label: "Constantes", description: "Mesures à relever selon les conseils de votre professionnel de santé." },
  { key: "metabolisme", label: "Métabolisme", description: "Valeurs personnelles, sans interprétation automatique ni diagnostic." },
  { key: "activite", label: "Activité & hydratation", description: "Repères déclaratifs et activité quotidienne." },
  { key: "sommeil", label: "Sommeil", description: "Durée de sommeil déclarée." },
  { key: "bien_etre", label: "Bien-être", description: "Notes subjectives, sans diagnostic." },
  { key: "traitements", label: "Traitements & rappels", description: "Rappels personnels; NAXA ne prescrit aucune dose." },
];
const types: TrackType[] = [
  {key:"tension_systolique",label:"Tension systolique",unit:"mmHg",family:"constantes",numeric:true},
  {key:"tension_diastolique",label:"Tension diastolique",unit:"mmHg",family:"constantes",numeric:true},
  {key:"frequence_cardiaque",label:"Fréquence cardiaque",unit:"bpm",family:"constantes",numeric:true},
  {key:"temperature",label:"Température",unit:"°C",family:"constantes",numeric:true},
  {key:"saturation_oxygene",label:"Saturation en oxygène",unit:"%",family:"constantes",numeric:true},
  {key:"frequence_respiratoire",label:"Fréquence respiratoire",unit:"/min",family:"constantes",numeric:true},
  {key:"glycemie",label:"Glycémie",unit:"unité indiquée par l'appareil",family:"metabolisme",numeric:true},
  {key:"poids",label:"Poids",unit:"kg",family:"metabolisme",numeric:true},
  {key:"taille",label:"Taille",unit:"cm",family:"metabolisme",numeric:true},
  {key:"imc",label:"IMC",unit:"kg/m²",family:"metabolisme",numeric:true},
  {key:"cholesterol_total",label:"Cholestérol total",unit:"unité du résultat",family:"metabolisme",numeric:true},
  {key:"pas_jour",label:"Nombre de pas",unit:"pas",family:"activite",numeric:true},
  {key:"activite_minutes",label:"Activité",unit:"minutes",family:"activite",numeric:true},
  {key:"hydratation_ml",label:"Hydratation déclarée",unit:"ml",family:"activite",numeric:true},
  {key:"sommeil_heures",label:"Durée de sommeil",unit:"heures",family:"sommeil",numeric:true},
  {key:"douleur_score",label:"Douleur ressentie",unit:"score personnel /10",family:"bien_etre",numeric:true},
  {key:"humeur_score",label:"Humeur ressentie",unit:"score personnel /10",family:"bien_etre",numeric:true},
  {key:"cycle_jour",label:"Jour du cycle (facultatif)",unit:"jour",family:"bien_etre",numeric:true},
  {key:"medicament_pris",label:"Prise déclarée",unit:"",family:"traitements",numeric:false},
  {key:"symptome_note",label:"Note personnelle",unit:"",family:"bien_etre",numeric:false},
];
type UserDevice = { id:string; device_key:string; device_name:string; connection_mode:"manual"|"bluetooth"; active:boolean };
type Measurement = { id:string; measurement_type:string; value_numeric:number|null; value_text:string|null; unit:string|null; measured_at:string; source:string; note:string|null };
type Reminder = { id:string; measurement_type:string; title:string; due_at:string; repeat_rule:string; enabled:boolean };
type AlertRule = { id:string; measurement_type:string; min_value:number|null; max_value:number|null; enabled:boolean };
type TrackingAlert = { id:string; measurement_type:string; observed_value:number; alert_kind:string; created_at:string; read_at:string|null };

export function SuiviConnecte() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [online, setOnline] = useState(true);
  const [consents, setConsents] = useState<Record<string, boolean>>({});
  const [preferredName, setPreferredName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [history, setHistory] = useState<Measurement[]>([]);
  const [devices, setDevices] = useState<UserDevice[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alerts, setAlerts] = useState<TrackingAlert[]>([]);
  const [minThreshold, setMinThreshold] = useState("");
  const [maxThreshold, setMaxThreshold] = useState("");
  const [selectedType, setSelectedType] = useState("tension_systolique");
  const [value, setValue] = useState("");
  const [pendingMeasurementSource, setPendingMeasurementSource] = useState<"bluetooth" | null>(null);
  const [note, setNote] = useState("");
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0,16));
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderAt, setReminderAt] = useState(new Date(Date.now()+86400000).toISOString().slice(0,16));
  const [repeatRule, setRepeatRule] = useState("none");
  const [shareType, setShareType] = useState("tension_systolique");
  const [professionalId, setProfessionalId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");

  const load = useCallback(async () => {
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) { setAllowed(false); return; }
    setAllowed(true);
    const [p, c, m, r, ar, al, d] = await Promise.all([
      sb.from("suivi_profiles").select("preferred_name,birth_year").eq("user_id",userData.user.id).maybeSingle(),
      sb.from("suivi_consents").select("family_key,granted").eq("user_id",userData.user.id),
      sb.from("suivi_measurements").select("id,measurement_type,value_numeric,value_text,unit,measured_at,source,note").eq("user_id",userData.user.id).order("measured_at",{ascending:false}).limit(100),
      sb.from("suivi_reminders").select("id,measurement_type,title,due_at,repeat_rule,enabled").eq("user_id",userData.user.id).order("due_at",{ascending:true}).limit(100),
      sb.from("suivi_alert_rules").select("id,measurement_type,min_value,max_value,enabled").eq("user_id",userData.user.id),
      sb.from("suivi_alerts").select("id,measurement_type,observed_value,alert_kind,created_at,read_at").eq("user_id",userData.user.id).order("created_at",{ascending:false}).limit(100),
      sb.from("suivi_user_devices").select("id,device_key,device_name,connection_mode,active").eq("user_id",userData.user.id).order("created_at",{ascending:true}),
    ]);
    if (p.error || c.error || m.error || r.error || ar.error || al.error || d.error) setNotice("Certaines informations n’ont pas pu être chargées. Réessayez; aucune donnée n’est inventée.");
    setPreferredName(p.data?.preferred_name ?? "");
    setBirthYear(p.data?.birth_year ? String(p.data.birth_year) : "");
    setConsents(Object.fromEntries((c.data??[]).map((x:any)=>[x.family_key,!!x.granted])));
    setHistory((m.data??[]) as Measurement[]);
    setReminders((r.data??[]) as Reminder[]);
    setAlertRules((ar.data??[]) as AlertRule[]);
    setAlerts((al.data??[]) as TrackingAlert[]);
    setDevices((d.data??[]) as UserDevice[]);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  const typeInfo = types.find(t=>t.key===selectedType)!;
  const selectedConsent = !!consents[typeInfo.family];
  const grantedFamilies = families.filter(f=>consents[f.key]).length;

  const deviceCatalog = [
    { key:"tensiometre", name:"Tensiomètre", mode:"manual" as const, family:"constantes" as Family, description:"Saisissez la tension mesurée sur votre appareil." },
    { key:"thermometre", name:"Thermomètre", mode:"manual" as const, family:"constantes" as Family, description:"Ajoutez une température relevée." },
    { key:"oxymetre", name:"Oxymètre de pouls", mode:"manual" as const, family:"constantes" as Family, description:"Saisissez la saturation affichée." },
    { key:"glucometre", name:"Glucomètre", mode:"manual" as const, family:"metabolisme" as Family, description:"Saisissez le résultat avec l’unité indiquée par l’appareil." },
    { key:"balance", name:"Balance connectée ou classique", mode:"manual" as const, family:"metabolisme" as Family, description:"Ajoutez votre poids; la connexion automatique n’est pas prise en charge ici." },
    { key:"capteur_cardiaque_bluetooth", name:"Capteur cardiaque Bluetooth", mode:"bluetooth" as const, family:"constantes" as Family, description:"Lecture directe compatible Bluetooth GATT, service fréquence cardiaque standard, via Chrome Android/HTTPS." },
    { key:"podometre", name:"Podomètre / bracelet d’activité", mode:"manual" as const, family:"activite" as Family, description:"Déclarez les pas ou minutes d’activité; synchronisation automatique non disponible." },
  ];

  async function toggleDevice(device: typeof deviceCatalog[number]) {
    const existing = devices.find(d => d.device_key === device.key);
    if (!existing && !consents[device.family]) {
      setNotice(`Acceptez d’abord le consentement « ${families.find(f=>f.key===device.family)?.label} » pour activer ce dispositif.`);
      return;
    }
    setBusy(true); setNotice("");
    const { data:userData } = await sb.auth.getUser();
    if (!userData.user) { setNotice("Session expirée. Reconnectez-vous."); setBusy(false); return; }
    const { error } = existing
      ? await sb.from("suivi_user_devices").update({active:!existing.active, updated_at:new Date().toISOString()}).eq("id",existing.id).eq("user_id",userData.user.id)
      : await sb.from("suivi_user_devices").insert({user_id:userData.user.id,device_key:device.key,device_name:device.name,connection_mode:device.mode,active:true});
    if (error) setNotice("Activation impossible. Vérifiez le consentement et réessayez.");
    else {
      const { data } = await sb.from("suivi_user_devices").select("id,device_key,device_name,connection_mode,active").eq("user_id",userData.user.id).order("created_at",{ascending:true});
      setDevices((data??[]) as UserDevice[]);
      setNotice(existing ? (existing.active ? "Dispositif désactivé." : "Dispositif réactivé.") : "Dispositif activé dans votre espace privé.");
    }
    setBusy(false);
  }

  async function saveProfile() {
    setBusy(true); setNotice("");
    const { data:userData } = await sb.auth.getUser();
    if (!userData.user) { setNotice("Session expirée."); setBusy(false); return; }
    const parsedYear = birthYear.trim() ? Number(birthYear) : null;
    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > new Date().getFullYear())) { setNotice("Année de naissance invalide."); setBusy(false); return; }
    const { error } = await sb.from("suivi_profiles").upsert({ user_id:userData.user.id, preferred_name:preferredName.trim() || null, birth_year:parsedYear, updated_at:new Date().toISOString() }, { onConflict:"user_id" });
    setNotice(error ? "Profil non enregistré." : "Profil de suivi enregistré."); setBusy(false);
  }

  async function toggleConsent(family: Family, grant: boolean) {
    setBusy(true); setNotice("");
    const { data:userData } = await sb.auth.getUser();
    if (!userData.user) { setNotice("Connectez-vous pour continuer."); setBusy(false); return; }
    const { error } = await sb.from("suivi_consents").upsert({
      user_id:userData.user.id, family_key:family, granted:grant,
      consent_version:"1.0", granted_at:grant?new Date().toISOString():null,
      revoked_at:grant?null:new Date().toISOString(), updated_at:new Date().toISOString()
    }, { onConflict:"user_id,family_key" });
    if (error) setNotice("Le consentement n’a pas été enregistré. Réessayez.");
    else { setConsents(p=>({...p,[family]:grant})); if(!grant) setNotice("Consentement retiré. Les nouvelles saisies de cette famille sont bloquées."); }
    setBusy(false);
  }

  async function saveMeasurement(source: "manual"|"bluetooth"|"photo_ocr_local" = pendingMeasurementSource ?? "manual", overrideValue?: string) {
    if (!selectedConsent) { setNotice("Acceptez d’abord le consentement de cette famille."); return; }
    const current = overrideValue ?? value;
    if (!current.trim()) { setNotice("Saisissez une valeur ou une note."); return; }
    setBusy(true); setNotice("");
    const { data:userData } = await sb.auth.getUser();
    if (!userData.user) { setNotice("Session expirée. Reconnectez-vous."); setBusy(false); return; }
    const numeric = typeInfo.numeric ? Number(current) : null;
    if (typeInfo.numeric && (!Number.isFinite(numeric) || current.trim()==="")) { setNotice("Valeur numérique invalide."); setBusy(false); return; }
    const { error } = await sb.from("suivi_measurements").insert({
      user_id:userData.user.id, measurement_type:selectedType,
      value_numeric:numeric, value_text:typeInfo.numeric?null:current.trim(),
      unit:typeInfo.unit||null, measured_at:new Date(measuredAt).toISOString(),
      source, note:note.trim()||null
    });
    if (error) setNotice("Enregistrement refusé. Vérifiez le consentement et les champs.");
    else { setValue(""); setNote(""); setPendingMeasurementSource(null); setNotice("Entrée enregistrée dans votre espace privé."); await load(); }
    setBusy(false);
  }

  async function saveAlertRule() {
    if (!typeInfo.numeric) { setNotice("Les plages personnalisées concernent uniquement les types numériques."); return; }
    if (!selectedConsent) { setNotice("Acceptez d’abord le consentement de cette famille."); return; }
    const min = minThreshold.trim() ? Number(minThreshold) : null;
    const max = maxThreshold.trim() ? Number(maxThreshold) : null;
    if (min === null && max === null) { setNotice("Saisissez au moins une limite personnelle."); return; }
    if ((min !== null && !Number.isFinite(min)) || (max !== null && !Number.isFinite(max)) || (min !== null && max !== null && min > max)) { setNotice("Plage invalide : la limite minimale doit être inférieure ou égale à la maximale."); return; }
    setBusy(true);
    const {data:userData}=await sb.auth.getUser();
    if(!userData.user){setNotice("Session expirée.");setBusy(false);return;}
    const {error}=await sb.from("suivi_alert_rules").upsert({user_id:userData.user.id,measurement_type:selectedType,min_value:min,max_value:max,enabled:true,updated_at:new Date().toISOString()},{onConflict:"user_id,measurement_type"});
    if(error)setNotice("Plage personnelle non enregistrée. Vérifiez le consentement.");
    else {setMinThreshold("");setMaxThreshold("");setNotice("Alerte personnelle configurée. Il ne s’agit pas d’un seuil médical recommandé.");await load();}
    setBusy(false);
  }

  async function markAlertRead(id:string) {
    const {error}=await sb.from("suivi_alerts").update({read_at:new Date().toISOString()}).eq("id",id);
    if(error)setNotice("Impossible de marquer cette alerte comme lue."); else await load();
  }

  async function saveReminder() {
    if (!selectedConsent) { setNotice("Acceptez d’abord le consentement de cette famille."); return; }
    if (reminderTitle.trim().length<2) { setNotice("Donnez un titre au rappel."); return; }
    setBusy(true);
    const {data:userData}=await sb.auth.getUser();
    if(!userData.user){setNotice("Session expirée.");setBusy(false);return;}
    const {error}=await sb.from("suivi_reminders").insert({user_id:userData.user.id,measurement_type:selectedType,title:reminderTitle.trim(),due_at:new Date(reminderAt).toISOString(),repeat_rule:repeatRule,enabled:true});
    if(error)setNotice("Rappel non enregistré. Vérifiez le consentement.");
    else {setReminderTitle("");setNotice("Rappel enregistré. Les notifications dépendent des capacités actives de votre appareil.");await load();}
    setBusy(false);
  }

  async function shareSelectedType() {
    if (!professionalId.trim()) { setNotice("Saisissez l’UUID du professionnel vérifié."); return; }
    setBusy(true);
    const {data:userData}=await sb.auth.getUser();
    if(!userData.user){setNotice("Session expirée.");setBusy(false);return;}
    const {error}=await sb.from("suivi_shares").upsert({owner_user_id:userData.user.id,recipient_user_id:professionalId.trim(),measurement_type:shareType,active:true,revoked_at:null},{onConflict:"owner_user_id,recipient_user_id,measurement_type"});
    if(error)setNotice("Partage refusé : le destinataire doit être un professionnel explicitement vérifié. Aucune donnée n’a été partagée.");
    else setNotice("Autorisation de partage enregistrée pour ce type uniquement.");
    setBusy(false);
  }

  async function revokeShare() {
    const {data:userData}=await sb.auth.getUser();
    if(!userData.user || !professionalId.trim()) return;
    const {error}=await sb.from("suivi_shares").update({active:false,revoked_at:new Date().toISOString()}).eq("owner_user_id",userData.user.id).eq("recipient_user_id",professionalId.trim()).eq("measurement_type",shareType);
    setNotice(error?"Impossible de révoquer ce partage.":"Partage révoqué.");
  }

  async function connectHeartRate() {
    setNotice("");
    try {
      if (!window.isSecureContext) {
        setNotice("Le Bluetooth nécessite une connexion sécurisée HTTPS. Vous pouvez saisir la mesure manuellement.");
        return;
      }
      const bluetooth = (navigator as any).bluetooth;
      if (!bluetooth?.requestDevice) {
        setNotice("Bluetooth non pris en charge ici. Utilisez Chrome sur Android avec un capteur compatible, ou saisissez la mesure manuellement.");
        return;
      }
      const device = await bluetooth.requestDevice({ filters: [{ services: ["heart_rate"] }] });
      if (!device?.gatt) {
        setNotice("Cet appareil ne propose pas de connexion Bluetooth GATT compatible. Aucune donnée n’a été enregistrée.");
        return;
      }
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService("heart_rate");
      const characteristic = await service.getCharacteristic("heart_rate_measurement");
      if (typeof characteristic.startNotifications !== "function" || typeof characteristic.addEventListener !== "function") {
        device.gatt.disconnect();
        setNotice("Ce capteur ne permet pas la lecture Bluetooth attendue. Aucune donnée n’a été enregistrée.");
        return;
      }
      const reading = await new Promise<DataView>((resolve, reject) => {
        let timeout: ReturnType<typeof setTimeout>;
        const cleanup = () => {
          clearTimeout(timeout);
          characteristic.removeEventListener("characteristicvaluechanged", onValue);
        };
        const onValue = (event: Event) => {
          const data = (event.target as any).value as DataView | undefined;
          if (!data || data.byteLength < 2) return;
          cleanup();
          resolve(data);
        };
        characteristic.addEventListener("characteristicvaluechanged", onValue);
        timeout = setTimeout(() => {
          cleanup();
          reject(new Error("Bluetooth reading timeout"));
        }, 12000);
        characteristic.startNotifications().catch((error: unknown) => {
          cleanup();
          reject(error);
        });
      });
      const flags = reading.getUint8(0);
      const bpm = flags & 1 ? reading.getUint16(1, true) : reading.getUint8(1);
      if (!Number.isFinite(bpm) || bpm <= 0) {
        device.gatt.disconnect();
        setNotice("La valeur reçue est invalide. Aucune donnée n’a été enregistrée.");
        return;
      }
      setSelectedType("frequence_cardiaque");
      setValue(String(bpm));
      setPendingMeasurementSource("bluetooth");
      setMeasuredAt(new Date().toISOString().slice(0, 16));
      setNotice("Mesure Bluetooth reçue. Vérifiez la valeur ci-dessous, puis confirmez une seule fois avec « Confirmer et enregistrer la mesure Bluetooth ». Rien n’a encore été enregistré.");
      device.gatt.disconnect();
    } catch {
      setNotice("Connexion Bluetooth annulée, refusée ou indisponible. Aucune donnée n’a été enregistrée; vous pouvez saisir la mesure manuellement.");
    }
  }

  async function readImageLocally(file?: File) {
    if(!file) return;
    setOcrText("");
    const Detector = (window as any).TextDetector;
    if(!Detector) { setNotice("La reconnaissance de texte locale n’est pas prise en charge par ce navigateur. L’image reste sur cet appareil; saisissez la valeur manuellement."); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const detector = new Detector();
      const results = await detector.detect(bitmap);
      const text = results.map((x:any)=>x.rawValue).join("\n");
      setOcrText(text);
      setNotice("Texte lu localement. Vérifiez chaque valeur; rien ne sera enregistré automatiquement.");
    } catch { setNotice("Lecture OCR impossible sur cet appareil. L’image n’a pas été envoyée; saisissez la valeur manuellement."); }
  }

  function exportPdf() { window.print(); }

  if (allowed === null) return <main className="min-h-screen bg-white p-6 text-[#1D4ED8]" aria-live="polite"><p className="animate-pulse font-bold">Chargement sécurisé du suivi…</p></main>;
  if (!allowed) return <main className="min-h-screen bg-[#F8FAFC] p-6 text-slate-900"><div className="mx-auto max-w-xl rounded-3xl border border-blue-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-extrabold uppercase tracking-widest text-[#1D4ED8]">NAXA · Dispositifs médicaux</p><h1 className="mt-3 text-3xl font-black">Bientôt disponible</h1><p className="mt-3 leading-7 text-slate-600">Cet espace est en phase d’expérimentation. Il n’est pas activé pour ce compte.</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#1D4ED8] px-5 font-bold text-white">Retour à l’accueil</Link></div></main>;

  return <main className="min-h-screen bg-[#F8FAFC] px-4 pb-12 text-slate-900 print:bg-white">
    <div className="mx-auto max-w-5xl pt-5">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#1D4ED8] p-5 text-white print:bg-white print:text-black">
        <div><p className="text-xs font-extrabold uppercase tracking-widest">NAXA · Suivi gratuit</p><h1 className="mt-1 text-3xl font-black">Mon suivi connecté</h1><p className="mt-2 text-sm">Gratuit · données privées · activation au choix</p></div>
        <div className="flex flex-wrap gap-2 print:hidden"><Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-white/50 px-4 font-bold">Accueil</Link><Link href="/suivi/professionnel" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-bold text-[#1D4ED8]">Espace professionnel</Link><button onClick={exportPdf} className="min-h-11 rounded-xl border border-white/50 px-4 font-bold">Exporter / PDF</button></div>
      </header>
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Ce n’est pas un service d’urgence.</strong> En cas d’urgence médicale, appelez le 119 selon la disponibilité locale ou rendez-vous dans un établissement de santé. NAXA ne pose pas de diagnostic et ne recommande aucune posologie.</div>
      {!online && <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Hors connexion : les nouvelles données ne peuvent pas être synchronisées. Les entrées non enregistrées ne sont pas conservées automatiquement.</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{notice}</p>}
      <section className="mt-5 rounded-2xl border border-emerald-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Catalogue des dispositifs</h2><p className="mt-1 text-sm text-slate-600">Espace gratuit. Activez uniquement les appareils que vous utilisez. La plupart sont enregistrés en mode manuel; la connexion directe est disponible uniquement pour les capteurs cardiaques Bluetooth compatibles.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">Sans abonnement</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{deviceCatalog.map(device=>{const saved=devices.find(d=>d.device_key===device.key);return <article key={device.key} className="flex flex-col rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-bold">{device.name}</h3><span className={saved?.active?"rounded-full bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800":"rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600"}>{saved?.active?"Activé":"Inactif"}</span></div><p className="mt-2 flex-1 text-sm leading-5 text-slate-600">{device.description}</p><p className="mt-2 text-xs font-semibold text-slate-500">{device.mode==="bluetooth"?"Connexion Bluetooth":"Saisie manuelle"}</p><button disabled={busy} onClick={()=>void toggleDevice(device)} className={saved?.active?"mt-3 min-h-11 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700 disabled:opacity-40":"mt-3 min-h-11 rounded-lg bg-[#0A6B3A] px-3 text-sm font-bold text-white disabled:opacity-40"}>{saved?.active?"Désactiver":"Activer ce dispositif"}</button>{device.mode==="bluetooth"&&saved?.active&&<button disabled={busy||!consents[device.family]} onClick={()=>void connectHeartRate()} className="mt-2 min-h-11 rounded-lg border border-emerald-200 px-3 text-sm font-bold text-emerald-800 disabled:opacity-40">Connecter le capteur</button>}</article>})}</div><p className="mt-3 text-xs leading-5 text-slate-500">La synchronisation automatique d’autres marques ou types de capteurs n’est pas annoncée comme disponible. Toute mesure reçue par Bluetooth doit être vérifiée puis confirmée avant l’enregistrement.</p></section>
      <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Profil de suivi</h2><p className="mt-1 text-sm text-slate-600">Informations facultatives pour personnaliser votre carnet. Elles ne sont pas visibles par un professionnel sans partage explicite d’une mesure.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nom d’affichage<input value={preferredName} onChange={e=>setPreferredName(e.target.value)} maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Année de naissance (facultative)<input type="number" min="1900" max={new Date().getFullYear()} value={birthYear} onChange={e=>setBirthYear(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label></div><button disabled={busy} onClick={()=>void saveProfile()} className="mt-3 min-h-11 rounded-xl bg-[#1D4ED8] px-4 font-bold text-white disabled:opacity-40">Enregistrer le profil</button></section>
      <section className="mt-5 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Consentements</h2><p className="mt-1 text-sm text-slate-600">Choisissez séparément les familles que vous souhaitez utiliser. Sans consentement actif, aucune nouvelle saisie n’est autorisée.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-[#1D4ED8]">{grantedFamilies}/6 autorisées</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{families.map(f=><article key={f.key} className="rounded-xl border p-4"><h3 className="font-bold">{f.label}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{f.description}</p><button disabled={busy} onClick={()=>void toggleConsent(f.key,!consents[f.key])} className={consents[f.key]?"mt-3 min-h-11 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700":"mt-3 min-h-11 rounded-lg bg-[#1D4ED8] px-3 text-sm font-bold text-white"}>{consents[f.key]?"Retirer le consentement":"J’accepte cette famille"}</button></article>)}</div>
      </section>
      <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">20 types de suivi + rappels</h2><p className="mt-1 text-sm text-slate-600">Sélectionnez une carte pour la saisie. Les valeurs ne sont pas interprétées comme un diagnostic.</p>
        <div className="mt-4 space-y-5">{families.map(f=><div key={f.key}><h3 className="mb-2 font-extrabold text-[#1D4ED8]">{f.label}</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{types.filter(t=>t.family===f.key).map(t=><button key={t.key} aria-pressed={selectedType===t.key} onClick={()=>setSelectedType(t.key)} className={selectedType===t.key?"min-h-20 rounded-xl border-2 border-[#1D4ED8] bg-blue-50 p-3 text-left":"min-h-20 rounded-xl border p-3 text-left hover:border-blue-300"}><span className="block text-sm font-bold">{t.label}</span><span className="mt-1 block text-xs text-slate-500">{t.unit||"Note"}</span></button>)}</div></div>)}</div>
      </section>
      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Ajouter une entrée</h2><p className="mt-1 text-sm text-slate-600">Type sélectionné : <strong>{typeInfo.label}</strong></p>
          {!selectedConsent && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Consentement « {families.find(f=>f.key===typeInfo.family)?.label} » requis.</p>}
          <label className="mt-3 block text-sm font-semibold">Valeur{typeInfo.numeric?"":" / note"}<input value={value} onChange={e=>setValue(e.target.value)} type={typeInfo.numeric?"number":"text"} step="any" maxLength={2000} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder={typeInfo.unit||"Votre note"}/></label>
          <label className="mt-3 block text-sm font-semibold">Date et heure<input type="datetime-local" value={measuredAt} onChange={e=>setMeasuredAt(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
          <label className="mt-3 block text-sm font-semibold">Note facultative<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={2} className="mt-1 w-full rounded-xl border p-3"/></label>
          <button disabled={busy||!selectedConsent} onClick={()=>void saveMeasurement()} className="mt-4 min-h-11 w-full rounded-xl bg-[#1D4ED8] px-4 font-bold text-white disabled:opacity-40">{pendingMeasurementSource === "bluetooth" ? "Confirmer et enregistrer la mesure Bluetooth" : "Enregistrer dans mon espace privé"}</button>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 print:hidden"><button disabled={busy} onClick={()=>void connectHeartRate()} className="min-h-11 rounded-xl border border-blue-200 px-3 text-sm font-bold">Synchroniser un capteur cardiaque Bluetooth</button><label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-200 px-3 text-center text-sm font-bold">Lire une photo localement<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>void readImageLocally(e.target.files?.[0])}/></label></div>
          {ocrText && <div className="mt-3 rounded-xl border bg-slate-50 p-3"><p className="text-sm font-bold">Texte OCR local à vérifier</p><pre className="mt-2 whitespace-pre-wrap text-sm">{ocrText}</pre><p className="mt-2 text-xs text-slate-600">Copiez manuellement la valeur utile dans le champ ci-dessus; aucune lecture n’est enregistrée automatiquement.</p></div>}
        </div>
        <div className="rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Rappels personnels</h2><p className="mt-1 text-sm text-slate-600">Les rappels enregistrés ne garantissent pas une notification push sur tous les appareils.</p>
          <label className="mt-3 block text-sm font-semibold">Titre<input value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} maxLength={160} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder={"Ex. Relever ma mesure"}/></label>
          <label className="mt-3 block text-sm font-semibold">Échéance<input type="datetime-local" value={reminderAt} onChange={e=>setReminderAt(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
          <label className="mt-3 block text-sm font-semibold">Répétition<select value={repeatRule} onChange={e=>setRepeatRule(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="none">Une fois</option><option value="daily">Chaque jour</option><option value="weekly">Chaque semaine</option></select></label>
          <button disabled={busy||!selectedConsent} onClick={()=>void saveReminder()} className="mt-3 min-h-11 w-full rounded-xl bg-[#1D4ED8] px-4 font-bold text-white disabled:opacity-40">Enregistrer le rappel</button>
          <ul className="mt-4 space-y-2">{reminders.map(r=><li key={r.id} className="rounded-xl border p-3"><p className="font-bold">{r.title}</p><p className="mt-1 text-xs text-slate-600">{types.find(t=>t.key===r.measurement_type)?.label??r.measurement_type} · {new Date(r.due_at).toLocaleString("fr-FR")} · {r.repeat_rule==="none"?"une fois":r.repeat_rule==="daily"?"quotidien":"hebdomadaire"}</p></li>)}</ul>
        </div>
      </section>
      <section className="mt-5 rounded-2xl border bg-white p-5 print:hidden"><h2 className="text-xl font-extrabold">Partage par type</h2><p className="mt-1 text-sm text-slate-600">Chaque autorisation est limitée à un type. Le destinataire doit être un professionnel explicitement vérifié par NAXA. Vous pouvez retirer le partage.</p>
        <label className="mt-3 block text-sm font-semibold">Type à partager<select value={shareType} onChange={e=>setShareType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3">{types.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
        <label className="mt-3 block text-sm font-semibold">UUID du professionnel vérifié<input value={professionalId} onChange={e=>setProfessionalId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono" placeholder="UUID Supabase"/></label>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void shareSelectedType()} className="min-h-11 rounded-xl bg-[#1D4ED8] px-4 font-bold text-white">Autoriser ce type</button><button disabled={busy} onClick={()=>void revokeShare()} className="min-h-11 rounded-xl border border-red-200 px-4 font-bold text-red-700">Révoquer ce type</button></div>
      </section>
      <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Alertes personnelles</h2><p className="mt-1 text-sm leading-6 text-slate-600">Définissez vos propres plages de rappel. NAXA ne fournit aucun seuil clinique recommandé; demandez conseil à un professionnel de santé pour interpréter les résultats.</p><p className="mt-3 text-sm font-semibold">Type sélectionné : {typeInfo.label}</p>{!typeInfo.numeric?<p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ce type de note ne prend pas en charge les plages numériques.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Limite minimale personnelle<input type="number" step="any" value={minThreshold} onChange={e=>setMinThreshold(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder="Facultatif"/></label><label className="text-sm font-semibold">Limite maximale personnelle<input type="number" step="any" value={maxThreshold} onChange={e=>setMaxThreshold(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder="Facultatif"/></label><button disabled={busy||!selectedConsent} onClick={()=>void saveAlertRule()} className="min-h-11 rounded-xl bg-[#1D4ED8] px-4 font-bold text-white disabled:opacity-40 sm:col-span-2">Enregistrer les limites personnelles</button></div>}<h3 className="mt-5 font-extrabold">Mes plages configurées</h3>{!alertRules.length?<p className="mt-2 text-sm text-slate-500">Aucune alerte personnalisée configurée.</p>:<ul className="mt-2 space-y-2">{alertRules.map(r=><li key={r.id} className="rounded-xl border p-3 text-sm"><strong>{types.find(t=>t.key===r.measurement_type)?.label??r.measurement_type}</strong><p className="mt-1 text-slate-600">Minimum : {r.min_value??"—"} · Maximum : {r.max_value??"—"}</p></li>)}</ul>}<h3 className="mt-5 font-extrabold">Alertes déclenchées</h3>{!alerts.length?<p className="mt-2 text-sm text-slate-500">Aucune alerte déclenchée.</p>:<ul className="mt-2 space-y-2">{alerts.map(a=><li key={a.id} className={a.read_at?"rounded-xl border p-3 text-sm":"rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{types.find(t=>t.key===a.measurement_type)?.label??a.measurement_type}</strong><time className="text-xs">{new Date(a.created_at).toLocaleString("fr-FR")}</time></div><p className="mt-1">Valeur {a.observed_value} {a.alert_kind==="below_user_range"?"inférieure à votre limite minimale":"supérieure à votre limite maximale"}.</p>{!a.read_at&&<button onClick={()=>void markAlertRead(a.id)} className="mt-2 min-h-10 rounded-lg border px-3 font-bold">Marquer comme lue</button>}</li>)}</ul>}<p className="mt-3 text-xs leading-5 text-slate-500">Ces alertes signalent uniquement un écart par rapport à vos paramètres. Elles ne constituent pas un avis médical et ne remplacent pas une urgence médicale.</p></section>
      <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Historique privé</h2>{history.length===0?<p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune mesure enregistrée. Si une erreur de lecture est apparue plus haut, réessayez avant de conclure que l’historique est vide.</p>:<ul className="mt-3 space-y-2">{history.map(m=><li key={m.id} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{types.find(t=>t.key===m.measurement_type)?.label??m.measurement_type}</p><time className="text-xs text-slate-500">{new Date(m.measured_at).toLocaleString("fr-FR")}</time></div><p className="mt-1 text-sm">{m.value_numeric??m.value_text} {m.unit??""}</p>{m.note&&<p className="mt-1 text-sm text-slate-600">{m.note}</p>}<p className="mt-1 text-xs text-slate-500">Source : {m.source==="bluetooth"?"Bluetooth":m.source==="photo_ocr_local"?"OCR local":"saisie manuelle"}</p></li>)}</ul>}</section>
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">NAXA est un carnet de suivi expérimental, pas un dispositif de diagnostic. Vérifiez toute donnée avant de la partager avec un professionnel.</p>
    </div>
  </main>;
}
