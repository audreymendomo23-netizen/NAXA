"use client";

import { useCallback, useEffect, useMemo, useState, useRef, type CSSProperties } from "react";
import Link from "next/link";
import { DeviceIllustration } from "@/components/suivi/DeviceIllustration";
import { SuiviHistoryChart } from "@/components/suivi/SuiviHistoryChart";
import { OPTIONAL_GATT_SERVICES, decodeStandardGattMeasurement } from "@/lib/suivi/ble-protocols";
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
  {key:"debit_expiratoire",label:"Débit expiratoire de pointe",unit:"L/min",family:"constantes",numeric:true},
  {key:"ecg_note",label:"Compte rendu ECG",unit:"Résumé du relevé (sans diagnostic)",family:"constantes",numeric:false},
  {key:"masse_grasse",label:"Masse grasse",unit:"%",family:"metabolisme",numeric:true},
  {key:"masse_musculaire",label:"Masse musculaire",unit:"kg",family:"metabolisme",numeric:true},
  {key:"masse_osseuse",label:"Masse osseuse",unit:"kg",family:"metabolisme",numeric:true},
  {key:"cetonemie",label:"Cétonémie",unit:"mmol/L",family:"metabolisme",numeric:true},
  {key:"acide_urique",label:"Acide urique",unit:"mg/dL",family:"metabolisme",numeric:true},
  {key:"cholesterol_hdl",label:"Cholestérol HDL",unit:"unité du résultat",family:"metabolisme",numeric:true},
  {key:"cholesterol_ldl",label:"Cholestérol LDL",unit:"unité du résultat",family:"metabolisme",numeric:true},
  {key:"capacite_vitale",label:"Capacité vitale",unit:"L",family:"constantes",numeric:true},
];
type UserDevice = { id:string; device_key:string; device_name:string; connection_mode:"manual"|"bluetooth"|"scan"|"hybrid"; active:boolean; device_brand:string|null; device_model:string|null; protocol:string|null; last_sync_at:string|null; last_error:string|null; capabilities:string[]; platform_device_id?:string|null; auto_reconnect?:boolean; connection_state?:string; last_measurement_at?:string|null };
type Measurement = { id:string; measurement_type:string; value_numeric:number|null; value_text:string|null; unit:string|null; measured_at:string; source:string; note:string|null };
type Reminder = { id:string; measurement_type:string; title:string; due_at:string; repeat_rule:string; enabled:boolean };
type AlertRule = { id:string; measurement_type:string; min_value:number|null; max_value:number|null; enabled:boolean };
type TrackingAlert = { id:string; measurement_type:string; observed_value:number; alert_kind:string; created_at:string; read_at:string|null };

function AnimatedCounter({ value }: { value: number }) {
  const [displayedValue, setDisplayedValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayedValue(value);
      return;
    }
    const startedAt = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 600);
      setDisplayedValue(Math.round(value * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);
  return <>{displayedValue}</>;
}

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
  const [pendingMeasurementSource, setPendingMeasurementSource] = useState<"bluetooth" | "photo_ocr_local" | null>(null);
  const [note, setNote] = useState("");
  const [measuredAt, setMeasuredAt] = useState(new Date().toISOString().slice(0,16));
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderAt, setReminderAt] = useState(new Date(Date.now()+86400000).toISOString().slice(0,16));
  const [repeatRule, setRepeatRule] = useState("none");
  const [professionalId, setProfessionalId] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [ocrText, setOcrText] = useState("");
  const [scanKind, setScanKind] = useState<"barcode"|"ocr"|null>(null);
  const [activeTab, setActiveTab] = useState<"Appareils"|"Configurations"|"Alertes"|"Options">("Appareils");
  const [configurationPage, setConfigurationPage] = useState<"home"|"consentements"|"mesures"|"rappels">("home");
  const [optionsPage, setOptionsPage] = useState<"home"|"profil"|"partage"|"historique">("home");
  const [deviceFilter, setDeviceFilter] = useState("Tous");
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string | null>(null);
  const [measurementSheetOpen, setMeasurementSheetOpen] = useState(false);
  const [accent, setAccent] = useState<"Forêt"|"Océan"|"Prune"|"Ambre">("Forêt");
  const bluetoothSessions = useRef(new Map<string, { device:any; retryTimer?:ReturnType<typeof setTimeout>; retries:number }>());

  const load = useCallback(async () => {
    const { data: userData } = await sb.auth.getUser();
    if (!userData.user) { setAllowed(false); return; }
    setAllowed(true);
    const [p, c, m, r, ar, al, d] = await Promise.all([
      sb.from("suivi_profiles").select("preferred_name,birth_year").eq("user_id",userData.user.id).maybeSingle(),
      sb.from("suivi_consents").select("family_key,granted").eq("user_id",userData.user.id),
      sb.from("suivi_measurements").select("id,measurement_type,value_numeric,value_text,unit,measured_at,source,note").eq("user_id",userData.user.id).order("measured_at",{ascending:false}).limit(1000),
      sb.from("suivi_reminders").select("id,measurement_type,title,due_at,repeat_rule,enabled").eq("user_id",userData.user.id).order("due_at",{ascending:true}).limit(100),
      sb.from("suivi_alert_rules").select("id,measurement_type,min_value,max_value,enabled").eq("user_id",userData.user.id),
      sb.from("suivi_alerts").select("id,measurement_type,observed_value,alert_kind,created_at,read_at").eq("user_id",userData.user.id).order("created_at",{ascending:false}).limit(100),
      sb.from("suivi_user_devices").select("id,device_key,device_name,connection_mode,active,device_brand,device_model,protocol,last_sync_at,last_error,capabilities,platform_device_id,auto_reconnect,connection_state,last_measurement_at").eq("user_id",userData.user.id).order("created_at",{ascending:true}),
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
    try {
      const saved = window.localStorage.getItem("naxa-suivi-accent");
      if (saved === "Forêt" || saved === "Océan" || saved === "Prune" || saved === "Ambre") setAccent(saved);
    } catch { /* La palette forêt reste le choix par défaut si le stockage est indisponible. */ }
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem("naxa-suivi-accent", accent); } catch { /* Le choix reste actif pour la session courante. */ }
  }, [accent]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

  useEffect(() => {
    if (!reminders.some(reminder => reminder.enabled)) return;
    const deliverDueReminders = async () => {
      const now = Date.now();
      for (const reminder of reminders) {
        if (!reminder.enabled) continue;
        const due = new Date(reminder.due_at).getTime();
        if (!Number.isFinite(due) || due > now) continue;
        const key = "naxa-suvi-reminder:" + reminder.id + ":" + reminder.due_at;
        try {
          if (sessionStorage.getItem(key)) continue;
          sessionStorage.setItem(key, "shown");
        } catch { /* Le rappel reste affiché dans l’application si le stockage de session est indisponible. */ }
        let pushSubscribed = false;
        if ("serviceWorker" in navigator) {
          try {
            const registration = await navigator.serviceWorker.getRegistration("/");
            pushSubscribed = !!(await registration?.pushManager.getSubscription());
          } catch { /* Le push en arrière-plan sera géré par le service planifié si disponible. */ }
        }
        if (!pushSubscribed && "Notification" in window && Notification.permission === "granted") {
          try { new Notification("NAXA · Rappel personnel", { body: "Un rappel de suivi est arrivé à échéance. Ouvrez NAXA pour le consulter.", tag: key }); } catch { setNotice("Un rappel est arrivé à échéance : " + reminder.title); }
        } else if (!pushSubscribed) {
          setNotice("Rappel arrivé à échéance : " + reminder.title + ". Activez les notifications pour recevoir des alertes lorsque cet espace est ouvert.");
        }
      }
    };
    void deliverDueReminders();
    const timer = window.setInterval(() => void deliverDueReminders(), 30000);
    return () => window.clearInterval(timer);
  }, [reminders, load, sb]);

  async function enableReminderNotifications() {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setNotice("Les notifications Push ne sont pas prises en charge par ce navigateur. Les rappels restent enregistrés dans NAXA.");
      return;
    }
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setNotice("Autorisation refusée. Les rappels restent enregistrés dans votre espace NAXA.");
        return;
      }
      const registration = await navigator.serviceWorker.register("/naxa-push-sw.js", { scope: "/" });
      const keyResponse = await fetch("/api/posologie/push-key", { cache: "no-store" });
      if (!keyResponse.ok) throw new Error("Push public key unavailable");
      const { publicKey } = await keyResponse.json() as { publicKey: string };
      const base64 = publicKey.replace(/-/g, "+").replace(/_/g, "/");
      const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
      const applicationServerKey = Uint8Array.from(atob(padded), character => character.charCodeAt(0));
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const { data: authData } = await sb.auth.getUser();
      if (!authData.user) throw new Error("Session expired");
      const { error } = await sb.from("naxa_push_subscriptions").upsert({
        endpoint: subscription.endpoint,
        user_id: authData.user.id,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (error) throw error;
      setNotice("Notifications Push activées. Les rappels dus peuvent désormais être envoyés en arrière-plan par le service planifié NAXA.");
    } catch {
      setNotice("Activation Push impossible pour le moment. Vérifiez l’autorisation du navigateur et réessayez; vos rappels restent enregistrés.");
    }
  }

  const typeInfo = types.find(t=>t.key===selectedType)!;
  const selectedConsent = !!consents[typeInfo.family];
  const grantedFamilies = families.filter(f=>consents[f.key]).length;
  const accentPalette = {
    "Forêt": { accent: "#0A6B3A", soft: "#E5F4E9", contrast: "#FFFFFF" },
    "Océan": { accent: "#176B87", soft: "#E4F4F8", contrast: "#FFFFFF" },
    "Prune": { accent: "#704080", soft: "#F2EAF5", contrast: "#FFFFFF" },
    "Ambre": { accent: "#9B6500", soft: "#FFF3D5", contrast: "#FFFFFF" },
  };
  const deviceCatalog = [
    { key:"tensiometre", name:"Tensiomètre", mode:"hybrid" as const, family:"constantes" as Family, description:"Saisie manuelle, scan de l’écran ou du relevé, et détection Bluetooth si le modèle expose un profil standard." },
    { key:"thermometre", name:"Thermomètre", mode:"hybrid" as const, family:"constantes" as Family, description:"Saisie, scan et connexion Bluetooth selon le profil GATT du modèle." },
    { key:"oxymetre", name:"Oxymètre de pouls", mode:"hybrid" as const, family:"constantes" as Family, description:"SpO₂ et pouls par saisie ou scan; lecture Bluetooth selon les caractéristiques disponibles." },
    { key:"glucometre", name:"Glucomètre", mode:"hybrid" as const, family:"metabolisme" as Family, description:"Résultat et unité, par saisie ou scan; connexion selon fabricant et protocole." },
    { key:"balance", name:"Balance connectée ou classique", mode:"hybrid" as const, family:"metabolisme" as Family, description:"Poids par saisie, scan de l’affichage ou liaison Bluetooth compatible." },
    { key:"capteur_cardiaque_bluetooth", name:"Capteur cardiaque / cardiofréquencemètre", mode:"hybrid" as const, family:"constantes" as Family, description:"Profil Bluetooth GATT standard fréquence cardiaque, plus saisie et scan." },
    { key:"podometre", name:"Podomètre", mode:"hybrid" as const, family:"activite" as Family, description:"Pas par saisie, scan ou protocole Bluetooth pris en charge." },
    { key:"ecg", name:"Électrocardiographe (ECG)", mode:"hybrid" as const, family:"constantes" as Family, description:"Saisie de la synthèse ou scan du compte rendu; Bluetooth selon modèle et format exporté." },
    { key:"spirometre", name:"Spiromètre", mode:"hybrid" as const, family:"constantes" as Family, description:"Valeurs respiratoires par saisie ou scan; liaison selon fabricant." },
    { key:"peak_flow", name:"Débitmètre de pointe", mode:"hybrid" as const, family:"constantes" as Family, description:"Débit expiratoire par saisie, scan ou liaison compatible." },
    { key:"balance_impedance", name:"Balance impédancemètre", mode:"hybrid" as const, family:"metabolisme" as Family, description:"Poids et composition corporelle par saisie/scan; Bluetooth selon protocole." },
    { key:"cholesterolometre", name:"Lecteur de cholestérol", mode:"hybrid" as const, family:"metabolisme" as Family, description:"Résultat avec unité par saisie, scan ou connexion compatible." },
    { key:"cetonemetre", name:"Lecteur de cétones", mode:"hybrid" as const, family:"metabolisme" as Family, description:"Résultat avec unité par saisie, scan ou connexion compatible." },
    { key:"uricometre", name:"Lecteur d’acide urique", mode:"hybrid" as const, family:"metabolisme" as Family, description:"Résultat avec unité par saisie, scan ou connexion compatible." },
    { key:"montre_connectee", name:"Montre connectée", mode:"hybrid" as const, family:"activite" as Family, description:"Activité et constantes par saisie/scan; synchronisation Bluetooth ou API selon le fabricant." },
    { key:"bracelet_activite", name:"Bracelet d’activité", mode:"hybrid" as const, family:"activite" as Family, description:"Pas, activité et sommeil par saisie/scan; liaison selon le modèle." },
    { key:"tracker_sommeil", name:"Suivi du sommeil", mode:"hybrid" as const, family:"sommeil" as Family, description:"Durée et données exportées par saisie, scan ou intégration disponible." },
    { key:"thermometre_infrarouge", name:"Thermomètre infrarouge", mode:"hybrid" as const, family:"constantes" as Family, description:"Lecture sans contact par saisie, scan ou liaison standard." },
    { key:"capteur_respiration", name:"Capteur respiratoire", mode:"hybrid" as const, family:"constantes" as Family, description:"Données respiratoires par saisie, scan ou protocole compatible." },
    { key:"pilulier_connecte", name:"Pilulier connecté", mode:"hybrid" as const, family:"traitements" as Family, description:"Suivi déclaratif des prises, scan de l’étiquette et connexion selon fabricant; NAXA ne prescrit aucune dose." },
    { key:"bouteille_hydratation", name:"Bouteille connectée / hydratation", mode:"hybrid" as const, family:"activite" as Family, description:"Volume par saisie, scan ou liaison selon le modèle." },
  ];

  const selectedDevice = deviceCatalog.find(device => device.key === selectedDeviceKey) ?? null;
  const selectedSavedDevice = selectedDevice ? devices.find(device => device.device_key === selectedDevice.key) : undefined;

  async function toggleDevice(device: typeof deviceCatalog[number]) {
    const existing = devices.find(d => d.device_key === device.key);
    if ((!existing || !existing.active) && !consents[device.family]) {
      setNotice(`Acceptez d’abord le consentement « ${families.find(f=>f.key===device.family)?.label} » pour activer ce dispositif.`);
      return;
    }
    setBusy(true); setNotice("");
    const { data:userData } = await sb.auth.getUser();
    if (!userData.user) { setNotice("Session expirée. Reconnectez-vous."); setBusy(false); return; }
    const { error } = existing
      ? await sb.from("suivi_user_devices").update({active:!existing.active, updated_at:new Date().toISOString()}).eq("id",existing.id).eq("user_id",userData.user.id)
      : await sb.from("suivi_user_devices").insert({user_id:userData.user.id,device_key:device.key,device_name:device.name,connection_mode:device.mode,capabilities:["manual","bluetooth","scan"],active:true});
    if (error) setNotice("Activation impossible. Vérifiez le consentement et réessayez.");
    else {
      const { data } = await sb.from("suivi_user_devices").select("id,device_key,device_name,connection_mode,active,device_brand,device_model,protocol,last_sync_at,last_error,capabilities").eq("user_id",userData.user.id).order("created_at",{ascending:true});
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
    if (error) {
      setNotice("Le consentement n’a pas été enregistré. Réessayez.");
      setBusy(false);
      return;
    }

    setConsents(p=>({...p,[family]:grant}));
    if (!grant) {
      const keys = deviceCatalog.filter(device => device.family === family).map(device => device.key);
      const { error: deviceError } = await sb
        .from("suivi_user_devices")
        .update({ active:false, updated_at:new Date().toISOString() })
        .eq("user_id", userData.user.id)
        .in("device_key", keys);
      await load();
      setNotice(deviceError
        ? "Consentement retiré et nouvelles saisies bloquées. Certains dispositifs n’ont pas pu être désactivés; réessayez de les désactiver depuis le catalogue."
        : "Consentement retiré. Les dispositifs de cette famille sont désactivés et les nouvelles saisies sont bloquées.");
    }
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
    else { setValue(""); setNote(""); setPendingMeasurementSource(null); setMeasurementSheetOpen(false); setNotice("Entrée enregistrée dans votre espace privé."); await load(); }
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
    const {error}=await sb.from("suivi_shares").upsert({owner_user_id:userData.user.id,recipient_user_id:professionalId.trim(),measurement_type:selectedType,active:true,revoked_at:null},{onConflict:"owner_user_id,recipient_user_id,measurement_type"});
    if(error)setNotice("Partage refusé : le destinataire doit être un professionnel explicitement vérifié. Aucune donnée n’a été partagée.");
    else setNotice("Autorisation de partage enregistrée pour ce type uniquement.");
    setBusy(false);
  }

  async function revokeShare() {
    const {data:userData}=await sb.auth.getUser();
    if(!userData.user || !professionalId.trim()) return;
    const {error}=await sb.from("suivi_shares").update({active:false,revoked_at:new Date().toISOString()}).eq("owner_user_id",userData.user.id).eq("recipient_user_id",professionalId.trim()).eq("measurement_type",selectedType);
    setNotice(error?"Impossible de révoquer ce partage.":"Partage révoqué.");
  }

  async function connectHeartRate() {
    await connectDeviceBluetooth("capteur_cardiaque_bluetooth");
  }

  function bluetoothShortUuid(uuid: string) {
    const value = String(uuid).toLowerCase();
    const match = value.match(/0000([0-9a-f]{4})-0000-1000-8000-00805f9b34fb$/);
    return match ? match[1] : value;
  }

  async function startBluetoothSession(device: any, deviceKey: string, shouldRegister = true) {
    const bluetooth = (navigator as any).bluetooth;
    const { data: authData } = await sb.auth.getUser();
    if (!authData.user || !device?.gatt) throw new Error("Compte ou service Bluetooth indisponible");
    if (bluetoothSessions.current.has(String(device.id))) return;
    const item = deviceCatalog.find(entry => entry.key === deviceKey);
    if (!item || !consents[item.family]) throw new Error("Consentement requis pour cette famille");
    const connected = device.gatt.connected ? device : await device.gatt.connect();
    const discovered: Array<{service:any;characteristic:any}> = [];
    const pairs = [
      ["heart_rate","heart_rate_measurement"],
      ["blood_pressure","blood_pressure_measurement"],
      ["health_thermometer","temperature_measurement"],
      ["pulse_oximeter","plx_spot_check_measurement"],
      ["pulse_oximeter","plx_continuous_measurement"],
      ["glucose","glucose_measurement"],
      ["weight_scale","weight_measurement"],
      ["body_composition","body_composition_measurement"],
      ["running_speed_cadence","rsc_measurement"]
    ];
    for (const [serviceName, characteristicName] of pairs) {
      try {
        const service = await connected.gatt.getPrimaryService(serviceName);
        const characteristic = await service.getCharacteristic(characteristicName);
        discovered.push({service,characteristic});
      } catch { /* Service ou caractéristique absent sur ce modèle. */ }
    }
    if (!discovered.length) throw new Error("Aucun profil GATT standard décodable n'a été trouvé sur cet appareil.");

    let deviceRow = devices.find(entry => entry.device_key === deviceKey && entry.platform_device_id === String(connected.id));
    if (!deviceRow && shouldRegister) {
      const unpaired = devices.find(entry => entry.device_key === deviceKey && !entry.platform_device_id && entry.active);
      const metadata = {
        platform_device_id:String(connected.id),
        device_model:String(connected.name ?? item.name).slice(0,120),
        protocol:discovered.map(entry=>bluetoothShortUuid(entry.service.uuid)+"/"+bluetoothShortUuid(entry.characteristic.uuid)).join(",").slice(0,80),
        connection_state:"connected",
        auto_reconnect:true,
        background_supported:false,
        last_seen_at:new Date().toISOString(),
        last_error:null,
        updated_at:new Date().toISOString()
      };
      const saved = unpaired
        ? await sb.from("suivi_user_devices").update(metadata).eq("id",unpaired.id).eq("user_id",authData.user.id).select("id").maybeSingle()
        : await sb.from("suivi_user_devices").insert({user_id:authData.user.id,device_key:deviceKey,device_name:String(connected.name ?? item.name).slice(0,120),connection_mode:"bluetooth",active:true,capabilities:["bluetooth","manual","scan"],...metadata}).select("id").single();
      if (saved.error || !saved.data?.id) throw saved.error ?? new Error("Impossible d'enregistrer cet appareil");
      deviceRow = { id:saved.data.id, device_key:deviceKey, device_name:String(connected.name ?? item.name), connection_mode:"bluetooth", active:true, device_brand:null, device_model:String(connected.name ?? item.name), protocol:metadata.protocol, last_sync_at:null,last_error:null,capabilities:["bluetooth"],platform_device_id:String(connected.id),auto_reconnect:true,connection_state:"connected",last_measurement_at:null };
    }
    if (!deviceRow) throw new Error("Activez d'abord cette catégorie d'appareil dans votre catalogue.");
    await sb.from("suivi_user_devices").update({
      connection_state:"connected", platform_device_id:String(connected.id),
      auto_reconnect:true, background_supported:false,
      device_model:String(connected.name ?? deviceRow.device_model ?? item.name).slice(0,120),
      protocol:discovered.map(entry=>bluetoothShortUuid(entry.service.uuid)+"/"+bluetoothShortUuid(entry.characteristic.uuid)).join(",").slice(0,80),
      last_seen_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()
    }).eq("id",deviceRow.id).eq("user_id",authData.user.id);

    const session = { device:connected, retries:0 as number, retryTimer:undefined as ReturnType<typeof setTimeout>|undefined };
    bluetoothSessions.current.set(String(connected.id),session);
    const persist = async (service:any, characteristic:any, data:DataView) => {
      const measurements = decodeStandardGattMeasurement(bluetoothShortUuid(service.uuid),bluetoothShortUuid(characteristic.uuid),data);
      if (!measurements.length) return;
      const receivedAt = new Date().toISOString();
      const payloadId = Array.from(new Uint8Array(data.buffer,data.byteOffset,data.byteLength)).map(v=>v.toString(16).padStart(2,"0")).join("");
      const rows = measurements.map((measurement,index)=>({
        user_id:authData.user.id,
        measurement_type:measurement.measurement_type,
        value_numeric:measurement.value_numeric,
        value_text:null,
        unit:measurement.unit,
        measured_at:measurement.measured_at ?? receivedAt,
        received_at:receivedAt,
        source:"bluetooth",
        sync_origin:"pwa",
        device_id:deviceRow!.id,
        device_event_id:receivedAt+":"+bluetoothShortUuid(characteristic.uuid)+":"+index+":"+payloadId,
        device_model_snapshot:String(connected.name ?? item.name).slice(0,120),
        device_brand_snapshot:deviceRow!.device_brand,
        note:null
      }));
      const {error:insertError}=await sb.from("suivi_measurements").insert(rows);
      if(insertError) {
        setNotice("Mesure reçue, mais son enregistrement serveur a échoué. Vérifiez que la migration de synchronisation multi-appareils est appliquée.");
        return;
      }
      await sb.from("suivi_user_devices").update({
        last_sync_at:receivedAt,last_measurement_at:receivedAt,last_seen_at:receivedAt,
        connection_state:"connected",last_error:null,updated_at:receivedAt
      }).eq("id",deviceRow!.id).eq("user_id",authData.user.id);
      setNotice("Mesure synchronisée automatiquement depuis "+String(connected.name ?? item.name)+".");
      await load();
    };
    for (const entry of discovered) {
      const {service,characteristic}=entry;
      const onValue = (event:Event) => {
        const value=(event.target as any).value as DataView|undefined;
        if(value) void persist(service,characteristic,value).catch(()=>setNotice("Erreur de décodage Bluetooth; aucune valeur non vérifiée n'a été enregistrée."));
      };
      if ((characteristic as any).properties?.notify || (characteristic as any).properties?.indicate) {
        characteristic.addEventListener("characteristicvaluechanged",onValue);
        try {
          await characteristic.startNotifications();
          if ((characteristic as any).properties?.read) {
            try { const initial=await characteristic.readValue(); await persist(service,characteristic,initial); } catch { /* Une lecture initiale n'est pas obligatoire si le flux notifie. */ }
          }
        } catch {
          characteristic.removeEventListener("characteristicvaluechanged",onValue);
          if ((characteristic as any).properties?.read) {
            const initial=await characteristic.readValue();
            await persist(service,characteristic,initial);
          }
        }
      } else if ((characteristic as any).properties?.read) {
        const initial=await characteristic.readValue();
        await persist(service,characteristic,initial);
      }
    }
    const onDisconnected = () => {
      void sb.from("suivi_user_devices").update({connection_state:"disconnected",last_error:"Connexion Bluetooth interrompue",updated_at:new Date().toISOString()}).eq("id",deviceRow!.id).eq("user_id",authData.user.id);
      setNotice("Appareil déconnecté. NAXA tentera une reconnexion automatique tant que cet espace reste ouvert.");
      const current=bluetoothSessions.current.get(String(connected.id));
      if(!current) return;
      const retry=async()=>{
        if(!bluetoothSessions.current.has(String(connected.id))) return;
        try {
          await connected.gatt.connect();
          current.retries=0;
          await sb.from("suivi_user_devices").update({connection_state:"connected",last_seen_at:new Date().toISOString(),last_error:null,updated_at:new Date().toISOString()}).eq("id",deviceRow!.id);
          setNotice("Connexion Bluetooth rétablie : "+String(connected.name ?? item.name)+".");
          for(const entry of discovered) {
            if((entry.characteristic as any).properties?.notify || (entry.characteristic as any).properties?.indicate) {
              await entry.characteristic.startNotifications();
            }
          }
        } catch {
          current.retries++;
          if(current.retries<=6) current.retryTimer=window.setTimeout(()=>void retry(),Math.min(30000,1000*Math.pow(2,current.retries)));
          else setNotice("Reconnexion automatique suspendue après plusieurs échecs. Réactivez l'appareil depuis NAXA.");
        }
      };
      current.retryTimer=window.setTimeout(()=>void retry(),1000);
    };
    connected.addEventListener("gattserverdisconnected",onDisconnected);
    await load();
    setNotice("Appareil connecté. Les nouvelles mesures compatibles sont synchronisées automatiquement tant que le système maintient la connexion.");
  }

  async function connectDeviceBluetooth(deviceKey: string) {
    const item=deviceCatalog.find(device=>device.key===deviceKey);
    if(!item || !consents[item.family]) { setNotice("Consentement requis avant la connexion Bluetooth."); return; }
    if(!window.isSecureContext) { setNotice("Le Bluetooth Web exige HTTPS."); return; }
    const bluetooth=(navigator as any).bluetooth;
    if(!bluetooth?.requestDevice) { setNotice("Ce navigateur ne prend pas en charge Web Bluetooth. Utilisez l'APK compagnon ou une saisie/connexion prise en charge."); return; }
    setBusy(true); setNotice("Recherche d'un appareil Bluetooth…");
    try {
      const device=await bluetooth.requestDevice({acceptAllDevices:true,optionalServices:OPTIONAL_GATT_SERVICES});
      await startBluetoothSession(device,deviceKey,true);
    } catch(error) {
      const message=error instanceof Error ? error.message : "Connexion Bluetooth impossible";
      setNotice(message);
    } finally { setBusy(false); }
  }


  function applyScannedValue() {
    if (scanKind !== "ocr" || !typeInfo.numeric) { setNotice("Pour éviter une erreur, choisissez manuellement la valeur à utiliser dans ce scan."); return; }
    const candidates = ocrText.match(/-?\d+(?:[.,]\d+)?/g) ?? [];
    if (candidates.length !== 1) { setNotice("Le scan contient plusieurs nombres. Choisissez la bonne valeur manuellement pour éviter d’enregistrer une date ou une autre mesure."); return; }
    setValue(candidates[0].replace(",", "."));
    setPendingMeasurementSource("photo_ocr_local");
    setNotice("Valeur préremplie depuis le scan. Vérifiez-la et confirmez explicitement l’enregistrement.");
  }

  async function readImageLocally(file?: File) {
    if (!file) return;
    setOcrText("");
    setScanKind(null);
    setBusy(true);
    setNotice("Analyse locale de l’image en cours… l’image ne sera pas envoyée à NAXA.");
    try {
      const bitmap = await createImageBitmap(file);
      const Barcode = (window as any).BarcodeDetector;
      if (Barcode) {
        try {
          const detector = new Barcode({ formats: ["qr_code","code_128","code_39","ean_13","ean_8","upc_a","upc_e","data_matrix"] });
          const codes = await detector.detect(bitmap);
          const decoded = codes.map((item:any)=>String(item.rawValue ?? "")).filter(Boolean);
          if (decoded.length) {
            setOcrText(decoded.join("\n"));
            setNotice("Code détecté localement. Vérifiez le contenu avant de l’utiliser; aucune donnée n’est enregistrée automatiquement.");
            setBusy(false);
            return;
          }
        } catch { /* Le navigateur peut ne pas prendre en charge tous les formats. Repli OCR ci-dessous. */ }
      }
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("fra+eng");
      try {
        const result = await worker.recognize(file);
        const text = result.data.text.trim();
        if (!text) throw new Error("No text detected");
        setOcrText(text);
        setScanKind("ocr");
        setNotice("Scan OCR effectué localement. Vérifiez chaque valeur et son unité avant l’enregistrement.");
      } finally {
        await worker.terminate();
      }
    } catch {
      setNotice("Le scan n’a pas pu lire cette image. Elle n’a pas été envoyée; vous pouvez réessayer ou saisir les valeurs manuellement.");
    } finally {
      setBusy(false);
    }
  }

  function exportPdf() { window.print(); }

  if (allowed === null) return <main className="min-h-screen bg-white p-6 text-[#0A6B3A]" aria-live="polite"><p className="animate-pulse font-bold">Chargement sécurisé du suivi…</p></main>;
  if (!allowed) return <main className="min-h-screen bg-[#F8FAFC] p-6 text-slate-900"><div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm"><p className="text-sm font-extrabold uppercase tracking-widest text-[#0A6B3A]">NAXA · Dispositifs médicaux</p><h1 className="mt-3 text-3xl font-black">Connexion requise</h1><p className="mt-3 leading-7 text-slate-600">Connectez-vous pour accéder à votre suivi privé. Vos données restent protégées par votre compte.</p><Link href="/connexion?next=%2Fsuivi" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-[#0A6B3A] px-5 font-bold text-white">Se connecter</Link></div></main>;

  return <main style={{ "--accent": accentPalette[accent].accent, "--accent-soft": accentPalette[accent].soft, "--accent-contrast": accentPalette[accent].contrast } as CSSProperties} className="naxa-bento-page min-h-screen bg-[#F2FAF5] px-4 pb-12 text-slate-900 print:bg-white">
    <div className="mx-auto max-w-6xl pt-5 sm:pt-8">
      <header className="relative overflow-hidden rounded-[32px] border border-blue-100 bg-gradient-to-br from-[#082B4C] via-[#124E82] to-[#1D4ED8] p-5 text-white shadow-[0_24px_65px_rgba(20,70,130,0.20)] sm:p-8 print:bg-white print:text-black">
        <div className="grid items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="relative z-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-100">NAXA · Santé connectée</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Mon suivi santé</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-blue-50 sm:text-base">Retrouvez vos appareils, centralisez vos mesures et suivez leur évolution dans un espace personnel et privé.</p>
            <div className="mt-5 flex flex-wrap gap-2 print:hidden">
              <button type="button" onClick={() => { setActiveTab("Appareils"); setDeviceFilter("Tous"); }} className="min-h-11 rounded-xl bg-white px-4 font-bold text-[#124E82] shadow-sm transition hover:bg-blue-50">Explorer les appareils</button>
              <button type="button" onClick={() => { setActiveTab("Configurations"); setConfigurationPage("mesures"); setMeasurementSheetOpen(true); }} className="min-h-11 rounded-xl border border-white/50 bg-white/10 px-4 font-bold text-white transition hover:bg-white/20">Ajouter une mesure</button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Aperçu des appareils suivis">
            {[
              { name:"Tensiomètre", deviceKey:"tensiometre" },
              { name:"Oxymètre", deviceKey:"oxymetre" },
              { name:"Glucomètre", deviceKey:"glucometre" }
            ].map((item) => (
              <div key={item.deviceKey} className="min-w-0 rounded-2xl border border-white/60 bg-white p-2 shadow-lg sm:rounded-3xl sm:p-3">
                <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-[#F4F8FC]">
                  <DeviceIllustration deviceKey={item.deviceKey} label={item.name} className="rounded-xl" />
                </div>
                <p className="mt-2 truncate text-center text-[11px] font-extrabold text-slate-700 sm:text-xs">{item.name}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-[11px] leading-4 text-blue-100">Images illustratives : elles représentent les catégories d’appareils, pas une marque ni une compatibilité garantie.</p>
      </header>
      <section aria-label="Résumé du suivi" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Mes appareils</p><p className="mt-2 text-3xl font-black text-slate-900"><AnimatedCounter value={devices.filter(device=>device.active).length} /></p><p className="mt-1 text-sm text-slate-500">appareils activés dans mon espace</p></article>
        <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Mes mesures</p><p className="mt-2 text-3xl font-black text-slate-900"><AnimatedCounter value={history.length} /></p><p className="mt-1 text-sm text-slate-500">entrées personnelles enregistrées</p></article>
        <article className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm"><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Mes rappels</p><p className="mt-2 text-3xl font-black text-slate-900"><AnimatedCounter value={reminders.filter(reminder=>reminder.enabled).length} /></p><p className="mt-1 text-sm text-slate-500">rappels actuellement actifs</p></article>
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Votre chronologie</p><h2 className="mt-1 text-xl font-extrabold text-slate-900">Mes dernières mesures</h2></div><button type="button" onClick={() => { setActiveTab("Options"); setOptionsPage("historique"); }} className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">Tout l’historique</button></div>
          {history.length ? <div className="mt-4 divide-y divide-slate-100">{history.slice(0,3).map((measurement) => <div key={measurement.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"><div className="min-w-0"><p className="font-bold text-slate-800">{types.find(type=>type.key===measurement.measurement_type)?.label??measurement.measurement_type}</p><p className="mt-1 text-xs text-slate-500">{new Date(measurement.measured_at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</p></div><p className="shrink-0 text-lg font-black text-[#124E82]">{measurement.value_numeric??measurement.value_text??"—"} <span className="text-xs font-semibold text-slate-500">{measurement.unit??""}</span></p></div>)}</div> : <div className="mt-4 rounded-2xl bg-[#F4F8FC] p-4"><p className="font-bold text-slate-800">Votre historique commencera ici.</p><p className="mt-1 text-sm leading-5 text-slate-600">Ajoutez un appareil ou saisissez votre première mesure. Rien n’est prérempli avec des données fictives.</p></div>}
        </div>
        <aside className="rounded-[26px] border border-blue-100 bg-[#EEF5FD] p-5">
          <p className="text-xs font-extrabold uppercase tracking-wider text-blue-800">État de votre espace</p><div className="mt-3 flex items-center gap-2"><span className={"h-2.5 w-2.5 rounded-full "+(online?"bg-emerald-500":"bg-amber-500")} /><p className="font-bold text-slate-900">{online?"Application en ligne":"Hors connexion"}</p></div>
          <p className="mt-2 text-sm leading-5 text-slate-600">{online?"Les services en ligne sont accessibles; les appareils ne sont considérés synchronisés qu’après une lecture Bluetooth vérifiée.":"La connexion est indisponible. Les nouvelles données ne peuvent pas être synchronisées."}</p>
          <div className="mt-4 border-t border-blue-200 pt-3"><p className="text-sm font-bold text-slate-900">Consentements</p><p className="mt-1 text-sm text-slate-600">{grantedFamilies} famille(s) sur 6 autorisée(s)</p><button type="button" onClick={() => { setActiveTab("Configurations"); setConfigurationPage("consentements"); }} className="mt-3 min-h-10 rounded-xl border border-blue-200 bg-white px-3 text-sm font-bold text-blue-800">Gérer mes autorisations</button></div>
        </aside>
      </section>
      <nav aria-label="Sections du suivi connecté" className="sticky top-0 z-30 -mx-4 mt-4 border-b border-slate-200 bg-[#F7F8F4] px-4 py-2 sm:mx-0 sm:rounded-full sm:border"><div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">{(["Appareils","Configurations","Alertes","Options"] as const).map(tab=><button key={tab} onClick={()=>setActiveTab(tab)} aria-current={activeTab===tab?"page":undefined} className={"min-h-11 shrink-0 rounded-full px-4 text-sm font-extrabold transition active:scale-[.97] "+(activeTab===tab?"bg-[var(--accent)] text-white":"bg-white text-slate-600")}>{tab}</button>)}</div></nav>
      {!online && <p role="status" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Hors connexion : les nouvelles données ne peuvent pas être synchronisées. Les entrées non enregistrées ne sont pas conservées automatiquement.</p>}
      {notice && <p role="status" className="mt-4 rounded-xl border border-emerald-200 bg-blue-50 p-3 text-sm text-blue-950">{notice}</p>}
      {activeTab==="Configurations" && configurationPage==="home" && <section aria-label="Configurations" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([{key:"consentements",title:"Consentements",description:"Choisissez les familles de données que vous autorisez."},{key:"mesures",title:"Mesures",description:"Sélectionnez un type et ajoutez une entrée à votre suivi."},{key:"rappels",title:"Rappels",description:"Organisez vos rappels personnels."}] as const).map(card=><button key={card.key} type="button" onClick={()=>setConfigurationPage(card.key)} className="min-h-36 rounded-[24px] border border-white bg-white p-5 text-left shadow-[0_12px_32px_rgba(10,75,42,0.08)] transition active:scale-[.97]"><span className="block text-lg font-extrabold text-[#064B2A]">{card.title}</span><span className="mt-2 block text-sm leading-5 text-slate-600">{card.description}</span><span className="mt-4 block text-sm font-bold text-[#0A6B3A]">Ouvrir →</span></button>)}
      </section>}
      {activeTab==="Options" && optionsPage==="home" && <section aria-label="Options" className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {([{key:"profil",title:"Profil",description:"Personnalisez les informations facultatives de votre carnet."},{key:"partage",title:"Partage",description:"Gérez les autorisations de partage par type."},{key:"historique",title:"Historique",description:"Consultez les mesures enregistrées dans votre espace privé."}] as const).map(card=><button key={card.key} type="button" onClick={()=>setOptionsPage(card.key)} className="min-h-36 rounded-[24px] border border-white bg-white p-5 text-left shadow-[0_12px_32px_rgba(10,75,42,0.08)] transition active:scale-[.97]"><span className="block text-lg font-extrabold text-[#064B2A]">{card.title}</span><span className="mt-2 block text-sm leading-5 text-slate-600">{card.description}</span><span className="mt-4 block text-sm font-bold text-[#0A6B3A]">Ouvrir →</span></button>)}
      </section>}
      <section id="bibliotheque-appareils" className={(activeTab==="Appareils"?"":"hidden ")+"mt-5 scroll-mt-24 rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6"}>
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">Bibliothèque personnelle</p><h2 className="mt-1 text-2xl font-black text-slate-900">Mes appareils médicaux</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Choisissez les appareils que vous possédez pour les associer à votre carnet. Chaque fiche présente une image dédiée et les modes d’acquisition possibles.</p></div><span className="rounded-full bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-800">21 catégories · suivi gratuit</span></div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Filtrer les appareils">{["Tous","Constantes","Métabolisme","Activité & hydratation","Sommeil","Traitements"].map(filter=><button key={filter} type="button" onClick={()=>setDeviceFilter(filter)} aria-pressed={deviceFilter===filter} className={"min-h-11 shrink-0 rounded-full border px-4 text-sm font-bold transition "+(deviceFilter===filter?"border-blue-700 bg-blue-700 text-white":"border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>{filter}</button>)}</div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {deviceCatalog.filter(device=>deviceFilter==="Tous"||(deviceFilter==="Constantes"&&["tensiometre","thermometre","oxymetre","capteur_cardiaque_bluetooth","ecg","spirometre","peak_flow","thermometre_infrarouge","capteur_respiration"].includes(device.key))||(deviceFilter==="Métabolisme"&&["glucometre","balance","balance_impedance","cholesterolometre","cetonemetre","uricometre"].includes(device.key))||(deviceFilter==="Activité & hydratation"&&["podometre","montre_connectee","bracelet_activite","bouteille_hydratation"].includes(device.key))||(deviceFilter==="Sommeil"&&device.key==="tracker_sommeil")||(deviceFilter==="Traitements"&&device.key==="pilulier_connecte")).map(device=>{
            const saved=devices.find(d=>d.device_key===device.key);
            return <button key={device.key} type="button" onClick={()=>setSelectedDeviceKey(device.key)} aria-label={"Afficher la fiche "+device.name} className={"group overflow-hidden rounded-[24px] border bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 "+(saved?.active?"border-blue-300 ring-1 ring-blue-100":"border-slate-200")}>
              <div className="relative grid h-40 place-items-center overflow-hidden bg-gradient-to-b from-[#F8FBFF] to-[#EAF2FA] sm:h-48"><DeviceIllustration deviceKey={device.key} label={"Illustration : "+device.name} className="transition-transform duration-300 group-hover:scale-[1.04]" />{saved?.active&&<span className="absolute left-3 top-3 rounded-full bg-blue-700 px-3 py-1 text-[11px] font-extrabold text-white shadow">Dans mon suivi</span>}<span className="absolute bottom-3 right-3 rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[10px] font-bold text-slate-600">Visuel illustratif</span></div>
              <div className="p-4"><div className="flex min-h-12 items-start justify-between gap-2"><h3 className="font-extrabold leading-5 text-slate-900">{device.name}</h3><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{saved?.active?"Activé":"À ajouter"}</span></div><p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-600">{device.description}</p><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-[11px] font-semibold text-slate-500">{families.find(f=>f.key===device.family)?.label??"Suivi"}</span><span className="text-sm font-extrabold text-blue-700">Voir la fiche →</span></div>{saved?.last_sync_at&&<p className="mt-2 text-[11px] text-slate-500">Dernière lecture : {new Date(saved.last_sync_at).toLocaleString("fr-FR",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</p>}</div>
            </button>;
          })}
        </div>
        <p className="mt-5 rounded-2xl border border-blue-100 bg-[#F4F8FC] p-4 text-xs leading-5 text-slate-600">Les images sont des illustrations génériques. Un appareil activé n’est pas nécessairement connecté : la compatibilité Bluetooth est confirmée uniquement lorsqu’un profil standard et une mesure sont réellement lus et vérifiés. La saisie manuelle et le scan local restent disponibles selon la catégorie.</p>
      </section>
      {selectedDevice && activeTab==="Appareils" && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4" role="presentation" onClick={()=>setSelectedDeviceKey(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="device-sheet-title" className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]" onClick={event=>event.stopPropagation()}>
          <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden"/>
          <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold uppercase tracking-widest text-[#0A6B3A]">NAXA · visuel illustratif</p><h2 id="device-sheet-title" className="mt-1 text-xl font-extrabold">{selectedDevice.name}</h2></div><button type="button" onClick={()=>setSelectedDeviceKey(null)} aria-label="Fermer les détails" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border text-xl">×</button></div>
          <div className="mt-4 grid h-64 place-items-center overflow-hidden rounded-[24px] bg-[#EEF4FA] sm:h-72"><DeviceIllustration deviceKey={selectedDevice.key} label={selectedDevice.name} className="transition-opacity duration-300" /></div>
          <p className="mt-4 text-sm leading-6 text-slate-600">{selectedDevice.description}</p>
          <p className="mt-3 text-sm font-semibold">Saisie manuelle · Bluetooth · Scan</p>
          <p className="mt-2 text-sm"><span className={"inline-flex rounded-full px-3 py-1 font-bold "+(selectedSavedDevice?.active?"bg-[#E5F4E9] text-[#064B2A]":"bg-slate-100 text-slate-600")}>{selectedSavedDevice?.active?"Actif":"Inactif"}</span></p>
          <button type="button" disabled={busy} onClick={async()=>{await toggleDevice(selectedDevice);}} className={"mt-4 min-h-11 w-full rounded-xl px-4 font-bold text-white disabled:opacity-40 "+(selectedSavedDevice?.active?"bg-slate-700":"bg-[#0A6B3A]")}>{selectedSavedDevice?.active?"Désactiver":"Activer ce dispositif"}</button>
          {selectedSavedDevice?.active&&<button type="button" disabled={busy||!consents[selectedDevice.family]} onClick={()=>void connectDeviceBluetooth(selectedDevice.key)} className="mt-2 min-h-11 w-full rounded-xl border border-[#0A6B3A] px-4 font-bold text-[#0A6B3A] disabled:opacity-40">Détecter via Bluetooth</button>}
          <button type="button" onClick={()=>{setSelectedType(types.find(type=>type.family===selectedDevice.family)?.key??selectedType);setSelectedDeviceKey(null);setActiveTab("Configurations");setConfigurationPage("mesures");setMeasurementSheetOpen(true);}} className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-4 font-bold">Ajouter une mesure</button>
        </section>
      </div>}
      <section className={(activeTab==="Options" && optionsPage==="profil"?"":"hidden ")+"mt-5 naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5"}><button type="button" onClick={()=>setOptionsPage("home")} className="mb-3 min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-[#0A6B3A]">← Options</button><h2 className="text-xl font-extrabold">Profil de suivi</h2><p className="mt-1 text-sm text-slate-600">Informations facultatives pour personnaliser votre carnet. Elles ne sont pas visibles par un professionnel sans partage explicite d’une mesure.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nom d’affichage<input value={preferredName} onChange={e=>setPreferredName(e.target.value)} maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border px-3 text-base"/></label><label className="text-sm font-semibold">Année de naissance (facultative)<input type="number" min="1900" max={new Date().getFullYear()} value={birthYear} onChange={e=>setBirthYear(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 text-base"/></label></div><button disabled={busy} onClick={()=>void saveProfile()} className="mt-3 min-h-11 rounded-xl bg-[#0A6B3A] px-4 font-bold text-white disabled:opacity-40">Enregistrer le profil</button><div className="mt-5"><h3 className="font-extrabold">Couleur d’accent</h3><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(["Forêt","Océan","Prune","Ambre"] as const).map(name=><button key={name} type="button" onClick={()=>setAccent(name)} aria-pressed={accent===name} className={"min-h-11 rounded-xl border-2 px-3 text-sm font-bold "+(accent===name?"border-slate-900":"border-slate-200")} style={{backgroundColor:accentPalette[name].accent,color:accentPalette[name].contrast}}>{name}{accent===name?" ✓":""}</button>)}</div></div></section>
      <section className={(activeTab==="Configurations" && configurationPage==="consentements"?"":"hidden ")+"mt-5 naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5"}><div className="flex flex-wrap items-start justify-between gap-3"><div><button type="button" onClick={()=>setConfigurationPage("home")} className="mb-3 min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-[#0A6B3A]">← Configurations</button><h2 className="text-xl font-extrabold">Consentements</h2><p className="mt-1 text-sm text-slate-600">Choisissez séparément les familles que vous souhaitez utiliser. Sans consentement actif, aucune nouvelle saisie n’est autorisée.</p></div><div className="flex items-center gap-3"><div className="grid h-16 w-16 shrink-0 place-items-center rounded-full p-1" style={{background:`conic-gradient(var(--accent) ${grantedFamilies/6*100}%, #E5F4E9 0)`}}><div className="grid h-full w-full place-items-center rounded-full bg-white text-sm font-extrabold text-[#064B2A]">{grantedFamilies}/6</div></div><span className="text-sm font-bold text-slate-600">autorisées</span></div></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{families.map(f=><article key={f.key} className="naxa-family-tile rounded-[22px] border border-white/90 p-4 shadow-[0_10px_28px_rgba(20,60,40,0.07)] transition duration-300 hover:-translate-y-0.5"><h3 className="font-bold">{f.label}</h3><p className="mt-1 text-sm leading-5 text-slate-600">{f.description}</p><button disabled={busy} onClick={()=>void toggleConsent(f.key,!consents[f.key])} className={consents[f.key]?"mt-3 min-h-11 rounded-lg border border-slate-200 px-3 text-sm font-bold text-slate-600":"mt-3 min-h-11 rounded-lg bg-[#0A6B3A] px-3 text-sm font-bold text-white"}>{consents[f.key]?"Retirer le consentement":"J’accepte cette famille"}</button></article>)}</div>
      </section>
      <section className={(activeTab==="Configurations" && configurationPage==="mesures"?"":"hidden ")+"mt-5 naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5"}><button type="button" onClick={()=>setConfigurationPage("home")} className="mb-3 min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-[#0A6B3A]">← Configurations</button><h2 className="text-xl font-extrabold">Mesures</h2><p className="mt-1 text-sm text-slate-600">Sélectionnez une carte pour la saisie. Les valeurs ne sont pas interprétées comme un diagnostic.</p>
        <div className="mt-4 space-y-5">{families.map(f=><div key={f.key}><h3 className="mb-2 font-extrabold text-[#0A6B3A]">{f.label}</h3><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{types.filter(t=>t.family===f.key).map(t=><button key={t.key} aria-pressed={selectedType===t.key} onClick={()=>{setSelectedType(t.key);setMeasurementSheetOpen(true);}} className={selectedType===t.key?"naxa-measure-tile min-h-20 rounded-[20px] border-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3 text-left shadow-[0_10px_28px_rgba(10,107,58,0.12)]":"naxa-measure-tile min-h-20 rounded-[20px] border border-slate-200 bg-white p-3 text-left shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-md"}><span className="block text-sm font-bold">{t.label}</span><span className="mt-1 block text-sm text-slate-500">{t.unit||"Note"}</span></button>)}</div></div>)}</div>
      </section>
      <section className={(activeTab==="Configurations" && (configurationPage==="mesures" || configurationPage==="rappels")?"":"hidden ")+"mt-5 grid gap-5 lg:grid-cols-2"}>
        <div className={(configurationPage==="mesures" && measurementSheetOpen?"":"hidden ")+"fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"} role="presentation" onClick={()=>setMeasurementSheetOpen(false)}><div role="dialog" aria-modal="true" aria-labelledby="measurement-sheet-title" onClick={event=>event.stopPropagation()} className="naxa-bento-card max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px]"><button type="button" onClick={()=>setMeasurementSheetOpen(false)} aria-label="Fermer la saisie" className="mb-3 grid h-11 w-11 place-items-center rounded-full border border-slate-200 text-xl">×</button><h2 id="measurement-sheet-title" className="text-xl font-extrabold">Ajouter une entrée</h2><p className="mt-1 text-sm text-slate-600">Type sélectionné : <strong>{typeInfo.label}</strong></p>
          {!selectedConsent && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900"><p>Consentement « {families.find(f=>f.key===typeInfo.family)?.label} » requis.</p><button type="button" onClick={()=>{setMeasurementSheetOpen(false);setConfigurationPage("consentements");}} className="mt-2 min-h-11 rounded-lg border border-amber-300 px-3 font-bold">Aller aux consentements</button></div>}
          <div className="relative mt-4"><input id="measurement-value" value={value} onChange={e=>setValue(e.target.value)} type={typeInfo.numeric?"number":"text"} step="any" maxLength={2000} className="min-h-14 w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-base" placeholder={typeInfo.unit||"Votre note"}/><label htmlFor="measurement-value" className="pointer-events-none absolute left-3 top-2 text-sm font-semibold text-slate-500">Valeur</label></div>
          <div className="relative mt-4"><input id="measurement-datetime" type="datetime-local" value={measuredAt} onChange={e=>setMeasuredAt(e.target.value)} className="min-h-14 w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-base"/><label htmlFor="measurement-datetime" className="pointer-events-none absolute left-3 top-2 text-sm font-semibold text-slate-500">Date et heure</label></div>
          <div className="relative mt-4"><textarea id="measurement-note" value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={2} className="min-h-20 w-full rounded-xl border border-slate-300 bg-white px-3 pb-2 pt-5 text-base"/><label htmlFor="measurement-note" className="pointer-events-none absolute left-3 top-2 text-sm font-semibold text-slate-500">Note facultative</label></div>
          <button disabled={busy||!selectedConsent} onClick={()=>void saveMeasurement()} className="mt-4 min-h-11 w-full rounded-xl bg-[#0A6B3A] px-4 font-bold text-white disabled:opacity-40">{pendingMeasurementSource === "bluetooth" ? "Confirmer et enregistrer la mesure Bluetooth" : "Enregistrer dans mon espace privé"}</button>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 print:hidden"><button disabled={busy} onClick={()=>void connectHeartRate()} className="min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold">Synchroniser un capteur cardiaque Bluetooth</button><label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-emerald-200 px-3 text-center text-sm font-bold">Scanner photo, QR ou code-barres<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>void readImageLocally(e.target.files?.[0])}/></label></div>
          {ocrText && <div className="mt-3 rounded-xl border bg-slate-50 p-3"><p className="text-sm font-bold">{scanKind==="barcode"?"Code détecté localement":"Texte OCR local à vérifier"}</p><pre className="mt-2 whitespace-pre-wrap text-sm">{ocrText}</pre><p className="mt-2 text-sm text-slate-600">Aucune donnée n’est enregistrée sans confirmation explicite.</p>{scanKind==="ocr"&&typeInfo.numeric&&<button type="button" onClick={applyScannedValue} className="mt-3 min-h-10 rounded-lg border border-emerald-200 px-3 text-sm font-bold text-emerald-800">Préremplir si une seule valeur est détectée</button>}</div>}
        </div></div>
        <div className={(configurationPage==="rappels"?"":"hidden ")+"naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5"}><button type="button" onClick={()=>setConfigurationPage("home")} className="mb-3 min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-[#0A6B3A]">← Configurations</button><h2 className="text-xl font-extrabold">Rappels personnels</h2><p className="mt-1 text-sm text-slate-600">Les prises programmées sont contrôlées par le service NAXA. Le rappel de fraîcheur est déclenché cinq minutes avant l’heure prévue lorsque le service planifié et les notifications du téléphone sont disponibles.</p>
          <label className="mt-3 block text-sm font-semibold">Titre<input value={reminderTitle} onChange={e=>setReminderTitle(e.target.value)} maxLength={160} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder={"Ex. Relever ma mesure"}/></label>
          <label className="mt-3 block text-sm font-semibold">Échéance<input type="datetime-local" value={reminderAt} onChange={e=>setReminderAt(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label>
          <label className="mt-3 block text-sm font-semibold">Répétition<select value={repeatRule} onChange={e=>setRepeatRule(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"><option value="none">Une fois</option><option value="daily">Chaque jour</option><option value="weekly">Chaque semaine</option></select></label>
          <button disabled={busy||!selectedConsent} onClick={()=>void saveReminder()} className="mt-3 min-h-11 w-full rounded-xl bg-[#0A6B3A] px-4 font-bold text-white disabled:opacity-40">Enregistrer le rappel</button>
          <button type="button" onClick={()=>void enableReminderNotifications()} className="mt-2 min-h-11 w-full rounded-xl border border-emerald-200 px-4 font-bold text-[#0A6B3A]">Activer les notifications de rappel</button>
          <ul className="mt-4 space-y-2">{reminders.map(r=><li key={r.id} className="rounded-xl border p-3"><p className="font-bold">{r.title}</p><p className="mt-1 text-sm text-slate-600">{types.find(t=>t.key===r.measurement_type)?.label??r.measurement_type} · {new Date(r.due_at).toLocaleString("fr-FR")} · {r.repeat_rule==="none"?"une fois":r.repeat_rule==="daily"?"quotidien":"hebdomadaire"}</p></li>)}</ul>
        </div>
      </section>
      <section className={(activeTab==="Options" && optionsPage==="partage"?"":"hidden ")+"mt-5 naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5 print:hidden"}><button type="button" onClick={()=>setOptionsPage("home")} className="mb-3 min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-[#0A6B3A]">← Options</button><h2 className="text-xl font-extrabold">Partage par type</h2><p className="mt-1 text-sm text-slate-600">Chaque autorisation est limitée à un type. Le destinataire doit être un professionnel explicitement vérifié par NAXA. Vous pouvez retirer le partage.</p>
        <label className="mt-3 block text-sm font-semibold">Type à partager<select value={selectedType} onChange={e=>setSelectedType(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3">{types.map(t=><option key={t.key} value={t.key}>{t.label}</option>)}</select></label>
        <label className="mt-3 block text-sm font-semibold">UUID du professionnel vérifié<input value={professionalId} onChange={e=>setProfessionalId(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3 font-mono" placeholder="UUID Supabase"/></label>
        <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>void shareSelectedType()} className="min-h-11 rounded-xl bg-[#0A6B3A] px-4 font-bold text-white">Autoriser ce type</button><button disabled={busy} onClick={()=>void revokeShare()} className="min-h-11 rounded-xl border border-slate-300 px-4 font-bold text-slate-700">Révoquer ce type</button></div>
      </section>
      <section className={(activeTab==="Alertes"?"":"hidden ")+"mt-5 naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5"}><h2 className="text-xl font-extrabold">Alertes personnelles</h2><p className="mt-1 text-sm leading-6 text-slate-600">Définissez vos propres plages de rappel. NAXA ne fournit aucun seuil clinique recommandé; demandez conseil à un professionnel de santé pour interpréter les résultats.</p><p className="mt-3 text-sm font-semibold">Type sélectionné : {typeInfo.label}</p>{!typeInfo.numeric?<p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Ce type de note ne prend pas en charge les plages numériques.</p>:<div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Limite minimale personnelle<input type="number" step="any" value={minThreshold} onChange={e=>setMinThreshold(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder="Facultatif"/></label><label className="text-sm font-semibold">Limite maximale personnelle<input type="number" step="any" value={maxThreshold} onChange={e=>setMaxThreshold(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3" placeholder="Facultatif"/></label><button disabled={busy||!selectedConsent} onClick={()=>void saveAlertRule()} className="min-h-11 rounded-xl bg-[#0A6B3A] px-4 font-bold text-white disabled:opacity-40 sm:col-span-2">Enregistrer les limites personnelles</button></div>}<h3 className="mt-5 font-extrabold">Mes plages configurées</h3>{!alertRules.length?<p className="mt-2 text-sm text-slate-500">Aucune alerte personnalisée configurée.</p>:<ul className="mt-2 space-y-2">{alertRules.map(r=><li key={r.id} className="rounded-xl border p-3 text-sm"><strong>{types.find(t=>t.key===r.measurement_type)?.label??r.measurement_type}</strong><p className="mt-1 text-slate-600">Minimum : {r.min_value??"—"} · Maximum : {r.max_value??"—"}</p></li>)}</ul>}<h3 className="mt-5 font-extrabold">Alertes déclenchées</h3>{!alerts.length?<p className="mt-2 text-sm text-slate-500">Aucune alerte déclenchée.</p>:<ul className="mt-2 space-y-2">{alerts.map(a=><li key={a.id} className={a.read_at?"rounded-xl border p-3 text-sm":"rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{types.find(t=>t.key===a.measurement_type)?.label??a.measurement_type}</strong><time className="text-sm">{new Date(a.created_at).toLocaleString("fr-FR")}</time></div><p className="mt-1">Valeur {a.observed_value} {a.alert_kind==="below_user_range"?"inférieure à votre limite minimale":"supérieure à votre limite maximale"}.</p>{!a.read_at&&<button onClick={()=>void markAlertRead(a.id)} className="mt-2 min-h-10 rounded-lg border px-3 font-bold">Marquer comme lue</button>}</li>)}</ul>}<p className="mt-3 text-sm leading-5 text-slate-500">Ces alertes signalent uniquement un écart par rapport à vos paramètres. Elles ne constituent pas un avis médical et ne remplacent pas une urgence médicale.</p></section>
      <section className={(activeTab==="Options" && optionsPage==="historique"?"":"hidden ")+"mt-5 naxa-bento-card rounded-[28px] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(10,75,42,0.08)] transition duration-300 hover:-translate-y-0.5"}><button type="button" onClick={()=>setOptionsPage("home")} className="mb-3 min-h-11 rounded-xl border border-emerald-200 px-3 text-sm font-bold text-[#0A6B3A]">← Options</button><h2 className="text-xl font-extrabold">Historique privé</h2><div className="mt-4"><SuiviHistoryChart measurements={history} title="Variation de mes mesures"/></div>{history.length===0?<p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune mesure enregistrée. Si une erreur de lecture est apparue plus haut, réessayez avant de conclure que l’historique est vide.</p>:<ul className="mt-3 space-y-2">{history.map(m=><li key={m.id} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{types.find(t=>t.key===m.measurement_type)?.label??m.measurement_type}</p><time className="text-sm text-slate-500">{new Date(m.measured_at).toLocaleString("fr-FR")}</time></div><p className="mt-1 text-sm">{m.value_numeric??m.value_text} {m.unit??""}</p>{m.note&&<p className="mt-1 text-sm text-slate-600">{m.note}</p>}<p className="mt-1 text-sm text-slate-500">Source : {m.source==="bluetooth"?"Bluetooth":m.source==="photo_ocr_local"?"OCR local":"saisie manuelle"}</p></li>)}</ul>}</section>
      <p className="mt-5 text-center text-sm leading-5 text-slate-500">NAXA offre un carnet personnel de suivi, pas un dispositif de diagnostic. Vérifiez toute donnée avant de la partager avec un professionnel.</p>
    </div>
  </main>;
}
