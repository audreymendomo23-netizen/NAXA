"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PharmacienWorkspaceShell } from "@/components/pharmacie/PharmacienWorkspaceShell";
import { supabaseBrowser } from "@/lib/supabase/client";

type Share = { id: string; owner_user_id: string; measurement_type: string; granted_at: string; active: boolean; revoked_at: string | null };
type Measurement = { id: string; user_id: string; measurement_type: string; value_numeric: number | null; value_text: string | null; unit: string | null; measured_at: string; source: string; note: string | null };
type ViewTab = "patients" | "mesures" | "partages";
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

export default function PharmacienSuiviPatientsPage() {
  const sb = useMemo(() => supabaseBrowser(), []);
  const [shares, setShares] = useState<Share[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [tab, setTab] = useState<ViewTab>("patients");
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
      .select("id,owner_user_id,measurement_type,granted_at,active,revoked_at")
      .eq("recipient_user_id", userId).eq("active", true).is("revoked_at", null)
      .order("granted_at", { ascending: false }).limit(500);
    if (shareError) {
      setShares([]); setMeasurements([]);
      setError("Les partages ne sont pas accessibles. Vérifiez la migration 127, la migration 189, la vérification du professionnel et l’autorisation expérimentale du compte.");
      setBusy(false); return;
    }
    const activeShares = (data ?? []) as Share[];
    setShares(activeShares);
    const owners = [...new Set(activeShares.map(item => item.owner_user_id))];
    const types = [...new Set(activeShares.map(item => item.measurement_type))];
    if (!owners.length || !types.length) {
      setMeasurements([]);
      setNotice("Aucun patient ne partage actuellement de mesure avec ce compte.");
      setBusy(false); return;
    }
    const { data: rows, error: measurementError } = await sb.from("suivi_measurements")
      .select("id,user_id,measurement_type,value_numeric,value_text,unit,measured_at,source,note")
      .in("user_id", owners).in("measurement_type", types)
      .order("measured_at", { ascending: false }).limit(500);
    if (measurementError) {
      setMeasurements([]);
      setError("Les partages sont visibles mais les mesures restent bloquées par les droits serveur. Vérifiez la migration 189 et ses tests SQL.");
      setBusy(false); return;
    }
    const allowed = new Set(activeShares.map(item => `${item.owner_user_id}:${item.measurement_type}`));
    setMeasurements(((rows ?? []) as Measurement[]).filter(row => allowed.has(`${row.user_id}:${row.measurement_type}`)));
    setNotice("Données affichées uniquement pour les types de mesure explicitement partagés et encore actifs.");
    setBusy(false);
  }, [sb]);

  const refresh = useCallback(async () => {
    setLoading(true); setError(""); setNotice("");
    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth.user) { setError("Connexion requise."); setLoading(false); return; }
    const { data: profile, error: profileError } = await sb.from("profiles")
      .select("actif,fonction_interne,pharmacie_id").eq("id", auth.user.id).maybeSingle();
    if (profileError || !profile || profile.actif !== true || profile.fonction_interne !== "pharmacien" || !profile.pharmacie_id) {
      setError("Accès réservé à un compte Pharmacien actif rattaché à une pharmacie."); setLoading(false); return;
    }
    const { data: pharmacy, error: pharmacyError } = await sb.from("pharmacies")
      .select("id,actif,visible_recherche").eq("id", profile.pharmacie_id).maybeSingle();
    if (pharmacyError || !pharmacy || pharmacy.actif !== true || pharmacy.visible_recherche !== true) {
      setError("La pharmacie est inactive ou non publiée ; l’accès au suivi patient est bloqué."); setLoading(false); return;
    }
    await loadSharedData(auth.user.id);
    setLoading(false);
  }, [sb, loadSharedData]);

  useEffect(() => { void refresh(); }, [refresh]);
  const owners = [...new Set(shares.map(item => item.owner_user_id))];
  const types = [...new Set(shares.map(item => item.measurement_type))].sort();
  const filteredMeasurements = measurements.filter(row => {
    const query = search.trim().toLowerCase();
    const patientMatch = !query || patientLabel(row.user_id).toLowerCase().includes(query) || row.user_id.toLowerCase().includes(query);
    const typeMatch = typeFilter === "tous" || row.measurement_type === typeFilter;
    return patientMatch && typeMatch;
  });
  const measurementsByPatient = owners.map(owner => ({
    owner,
    shareCount: shares.filter(item => item.owner_user_id === owner).length,
    latest: measurements.filter(item => item.user_id === owner).sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0] ?? null,
  })).filter(row => !search.trim() || patientLabel(row.owner).toLowerCase().includes(search.trim().toLowerCase()) || row.owner.toLowerCase().includes(search.trim().toLowerCase()));

  return <PharmacienWorkspaceShell activeTab="dispositifs" onNavigate={section => {
    if (section === "dashboard") window.location.href = "/pharmacie/pharmacien";
    else if (section === "dispositifs") window.location.href = "/pharmacie/pharmacien/suivi-patients";
    else window.location.href = `/pharmacie/pharmacien/${section}`;
  }}>
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#0B3D26] px-4 py-4 text-white">
      <div><a href="/pharmacie/pharmacien" className="text-sm text-emerald-100 hover:text-white">← Espace Pharmacien</a><h1 className="mt-1 text-2xl font-black">Suivi des patients</h1><p className="mt-1 text-sm text-emerald-100">Mesures partagées, consentement et traçabilité des accès.</p></div>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="min-h-10 rounded-xl border border-white/30 px-4 py-2 text-sm font-bold disabled:opacity-50">Actualiser</button>
    </header>
    <section className="carte space-y-3"><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Patients partageant des mesures</p><p className="text-2xl font-black">{owners.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Types partagés</p><p className="text-2xl font-black">{types.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-sm text-slate-600">Mesures visibles</p><p className="text-2xl font-black">{measurements.length}</p></div></div>
      <p className="text-sm text-slate-600">Les identités sont masquées par défaut. NAXA affiche les mesures partagées sans poser de diagnostic ni recommander de posologie.</p>
    </section>
    {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{notice}</p>}
    {error && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>Accès ou chargement limité</b><p className="mt-1">{error}</p></div>}
    <section className="carte space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Onglets du suivi patient">
        {([{id:"patients",label:"Patients partagés"},{id:"mesures",label:"Mesures"},{id:"partages",label:"Partages et accès"}] as const).map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} onClick={()=>setTab(item.id)} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-bold ${tab===item.id ? "bg-[#0B3D26] text-white" : "bg-slate-100 text-slate-700"}`}>{item.label}</button>)}
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]"><label className="block text-sm font-semibold">Rechercher un patient partagé<input className="champ mt-1 w-full" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Identifiant anonymisé"/></label>{tab==="mesures" && <label className="block text-sm font-semibold">Type de mesure<select className="champ mt-1 w-full" value={typeFilter} onChange={e=>setTypeFilter(e.target.value)}><option value="tous">Tous les types partagés</option>{types.map(type=><option key={type} value={type}>{labels[type] ?? type}</option>)}</select></label>}</div>
      {loading ? <p className="rounded-xl bg-slate-50 p-4 text-sm">Chargement des partages autorisés…</p> : <>
        {tab==="patients" && (measurementsByPatient.length ? <div className="space-y-3">{measurementsByPatient.map(patient=><article key={patient.owner} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="font-extrabold">{patientLabel(patient.owner)}</h2><p className="text-sm text-slate-600">{patient.shareCount} type(s) partagé(s)</p></div><button type="button" className="btn btn-clair" onClick={()=>{setSearch(patientLabel(patient.owner));setTab("mesures");}}>Voir les mesures</button></div>{patient.latest ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">Dernière mesure reçue : <b>{labels[patient.latest.measurement_type] ?? patient.latest.measurement_type}</b> · {dateLabel(patient.latest.measured_at)}</p> : <p className="mt-3 text-sm text-slate-500">Aucune mesure disponible pour les types partagés.</p>}</article>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucun patient correspondant ou aucun partage actif.</p>)}
        {tab==="mesures" && (filteredMeasurements.length ? <div className="space-y-3">{filteredMeasurements.map(row=><article key={row.id} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><b>{labels[row.measurement_type] ?? row.measurement_type}</b><p className="text-sm text-slate-600">{patientLabel(row.user_id)} · {dateLabel(row.measured_at)}</p></div><span className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold">{row.value_numeric !== null ? `${row.value_numeric}${row.unit ? " " + row.unit : ""}` : row.value_text || "Valeur non renseignée"}</span></div>{row.note && <p className="mt-3 text-sm text-slate-600">Note partagée : {row.note}</p>}<p className="mt-2 text-xs text-slate-500">Source enregistrée : {row.source}</p></article>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucune mesure ne correspond aux filtres. Les mesures restent visibles seulement tant que le partage et le consentement sont actifs.</p>)}
        {tab==="partages" && (shares.length ? <div className="space-y-2">{shares.map(share=><article key={share.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><b>{patientLabel(share.owner_user_id)}</b><p className="text-sm text-slate-600">{labels[share.measurement_type] ?? share.measurement_type}</p><p className="text-xs text-slate-500">Partage accordé le {dateLabel(share.granted_at)}</p></div><span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900">Actif</span></article>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">Aucun partage actif. Le patient conserve le contrôle de son consentement et peut révoquer le partage depuis son compte.</p>)}
      </>}
    </section>
    <p className="px-1 text-xs text-slate-500">Le module reste soumis à la vérification professionnelle et à l’autorisation expérimentale existante du suivi connecté. Les alertes cliniques et le suivi des prescriptions ne sont pas activés par cette page et ne doivent pas être déduits des seules mesures.</p>
  </PharmacienWorkspaceShell>;
}
