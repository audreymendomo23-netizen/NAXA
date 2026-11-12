"use client";

import { useMemo, useState } from "react";

export type SuiviChartMeasurement = {
  id: string;
  measurement_type: string;
  value_numeric: number | null;
  unit: string | null;
  measured_at: string;
};

type Period = "day" | "week" | "month" | "year" | "custom";

const LABELS: Record<string,string> = {
  tension_systolique:"Tension systolique", tension_diastolique:"Tension diastolique",
  tension_arterielle_moyenne:"Pression artérielle moyenne", frequence_cardiaque:"Fréquence cardiaque",
  temperature:"Température", saturation_oxygene:"Saturation en oxygène", glycemie:"Glycémie",
  poids:"Poids", taille:"Taille", imc:"IMC", frequence_respiratoire:"Fréquence respiratoire",
  cholesterol_total:"Cholestérol total", debit_expiratoire:"Débit expiratoire", masse_grasse:"Masse grasse",
  masse_musculaire:"Masse musculaire", masse_maigre:"Masse maigre", masse_maigre_molle:"Masse maigre molle",
  masse_eau_corporelle:"Masse d'eau corporelle", metabolisme_basal:"Métabolisme basal",
  pourcentage_musculaire:"Pourcentage musculaire", vitesse_course:"Vitesse de course",
  cadence_course:"Cadence de course", longueur_foulee:"Longueur de foulée",
};

export function SuiviHistoryChart({ measurements, title = "Évolution des mesures" }: {
  measurements: SuiviChartMeasurement[];
  title?: string;
}) {
  const numericTypes = useMemo(() => [...new Set(measurements.filter(m => m.value_numeric !== null).map(m => m.measurement_type))].sort(), [measurements]);
  const [type, setType] = useState(numericTypes[0] ?? "");
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const activeType = numericTypes.includes(type) ? type : (numericTypes[0] ?? "");
  const points = useMemo(() => {
    const now = new Date();
    let start: Date | null = null;
    let end: Date | null = null;
    if (period === "day") { start = new Date(now); start.setHours(0,0,0,0); end = new Date(now); end.setHours(23,59,59,999); }
    if (period === "week") { start = new Date(now); start.setDate(now.getDate()-6); start.setHours(0,0,0,0); end = now; }
    if (period === "month") { start = new Date(now.getFullYear(),now.getMonth(),1); end = now; }
    if (period === "year") { start = new Date(now.getFullYear(),0,1); end = now; }
    if (period === "custom") {
      start = from ? new Date(from+"T00:00:00") : null;
      end = to ? new Date(to+"T23:59:59.999") : null;
    }
    return measurements
      .filter(m => m.measurement_type === activeType && m.value_numeric !== null)
      .filter(m => { const d=new Date(m.measured_at); return Number.isFinite(d.getTime()) && (!start || d>=start) && (!end || d<=end); })
      .sort((a,b)=>a.measured_at.localeCompare(b.measured_at));
  }, [measurements, activeType, period, from, to]);
  const values = points.map(point => point.value_numeric as number);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const range = max-min || Math.max(Math.abs(max)*0.05,1);
  const coordinates = points.map((point,index)=>({
    x: points.length<=1?300:24+(index*552)/(points.length-1),
    y: 142-(((point.value_numeric as number)-min)/range)*112
  }));
  const polyline = coordinates.map(p=>`${p.x},${p.y}`).join(" ");
  const unit = points.find(point=>point.unit)?.unit ?? "";
  const fmt = (value:string) => new Date(value).toLocaleString("fr-FR",{dateStyle:"short",timeStyle:"short"});
  if (!numericTypes.length) return <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600">Aucune mesure numérique disponible pour tracer un graphique.</p>;
  return <section className="rounded-2xl border border-slate-200 bg-white p-4" aria-label={title}>
    <h3 className="font-extrabold">{title}</h3>
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      <label className="text-sm font-semibold">Type de mesure
        <select className="champ mt-1 w-full" value={activeType} onChange={event=>setType(event.target.value)}>
          {numericTypes.map(key=><option key={key} value={key}>{LABELS[key] ?? key}</option>)}
        </select>
      </label>
      <label className="text-sm font-semibold">Période
        <select className="champ mt-1 w-full" value={period} onChange={event=>setPeriod(event.target.value as Period)}>
          <option value="day">Aujourd'hui</option><option value="week">7 derniers jours</option>
          <option value="month">Mois en cours</option><option value="year">Année en cours</option><option value="custom">Personnalisée</option>
        </select>
      </label>
    </div>
    {period==="custom" && <div className="mt-2 grid grid-cols-2 gap-2">
      <label className="text-sm">Du<input type="date" value={from} onChange={event=>setFrom(event.target.value)} className="champ mt-1 w-full"/></label>
      <label className="text-sm">Au<input type="date" min={from || undefined} value={to} onChange={event=>setTo(event.target.value)} className="champ mt-1 w-full"/></label>
    </div>}
    {points.length ? <>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-2"><span className="text-xs text-slate-500">Minimum</span><p className="font-bold tabular-nums">{min} {unit}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><span className="text-xs text-slate-500">Maximum</span><p className="font-bold tabular-nums">{max} {unit}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><span className="text-xs text-slate-500">Mesures</span><p className="font-bold tabular-nums">{points.length}</p></div>
      </div>
      <div className="mt-3 rounded-xl border bg-slate-50 p-2">
        <svg viewBox="0 0 600 180" role="img" aria-label={`Graphique de variation : ${LABELS[activeType] ?? activeType}`} className="h-48 w-full">
          <line x1="24" y1="142" x2="576" y2="142" stroke="#cbd5e1"/>
          <line x1="24" y1="86" x2="576" y2="86" stroke="#e2e8f0" strokeDasharray="4 4"/>
          <line x1="24" y1="30" x2="576" y2="30" stroke="#e2e8f0"/>
          {points.length>1 && <polyline points={polyline} fill="none" stroke="#0A6B3A" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>}
          {coordinates.map((point,index)=><circle key={points[index].id} cx={point.x} cy={point.y} r="4" fill="#0A6B3A"><title>{`${points[index].value_numeric} ${points[index].unit ?? ""} — ${fmt(points[index].measured_at)}`}</title></circle>)}
        </svg>
        <div className="flex justify-between gap-2 text-xs text-slate-500"><span>{fmt(points[0].measured_at)}</span><span>{fmt(points[points.length-1].measured_at)}</span></div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Le graphique présente uniquement les mesures réellement reçues. Les intervalles sans donnée ne sont pas interpolés et ne constituent pas une interprétation médicale.</p>
    </> : <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Aucune mesure dans cet intervalle.</p>}
  </section>;
}
