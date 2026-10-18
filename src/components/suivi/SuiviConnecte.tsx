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
type Measurement = { id:string; measurement_type:string; value_numeric:number|null; value_text:string|null; unit:string|null; measured_at:string; source:string; note:string|null };
type Reminder = { id:string; measurement_type:string; title:string; due_at:string; repeat_rule:string; enabled:boolean };

export function SuiviConnecte() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [consents, setConsents] = useState<Record<string, boolean>>({});\n  const [preferredName, setPreferredName] = useState("");\n  const [birthYear, setBirthYear] = useState("");
  const [history, setHistory] = useState<Measurement[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [selectedType, setSelectedType] = useState("tension_systolique");
  const [value, setValue] = useState("");
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
    const { data: allow } = await sb.rpc("is_suivi_test_account", { p_user_id: userData.user.id });
    if (allow !== true) { setAllowed(false); return; }
    setAllowed(true);
    const [p, c, m, r] = await Promise.all([\n      sb.from("suivi_profiles").select("preferred_name,birth_year").eq("user_id",userData.user.id).maybeSingle(),
      sb.from("suivi_consents").select("family_key,granted").eq("user_id",userData.user.id),
      sb.from("suivi_measurements").select("id,measurement_type,value_numeric,value_text,unit,measured_at,source,note").eq("user_id",userData.user.id).order("measured_at",{ascending:false}).limit(100),
      sb.from("suivi_reminders").select("id,measurement_type,title,due_at,repeat_rule,enabled").eq("user_id",userData.user.id).order("due_at",{ascending:true}).limit(100),
    ]);
    if (p.error || c.error || m.error || r.error) setNotice("Certaines informations n’ont pas pu être chargées. Réessayez; aucune donnée n’est inventée.");
    setPreferredName(p.data?.preferred_name ?? "");\n    setBirthYear(p.data?.birth_year ? String(p.data.birth_year) : "");\n    setConsents(Object.fromEntries((c.data??[]).map((x:any)=>[x.family_key,!!x.granted])));
    setHistory((m.data??[]) as Measurement[]);
    setReminders((r.data??[]) as Reminder[]);
  }, [sb]);

  useEffect(() => { void load(); }, [load]);

  const typeInfo = types.find(t=>t.key===selectedType)!;
  const selectedConsent = !!consents[typeInfo.family];
  const grantedFamilies = families.filter(f=>consents[f.key]).length;

  async function saveProfile() {\n    setBusy(true); setNotice("");\n    const { data:userData } = await sb.auth.getUser();\n    if (!userData.user) { setNotice("Session expirée."); setBusy(false); return; }\n    const parsedYear = birthYear.trim() ? Number(birthYear) : null;\n    if (parsedYear !== null && (!Number.isInteger(parsedYear) || parsedYear < 1900 || parsedYear > new Date().getFullYear())) { setNotice("Année de naissance invalide."); setBusy(false); return; }\n    const { error } = await sb.from("suivi_profiles").upsert({ user_id:userData.user.id, preferred_name:preferredName.trim() || null, birth_year:parsedYear, updated_at:new Date().toISOString() }, { onConflict:"user_id" });\n    setNotice(error ? "Profil non enregistré." : "Profil de suivi enregistré."); setBusy(false);\n  }\n\n  async function toggleConsent(family: Family, grant: boolean) {
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

  async function saveMeasurement(source: "manual"|"bluetooth"|"photo_ocr_local" = "manual", overrideValue?: string) {
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
    else { setValue(""); setNote(""); setNotice("Entrée enregistrée dans votre espace privé."); await load(); }
    setBusy(false);
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
    try {
      const bluetooth = (navigator as any).bluetooth;
      if (!bluetooth?.requestDevice) { setNotice("Bluetooth médical non pris en charge par ce navigateur. Saisissez la mesure manuellement."); return; }
      const device = await bluetooth.requestDevice({filters:[{services:["heart_rate"]}]});
      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService("heart_rate");
      const characteristic = await service?.getCharacteristic("heart_rate_measurement");
      const reading = await characteristic?.readValue();
      if (!reading) { setNotice("Aucune mesure reçue. Vous pouvez saisir la valeur manuellement."); return; }
      const flags = reading.getUint8(0);
      const bpm = flags & 1 ? reading.getUint16(1,true) : reading.getUint8(1);
      setSelectedType("frequence_cardiaque"); setValue(String(bpm)); setNotice("Lecture Bluetooth reçue; vérifiez la valeur avant de l’enregistrer.");
    } catch { setNotice("Connexion Bluetooth annulée ou indisponible. Aucune donnée n’a été enregistrée."); }
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
        <div><p className="text-xs font-extrabold uppercase tracking-widest">NAXA · Cohorte de test privée</p><h1 className="mt-1 text-3xl font-black">Mon suivi connecté</h1><p className="mt-2 text-sm">Données privées · consentements par famille · partage par type</p></div>
        <div className="flex flex-wrap gap-2 print:hidden"><Link href="/" className="inline-flex min-h-11 items-center rounded-xl border border-white/50 px-4 font-bold">Accueil</Link><Link href="/suivi/professionnel" className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 font-bold text-[#1D4ED8]">Espace professionnel</Link><button onClick={exportPdf} className="min-h-11 rounded-xl border border-white/50 px-4 font-bold">Exporter / PDF</button></div>
      </header>
      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Ce n’est pas un service d’urgence.</strong> En cas d’urgence médicale, appelez le 119 selon la disponibilité locale ou rendez-vous dans un établissement de santé. NAXA ne pose pas de diagnostic et ne recommande aucune posologie.</div>
      {notice && <p role="status" className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{notice}</p>}
      <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Profil de suivi</h2><p className="mt-1 text-sm text-slate-600">Informations facultatives pour personnaliser votre carnet. Elles ne sont pas visibles par un professionnel sans partage explicite d’une mesure.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nom d’affichage<input value={preferredName} onChange={e=>setPreferredName(e.target.value)} maxLength={100} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label><label className="text-sm font-semibold">Année de naissance (facultative)<input type="number" min="1900" max={new Date().getFullYear()} value={birthYear} onChange={e=>setBirthYear(e.target.value)} className="mt-1 min-h-11 w-full rounded-xl border px-3"/></label></div><button disabled={busy} onClick={()=>void saveProfile()} className="mt-3 min-h-11 rounded-xl bg-[#1D4ED8] px-4 font-bold text-white disabled:opacity-40">Enregistrer le profil</button></section>\n      <section className="mt-5 rounded-2xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-extrabold">Consentements</h2><p className="mt-1 text-sm text-slate-600">Choisissez séparément les familles que vous souhaitez utiliser. Sans consentement actif, aucune nouvelle saisie n’est autorisée.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-[#1D4ED8]">{grantedFamilies}/6 autorisées</span></div>
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
          <button disabled={busy||!selectedConsent} onClick={()=>void saveMeasurement()} className="mt-4 min-h-11 w-full rounded-xl bg-[#1D4ED8] px-4 font-bold text-white disabled:opacity-40">Enregistrer dans mon espace privé</button>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 print:hidden"><button onClick={()=>void connectHeartRate()} className="min-h-11 rounded-xl border border-blue-200 px-3 text-sm font-bold">Lire un capteur cardiaque Bluetooth</button><label className="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border border-blue-200 px-3 text-center text-sm font-bold">Lire une photo localement<input type="file" accept="image/*" capture="environment" className="sr-only" onChange={e=>void readImageLocally(e.target.files?.[0])}/></label></div>
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
      <section className="mt-5 rounded-2xl border bg-white p-5"><h2 className="text-xl font-extrabold">Historique privé</h2>{history.length===0?<p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Aucune mesure enregistrée. Si une erreur de lecture est apparue plus haut, réessayez avant de conclure que l’historique est vide.</p>:<ul className="mt-3 space-y-2">{history.map(m=><li key={m.id} className="rounded-xl border p-3"><div className="flex flex-wrap justify-between gap-2"><p className="font-bold">{types.find(t=>t.key===m.measurement_type)?.label??m.measurement_type}</p><time className="text-xs text-slate-500">{new Date(m.measured_at).toLocaleString("fr-FR")}</time></div><p className="mt-1 text-sm">{m.value_numeric??m.value_text} {m.unit??""}</p>{m.note&&<p className="mt-1 text-sm text-slate-600">{m.note}</p>}<p className="mt-1 text-xs text-slate-500">Source : {m.source==="bluetooth"?"Bluetooth":m.source==="photo_ocr_local"?"OCR local":"saisie manuelle"}</p></li>)}</ul>}</section>
      <p className="mt-5 text-center text-xs leading-5 text-slate-500">NAXA est un carnet de suivi expérimental, pas un dispositif de diagnostic. Vérifiez toute donnée avant de la partager avec un professionnel.</p>
    </div>
  </main>;
}
